import { normalizePath } from "obsidian";

/**
 * Combine adapter.list(dir) results with the listed directory.
 * Some adapters return bare filenames; others return vault-relative paths.
 */
export function joinVaultListingPath(dir: string, name: string): string {
	const normalizedDir = normalizePath(dir);
	const normalizedName = normalizePath(name);

	if (
		normalizedName === normalizedDir ||
		normalizedName.startsWith(`${normalizedDir}/`)
	) {
		return normalizedName;
	}

	return normalizePath(`${normalizedDir}/${normalizedName}`);
}
