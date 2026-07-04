import { normalizePath, type Vault } from "obsidian";
import { joinVaultListingPath } from "~/compile/adapter-list-path";
import { toAbsoluteVaultPath } from "~/compile/vault-paths";

/**
 * List compiled `.js` artifacts under dist using the vault adapter (Desktop + Mobile).
 */
export async function listDistJsFiles(
	vault: Vault,
	distDirVaultRelative: string,
): Promise<string[]> {
	const files: string[] = [];

	async function walk(dir: string): Promise<void> {
		const listing = await vault.adapter.list(normalizePath(dir));
		for (const file of listing.files) {
			if (file.endsWith(".js")) {
				files.push(joinVaultListingPath(dir, file));
			}
		}
		for (const folder of listing.folders) {
			await walk(joinVaultListingPath(dir, folder));
		}
	}

	await walk(distDirVaultRelative);
	return files
		.map((vaultRelative) => toAbsoluteVaultPath(vault, vaultRelative))
		.sort();
}
