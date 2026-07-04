import { createRequire } from "node:module";
import { join } from "node:path";
import { ESBUILD_RUNTIME_DIR, LOG_PREFIX } from "~/shared/constants";

type EsbuildWasm = typeof import("esbuild-wasm");

let pluginRootAbsolute: string | undefined;
let initPromise: Promise<EsbuildWasm> | undefined;

/**
 * Must be called from Plugin.onload before any compile.
 * @param absolutePluginRoot — filesystem path to the plugin folder (not vault-relative).
 */
export function configureEsbuildPluginRoot(absolutePluginRoot: string): void {
	pluginRootAbsolute = absolutePluginRoot;
	initPromise = undefined;
}

function loadEsbuildModule(absolutePluginRoot: string): EsbuildWasm {
	const mainJs = join(absolutePluginRoot, "main.js");
	const req = createRequire(mainJs);
	const modulePath = join(
		absolutePluginRoot,
		ESBUILD_RUNTIME_DIR,
		"lib",
		"main.js",
	);
	return req(modulePath) as EsbuildWasm;
}

/**
 * Load esbuild-wasm from the plugin folder (cannot be bundled into main.js).
 */
export async function getEsbuildWasm(): Promise<EsbuildWasm> {
	if (!initPromise) {
		initPromise = (async () => {
			if (!pluginRootAbsolute) {
				throw new Error(
					`${LOG_PREFIX} esbuild-wasm: plugin root path not configured`,
				);
			}
			const esbuild = loadEsbuildModule(pluginRootAbsolute);
			await esbuild.initialize({});
			return esbuild;
		})();
	}
	return initPromise;
}

export async function stopEsbuildWasm(): Promise<void> {
	if (initPromise) {
		const esbuild = await initPromise;
		await esbuild.stop();
	}
	resetEsbuildWasmState();
}

export function resetEsbuildWasmState(): void {
	initPromise = undefined;
}

/** Test hook — absolute path to the plugin folder (must contain esbuild-wasm/). */
export function configureEsbuildPluginDirForTests(absolutePluginRoot: string): void {
	configureEsbuildPluginRoot(absolutePluginRoot);
}
