import { normalizePath, type Vault } from "obsidian";
import { joinVaultListingPath } from "./adapter-list-path";
import { LOG_PREFIX } from "~/shared/constants";
import {
	ENTRY_EXCLUDE_DIR_NAMES,
	ENTRY_EXCLUDE_FILE_PATTERNS,
	ENTRY_EXTENSIONS,
} from "./types";

function pathBaseName(vaultRelativePath: string): string {
	const normalized = vaultRelativePath.replace(/\\/g, "/").replace(/\/+$/, "");
	const slash = normalized.lastIndexOf("/");
	return slash === -1 ? normalized : normalized.slice(slash + 1);
}

function isExcludedDirName(name: string): boolean {
	return (ENTRY_EXCLUDE_DIR_NAMES as readonly string[]).includes(name);
}

/**
 * Whether a vault-relative file path under srcDir qualifies as an esbuild entry.
 */
export function isEntryFile(vaultRelativePath: string, srcDir: string): boolean {
	const normalizedSrc = srcDir.replace(/\\/g, "/").replace(/\/+$/, "");
	const normalizedPath = vaultRelativePath.replace(/\\/g, "/");

	if (
		normalizedPath !== normalizedSrc &&
		!normalizedPath.startsWith(`${normalizedSrc}/`)
	) {
		return false;
	}

	const relative = normalizedPath.slice(normalizedSrc.length).replace(/^\//, "");
	if (relative.length === 0) {
		return false;
	}

	const segments = relative.split("/");
	if (segments.some((segment) => segment.startsWith("_"))) {
		return false;
	}

	if (segments.some((segment) => isExcludedDirName(segment))) {
		return false;
	}

	const fileName = segments[segments.length - 1] ?? "";
	if (fileName.startsWith("_")) {
		return false;
	}

	if (!ENTRY_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
		return false;
	}

	return !ENTRY_EXCLUDE_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
}

/**
 * Discover esbuild entry files under srcDir via vault adapter (filesystem).
 * Uses adapter.list instead of vault.getFiles() so newly added src files are found
 * even when Obsidian metadata cache has not indexed them yet.
 */
export async function discoverEntries(
	vault: Vault,
	srcDir: string,
): Promise<string[]> {
	const normalizedSrc = normalizePath(srcDir);
	const srcExists = await vault.adapter.exists(normalizedSrc);
	if (!srcExists) {
		return [];
	}

	const entries: string[] = [];

	async function walk(dir: string): Promise<void> {
		const listing = await vault.adapter.list(normalizePath(dir));
		for (const file of listing.files) {
			const vaultRelative = joinVaultListingPath(dir, file);
			if (isEntryFile(vaultRelative, normalizedSrc)) {
				entries.push(vaultRelative);
			}
		}
		for (const folder of listing.folders) {
			const folderPath = joinVaultListingPath(dir, folder);
			if (isExcludedDirName(pathBaseName(folderPath))) {
				continue;
			}
			await walk(folderPath);
		}
	}

	try {
		await walk(normalizedSrc);
	} catch (error) {
		console.warn(`${LOG_PREFIX} entry discovery failed`, normalizedSrc, error);
		return [];
	}

	return entries.sort();
}
