import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

import { joinPath, resolvePaths } from '~/paths';

import { formatPathPreview } from './path-preview';
import { ScriptRootSchema, type VaultScriptsSettings } from './types';

export interface SettingsTabHost {
  settings: VaultScriptsSettings;
  saveSettings(): Promise<void>;
}

/**
 * 设置页：四字段 + scriptsRoot 基础校验
 */
export class VaultScriptsSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly host: SettingsTabHost,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Vault Scripts' });

    new Setting(containerEl)
      .setName('Scripts root')
      .setDesc('Relative path from vault root to your scripts folder (must contain src/).')
      .addText((text) =>
        text
          .setPlaceholder('scripts')
          .setValue(this.host.settings.scriptsRoot)
          .onChange(async (value) => {
            if (value.includes('..')) {
              text.inputEl.setAttr('aria-invalid', 'true');
              return;
            }
            text.inputEl.removeAttribute('aria-invalid');

            const result = ScriptRootSchema.safeParse(value);
            if (!result.success) {
              text.inputEl.setAttr('aria-invalid', 'true');
              return;
            }
            text.inputEl.removeAttribute('aria-invalid');

            this.host.settings.scriptsRoot = result.data;
            await this.host.saveSettings();
          }),
      );

    this.addToggle(
      containerEl,
      'Auto watch',
      'Rebuild when source files change (Desktop only).',
      'autoWatch',
    );

    this.addToggle(
      containerEl,
      'Show build notice',
      'Show a notice when compilation fails.',
      'showBuildNotice',
    );

    void this.appendPathPreview(containerEl);
  }

  private async appendPathPreview(containerEl: HTMLElement): Promise<void> {
    const section = containerEl.createDiv({ cls: 'vault-scripts-path-preview' });
    section.createEl('h3', { text: 'Resolved paths' });

    const paths = await resolvePaths({
      vault: this.app.vault,
      settings: this.host.settings,
      manifestDir: joinPath('.obsidian/plugins', this.plugin.manifest.id),
    });
    const preview = formatPathPreview(paths);

    const list = section.createEl('ul');
    const srcItem = list.createEl('li');
    srcItem.createEl('strong', { text: 'Source: ' });
    srcItem.appendText(preview.src);

    const distItem = list.createEl('li');
    distItem.createEl('strong', { text: 'Dist: ' });
    distItem.appendText(preview.dist);

    const statusItem = list.createEl('li');
    statusItem.createEl('strong', { text: 'Status: ' });
    statusItem.appendText(preview.status);
  }

  private addToggle(
    containerEl: HTMLElement,
    name: string,
    desc: string,
    key: keyof Pick<VaultScriptsSettings, 'autoWatch' | 'showBuildNotice'>,
  ): void {
    new Setting(containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings[key]).onChange(async (value) => {
          this.host.settings[key] = value;
          await this.host.saveSettings();
        }),
      );
  }
}
