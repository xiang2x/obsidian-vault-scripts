/** Shared helper — `_` prefix dirs are not esbuild entries (AC-6). */
export function formatTitle(title: string): string {
	return title.trim().toUpperCase();
}
