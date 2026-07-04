import type { CachedModule } from "./types";

/**
 * In-memory module cache keyed by absolute dist path + mtime.
 */
export class ModuleCache {
	private readonly entries = new Map<string, CachedModule>();

	get(path: string, mtimeMs: number): Record<string, unknown> | undefined {
		const cached = this.entries.get(path);
		if (!cached || cached.mtimeMs !== mtimeMs) {
			return undefined;
		}
		return cached.exports;
	}

	set(path: string, mtimeMs: number, exports: Record<string, unknown>): void {
		this.entries.set(path, { mtimeMs, exports });
	}

	invalidate(all = false): void {
		if (all) {
			this.entries.clear();
			return;
		}
	}
}
