import { Plugin } from 'obsidian';

import {
  LifecycleManager,
  type VaultScriptsPluginApi,
  type VaultScriptsPluginHost,
} from './plugin-host';

import type { VaultScriptsSettings } from './settings';

export default class VaultScriptsPlugin extends Plugin implements VaultScriptsPluginHost {
  settings!: VaultScriptsSettings;
  api!: VaultScriptsPluginApi;

  private readonly lifecycle = new LifecycleManager();

  async onload(): Promise<void> {
    await this.lifecycle.onload(this);
  }

  onunload(): void {
    this.lifecycle.onunload();
  }

  async saveSettings(): Promise<void> {
    // Assigned in LifecycleManager.onload
  }
}
