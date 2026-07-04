import { TAbstractFile, TFile } from 'obsidian';

import { CompileService } from '~/compile';
import { configureEsbuildPluginRoot } from '~/compile/esbuild-init';
import { toAbsoluteVaultPath } from '~/compile/vault-paths';
import { isPathUnder, joinPath, resolvePaths } from '~/paths';
import { createRuntime, type RuntimeServices } from '~/runtime';
import { CommandRegistrar } from '~/runtime/commands';
import {
  SettingsStore,
  VaultScriptsSettingTab,
  type SettingsTabHost,
  type VaultScriptsSettings,
} from '~/settings';
import { COMMAND_REBUILD, LOG_PREFIX } from '~/shared/constants';
import { isDesktopApp } from '~/shared/utils';

import { BuildEventHandler, notifyExportConflicts } from './build-event-handler';
import { checkMobileDistExists, registerMobileDistListeners } from './mobile-bootstrap';
import { createStubVsProxy } from './stub-vs-proxy';

import type { HostState, VaultScriptsPluginApi } from './types';

import type { Plugin } from 'obsidian';
import type { ResolvedPaths } from '~/paths';

export type VaultScriptsPluginHost = Omit<Plugin, 'settings'> &
  SettingsTabHost & {
    api: VaultScriptsPluginApi;
  };

/**
 * Plugin 生命周期编排。
 */
export class LifecycleManager {
  private state: HostState | undefined;
  private compile: CompileService | undefined;
  private runtime: RuntimeServices | undefined;
  private commands: CommandRegistrar | undefined;
  private buildHandler: BuildEventHandler | undefined;
  private settingsStore: SettingsStore | undefined;
  private srcListenersRegistered = false;
  private mobileDistListenersRegistered = false;

  async onload(plugin: VaultScriptsPluginHost): Promise<void> {
    configureEsbuildPluginRoot(toAbsoluteVaultPath(plugin.app.vault, plugin.manifest.dir ?? ''));

    this.settingsStore = new SettingsStore(plugin);
    const settings = await this.settingsStore.load();

    const paths = await resolvePaths({
      vault: plugin.app.vault,
      settings,
      manifestDir: joinPath('.obsidian/plugins', plugin.manifest.id),
    });
    this.state = { settings, paths, lastAppliedBuildId: 0 };

    plugin.settings = settings;
    plugin.saveSettings = async () => {
      await this.settingsStore!.save(plugin.settings);
      await this.applySettings(plugin);
    };

    plugin.api = {
      vs: createStubVsProxy(),
      rebuild: async () => this.rebuild(plugin),
    };

    this.bootstrapRuntime(plugin, paths);
    this.setupSrcDirListeners(plugin);

    await this.startCompileIfDesktop(plugin);

    if (!isDesktopApp()) {
      await checkMobileDistExists(plugin.app.vault, paths);
    }

    await this.finishRuntimeBootstrap(plugin);
    this.setupMobileDistListeners(plugin);

    plugin.addSettingTab(new VaultScriptsSettingTab(plugin.app, plugin, plugin));
    this.registerRebuildCommand(plugin);

    console.log(`${LOG_PREFIX} plugin loaded`, {
      srcDir: paths.srcDir,
      distDir: paths.distDir,
      ok: paths.ok,
      desktop: isDesktopApp(),
      compile: Boolean(this.compile),
      runtime: Boolean(this.runtime),
      commands: this.commands?.getRegisteredIds().length ?? 0,
      exports: this.runtime?.registry.getActiveEntries().length ?? 0,
    });
  }

  onunload(): void {
    void this.compile?.dispose();
    this.compile = undefined;
    this.commands?.unregisterAll();
    this.commands = undefined;
    this.runtime?.loader.invalidate(true);
    this.runtime = undefined;
    this.buildHandler = undefined;
    this.settingsStore = undefined;
    this.srcListenersRegistered = false;
    this.mobileDistListenersRegistered = false;
    this.clearVsGlobal();
    this.state = undefined;
    console.log(`${LOG_PREFIX} plugin unloaded`);
  }

  getState(): HostState | undefined {
    return this.state;
  }

  async applySettings(plugin: VaultScriptsPluginHost): Promise<void> {
    if (!this.state) {
      return;
    }

    const previousPaths = this.state.paths;
    const previousSettings: VaultScriptsSettings = { ...this.state.settings };

    const paths = await resolvePaths({
      vault: plugin.app.vault,
      settings: plugin.settings,
      manifestDir: joinPath('.obsidian/plugins', plugin.manifest.id),
    });

    this.state.settings = plugin.settings;
    this.state.paths = paths;

    const pathsChanged = !pathsEqual(previousPaths, paths);
    const compileOptionsChanged =
      previousSettings.showBuildNotice !== plugin.settings.showBuildNotice;
    const watchPrefChanged = previousSettings.autoWatch !== plugin.settings.autoWatch;

    if (pathsChanged) {
      await this.compile?.dispose();
      this.compile = undefined;
      this.bootstrapRuntime(plugin, paths);
    }

    if (isDesktopApp()) {
      await this.syncCompileService(
        plugin,
        paths,
        pathsChanged || compileOptionsChanged,
        watchPrefChanged || pathsChanged,
      );
    }

    await this.finishRuntimeBootstrap(plugin);

    if (pathsChanged) {
      this.setupMobileDistListeners(plugin);
    }

    console.log(`${LOG_PREFIX} settings applied`, {
      srcDir: paths.srcDir,
      ok: paths.ok,
      compile: Boolean(this.compile),
      watch: this.compile?.isWatchEnabled() ?? false,
      hasWatchContext: this.compile?.hasWatchContext() ?? false,
    });
  }

  private bootstrapRuntime(plugin: VaultScriptsPluginHost, paths: ResolvedPaths): void {
    if (!paths.distDir) {
      this.runtime = undefined;
      this.commands = undefined;
      this.buildHandler = undefined;
      plugin.api.vs = createStubVsProxy();
      return;
    }

    this.runtime = createRuntime(plugin.app.vault, paths);
    this.commands = new CommandRegistrar(plugin, plugin.app, () => plugin.api.vs);
    this.buildHandler = this.createBuildHandler(plugin, this.runtime);
  }

  private createBuildHandler(
    plugin: VaultScriptsPluginHost,
    runtime: RuntimeServices,
  ): BuildEventHandler {
    return new BuildEventHandler({
      getState: () => this.state,
      setLastAppliedBuildId: (buildId) => {
        if (this.state) {
          this.state.lastAppliedBuildId = buildId;
        }
      },
      runtime,
      commands: this.commands!,
      app: plugin.app,
    });
  }

  private async finishRuntimeBootstrap(plugin: VaultScriptsPluginHost): Promise<void> {
    if (!this.runtime || !this.commands || !this.state?.paths.distDir) {
      return;
    }

    const snapshot = await this.runtime.registry.reindexFromDist();
    notifyExportConflicts(snapshot.conflicts);
    this.commands.registerAll(snapshot.active);
    plugin.api.vs = this.runtime.createVsProxy();
    this.registerVsGlobal(plugin.api.vs);
  }

  private async syncCompileService(
    plugin: VaultScriptsPluginHost,
    paths: ResolvedPaths,
    recreateService: boolean,
    restartMode: boolean,
  ): Promise<void> {
    if (!paths.ok || !paths.srcDir) {
      await this.compile?.dispose();
      this.compile = undefined;
      return;
    }

    if (recreateService || !this.compile) {
      await this.compile?.dispose();
      this.compile = new CompileService({
        vault: plugin.app.vault,
        paths,
        showBuildNotice: this.state!.settings.showBuildNotice,
      });
      this.attachBuildEndHandler();
    }

    if (!restartMode && this.compile.hasWatchContext()) {
      return;
    }

    if (this.state!.settings.autoWatch) {
      await this.compile.start({ watch: true });
      return;
    }

    await this.compile.dispose();
    await this.compile.start({ watch: false });
  }

  private async startCompileIfDesktop(plugin: VaultScriptsPluginHost): Promise<void> {
    if (!isDesktopApp() || !this.state?.paths.ok || !this.state.paths.srcDir) {
      return;
    }

    await this.syncCompileService(plugin, this.state.paths, true, true);
  }

  private attachBuildEndHandler(): void {
    if (!this.compile || !this.buildHandler) {
      return;
    }

    this.compile.onBuildEnd((result) => {
      console.log(`${LOG_PREFIX} build end`, {
        buildId: result.buildId,
        success: result.success,
        entryCount: result.entryCount,
      });
      void this.buildHandler?.handle(result);
    });
  }

  private setupSrcDirListeners(plugin: VaultScriptsPluginHost): void {
    if (this.srcListenersRegistered) {
      return;
    }
    this.srcListenersRegistered = true;

    const onChange = (file: TAbstractFile, kind: 'create' | 'delete' | 'modify') => {
      if (!(file instanceof TFile)) {
        return;
      }
      void this.handleSrcDirChange(plugin, file.path, kind);
    };

    plugin.registerEvent(plugin.app.vault.on('create', (file) => onChange(file, 'create')));
    plugin.registerEvent(plugin.app.vault.on('delete', (file) => onChange(file, 'delete')));
    plugin.registerEvent(plugin.app.vault.on('modify', (file) => onChange(file, 'modify')));
    plugin.registerEvent(
      plugin.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile) {
          void this.handleSrcDirChange(plugin, file.path, 'create');
        }
        void this.handleSrcDirChange(plugin, oldPath, 'delete');
      }),
    );
  }

  private async handleSrcDirChange(
    plugin: VaultScriptsPluginHost,
    path: string,
    kind: 'create' | 'delete' | 'modify',
  ): Promise<void> {
    if (!this.state) {
      return;
    }

    const { paths } = this.state;

    if (!paths.ok && paths.scriptsRoot && isPathUnder(path, paths.scriptsRoot)) {
      await this.applySettings(plugin);
      return;
    }

    if (!paths.ok || !paths.srcDir || !isPathUnder(path, paths.srcDir)) {
      return;
    }

    if (!isDesktopApp() || !this.state.settings.autoWatch || !this.compile) {
      return;
    }

    if (kind === 'modify' && this.compile.hasWatchContext()) {
      return;
    }

    await this.compile.refreshWatch();
  }

  private setupMobileDistListeners(plugin: VaultScriptsPluginHost): void {
    if (this.mobileDistListenersRegistered || isDesktopApp() || !this.state?.paths.distDir) {
      return;
    }

    this.mobileDistListenersRegistered = true;
    registerMobileDistListeners(plugin, this.state.paths, async () => {
      await this.finishRuntimeBootstrap(plugin);
    });
  }

  private registerVsGlobal(vs: VaultScriptsPluginApi['vs']): void {
    (window as Window & { vs?: VaultScriptsPluginApi['vs'] }).vs = vs;
  }

  private clearVsGlobal(): void {
    const win = window as Window & { vs?: VaultScriptsPluginApi['vs'] };
    if (win.vs !== undefined) {
      win.vs = undefined;
    }
  }

  private registerRebuildCommand(plugin: VaultScriptsPluginHost): void {
    plugin.addCommand({
      id: COMMAND_REBUILD,
      name: 'Vault Scripts: Rebuild & reload',
      callback: () => {
        void plugin.api.rebuild();
      },
    });
  }

  private async rebuild(_plugin: VaultScriptsPluginHost): Promise<void> {
    if (!this.compile) {
      console.warn(
        `${LOG_PREFIX} rebuild() skipped: compile unavailable (Mobile or paths not ready)`,
      );
      return;
    }

    await this.compile.rebuild();
  }
}

function pathsEqual(a: ResolvedPaths, b: ResolvedPaths): boolean {
  return (
    a.scriptsRoot === b.scriptsRoot &&
    a.srcDir === b.srcDir &&
    a.distDir === b.distDir &&
    a.ok === b.ok
  );
}
