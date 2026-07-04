import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const destRoot = path.join(projectRoot, "dist", "esbuild-wasm");

/**
 * Minimal runtime layout required by esbuild-wasm (lib/main.js spawns ../bin/esbuild).
 */
const RUNTIME_FILES = [
	{ src: "package.json", dest: "package.json" },
	{ src: "lib/main.js", dest: "lib/main.js" },
	{ src: "bin/esbuild", dest: "bin/esbuild" },
	{ src: "esbuild.wasm", dest: "esbuild.wasm" },
	{ src: "wasm_exec_node.js", dest: "wasm_exec_node.js" },
	{ src: "wasm_exec.js", dest: "wasm_exec.js" },
];

/**
 * Ship esbuild-wasm beside main.js (cannot be bundled; uses one WASM for all platforms).
 */
export async function copyEsbuildWasmRuntime() {
	const pkgDir = path.dirname(require.resolve("esbuild-wasm/package.json"));
	await mkdir(destRoot, { recursive: true });

	for (const { src, dest } of RUNTIME_FILES) {
		const target = path.join(destRoot, dest);
		await mkdir(path.dirname(target), { recursive: true });
		await cp(path.join(pkgDir, src), target, { force: true });
	}

	console.log("[vault-scripts] copied esbuild-wasm runtime to dist/esbuild-wasm");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await copyEsbuildWasmRuntime();
}
