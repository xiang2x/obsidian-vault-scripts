import { VS_DIST_MISSING } from "~/shared/constants";
import { evalCjs } from "./cjs-evaluator";
import { ModuleCache } from "./module-cache";
import { pluginRequire } from "./require-shim";
import type { FsReader, LoadResult } from "./types";

export class ModuleLoader {
	private readonly cache = new ModuleCache();

	constructor(private readonly fs: FsReader) {}

	async loadModule(absoluteDistPath: string): Promise<LoadResult> {
		return this.loadWithRetry(absoluteDistPath, false);
	}

	invalidate(all = false): void {
		this.cache.invalidate(all);
	}

	private async loadWithRetry(
		absoluteDistPath: string,
		isRetry: boolean,
	): Promise<LoadResult> {
		try {
			const { mtimeMs } = await this.fs.stat(absoluteDistPath);
			const cached = this.cache.get(absoluteDistPath, mtimeMs);
			if (cached) {
				return { exports: cached, fromCache: true };
			}

			const code = await this.fs.read(absoluteDistPath);
			const exports = evalCjs(code, { require: pluginRequire });
			this.cache.set(absoluteDistPath, mtimeMs, exports);
			return { exports, fromCache: false };
		} catch (error) {
			if (!isRetry) {
				return this.loadWithRetry(absoluteDistPath, true);
			}

			throw new Error(
				`${VS_DIST_MISSING}: failed to load ${absoluteDistPath}: ${String(error)}`,
			);
		}
	}
}
