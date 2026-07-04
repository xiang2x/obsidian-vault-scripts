import { DEFAULT_SETTINGS, type VaultScriptsSettings } from './types';

import type { Plugin } from 'obsidian';

/**
 * 读写 data.json，merge 默认值。
 */
export class SettingsStore {
  constructor(private readonly plugin: Plugin) {}

  async load(): Promise<VaultScriptsSettings> {
    const stored = (await this.plugin.loadData()) as
      | Partial<VaultScriptsSettings>
      | null
      | undefined;
    return Object.assign({}, DEFAULT_SETTINGS, stored ?? {});
  }

  async save(settings: VaultScriptsSettings): Promise<void> {
    await this.plugin.saveData(settings);
  }
}
