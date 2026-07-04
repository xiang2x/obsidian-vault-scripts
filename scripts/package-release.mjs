import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const distDir = path.join(projectRoot, "dist");

/**
 * Build an installable plugin folder + zip for GitHub Release / BRAT.
 */
export async function packageRelease() {
	const manifest = JSON.parse(
		await readFile(path.join(projectRoot, "manifest.json"), "utf8"),
	);
	const version = manifest.version;
	const releaseRoot = path.join(distDir, "release");
	const pluginDir = path.join(releaseRoot, "vault-scripts");
	const zipPath = path.join(distDir, `vault-scripts-${version}.zip`);

	await rm(releaseRoot, { recursive: true, force: true });
	await mkdir(pluginDir, { recursive: true });

	await cp(path.join(distDir, "main.js"), path.join(pluginDir, "main.js"));
	await cp(path.join(distDir, "manifest.json"), path.join(pluginDir, "manifest.json"));
	await cp(path.join(distDir, "esbuild-wasm"), path.join(pluginDir, "esbuild-wasm"), {
		recursive: true,
	});

	await rm(zipPath, { force: true });
	await execFileAsync("zip", ["-rq", zipPath, "vault-scripts"], { cwd: releaseRoot });

	console.log(`[vault-scripts] release package: ${zipPath}`);
	return { zipPath, version, pluginDir };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	await packageRelease();
}
