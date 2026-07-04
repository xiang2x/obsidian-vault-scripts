import { join } from "node:path";
import { FileSystemAdapter, normalizePath, type Vault } from "obsidian";

/** Vault-relative path → absolute filesystem path (Desktop). */
export function toAbsoluteVaultPath(
  vault: Vault,
  vaultRelativePath: string,
): string {
  const normalized = normalizePath(vaultRelativePath);
  const { adapter } = vault;

  if (adapter instanceof FileSystemAdapter) {
    return join(adapter.getBasePath(), normalized);
  }

  return normalized;
}
