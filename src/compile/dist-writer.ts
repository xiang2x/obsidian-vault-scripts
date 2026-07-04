import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type * as esbuild from "esbuild-wasm";

/**
 * Persist esbuild in-memory outputs to disk. Used with `write: false` so failed
 * watch rebuilds (esbuild 0.25+) never delete existing dist artifacts.
 */
export async function writeBuildOutputs(
	result: esbuild.BuildResult,
): Promise<void> {
	const files = result.outputFiles;
	if (!files?.length) {
		return;
	}

	for (const file of files) {
		await mkdir(dirname(file.path), { recursive: true });
		await writeFile(file.path, file.contents);
	}
}
