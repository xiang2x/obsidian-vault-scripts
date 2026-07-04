import type * as esbuild from "esbuild-wasm";
import { OBSIDIAN_EXTERNALS } from "./externals";
import { getEsbuildWasm } from "./esbuild-init";

export interface EsbuildPaths {
	entryAbsPaths: string[];
	srcDirAbsolute: string;
	distDirAbsolute: string;
}

/** Shared options for user-script bundles (React etc. are resolved from user node_modules). */
export const USER_SCRIPT_ESBUILD_OPTIONS = {
	loader: {
		".tsx": "tsx",
		".jsx": "jsx",
	} as const,
	jsx: "automatic" as const,
};

export function createEsbuildOptions(
	paths: EsbuildPaths,
): esbuild.BuildOptions {
	return {
		entryPoints: paths.entryAbsPaths,
		outdir: paths.distDirAbsolute,
		outbase: paths.srcDirAbsolute,
		bundle: true,
		format: "cjs",
		platform: "neutral",
		target: "es2020",
		sourcemap: true,
		external: OBSIDIAN_EXTERNALS,
		logLevel: "silent",
		write: false,
		...USER_SCRIPT_ESBUILD_OPTIONS,
	};
}

export async function runEsbuildBuild(
	paths: EsbuildPaths,
): Promise<esbuild.BuildResult> {
	const esbuild = await getEsbuildWasm();
	return esbuild.build(createEsbuildOptions(paths));
}

export async function createEsbuildContext(
	paths: EsbuildPaths,
	onEnd: (result: esbuild.BuildResult) => void | Promise<void>,
): Promise<esbuild.BuildContext> {
	const esbuild = await getEsbuildWasm();
	return esbuild.context({
		...createEsbuildOptions(paths),
		plugins: [
			{
				name: "vault-scripts-on-end",
				setup(build) {
					build.onEnd((result) => {
						void onEnd(result);
					});
				},
			},
		],
	});
}
