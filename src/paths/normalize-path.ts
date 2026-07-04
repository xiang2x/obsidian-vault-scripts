import { normalizePath } from "obsidian";

export function joinPath(...segments: string[]): string {
	const parts = segments
		.flatMap((segment) => segment.replace(/\\/g, "/").split("/"))
		.filter((segment) => segment.length > 0 && segment !== ".");
	return normalizePath(parts.join("/"));
}

/** Whether `childPath` is `parentDir` or nested under it (vault-relative). */
export function isPathUnder(childPath: string, parentDir: string): boolean {
	const child = normalizePath(childPath);
	const parent = normalizePath(parentDir).replace(/\/+$/, "");
	if (parent.length === 0) {
		return child.length > 0;
	}
	return child === parent || child.startsWith(`${parent}/`);
}
