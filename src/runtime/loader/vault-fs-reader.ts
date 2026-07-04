import { relative } from 'node:path';
import { FileSystemAdapter, normalizePath, type Vault } from 'obsidian';

import type { FsReader } from './types';

function toVaultRelativePath(vault: Vault, absolutePath: string): string {
  const { adapter } = vault;
  if (adapter instanceof FileSystemAdapter) {
    return normalizePath(relative(adapter.getBasePath(), absolutePath));
  }
  return normalizePath(absolutePath);
}

export class VaultFsReader implements FsReader {
  constructor(private readonly vault: Vault) {}

  async stat(absolutePath: string): Promise<{ mtimeMs: number }> {
    const rel = toVaultRelativePath(this.vault, absolutePath);
    const stat = await this.vault.adapter.stat(rel);
    if (!stat) {
      throw new Error(`Missing file: ${rel}`);
    }
    return { mtimeMs: stat.mtime };
  }

  async read(absolutePath: string): Promise<string> {
    const rel = toVaultRelativePath(this.vault, absolutePath);
    return this.vault.adapter.read(rel);
  }
}
