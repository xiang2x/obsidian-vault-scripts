/**
 * @vitest-environment node
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { FileSystemAdapter, type Vault } from "obsidian";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { copyEsbuildWasmRuntime } from "../../scripts/copy-esbuild-wasm.mjs";
import { CompileService } from "~/compile/build-orchestrator";
import {
	configureEsbuildPluginDirForTests,
	resetEsbuildWasmState,
	stopEsbuildWasm,
} from "~/compile/esbuild-init";

const PLUGIN_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PLUGIN_DIST = nodePath.join(PLUGIN_ROOT, "dist");

function createVault(basePath: string, getFilePaths: () => string[]): Vault {
	const adapter = new FileSystemAdapter(basePath);

	return {
		adapter,
		getFiles: () => getFilePaths().map((path) => ({ path })),
	} as unknown as Vault;
}

describe("CompileService integration", () => {
	let tempRoot = "";

	beforeAll(async () => {
		await copyEsbuildWasmRuntime();
		configureEsbuildPluginDirForTests(PLUGIN_DIST);
	});

	afterEach(async () => {
		await stopEsbuildWasm().catch(() => undefined);
		resetEsbuildWasmState();
		if (tempRoot) {
			await rm(tempRoot, { recursive: true, force: true });
			tempRoot = "";
		}
	});

	it("builds dist artifacts from src entries (AC-1)", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-"));
		const srcDir = "scripts/src";
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		const srcAbs = nodePath.join(tempRoot, srcDir);
		const distAbs = nodePath.join(tempRoot, distDir);

		await mkdir(nodePath.join(srcAbs, "nested"), { recursive: true });
		await writeFile(
			nodePath.join(srcAbs, "project-report.ts"),
			"export class ProjectReport { static render() { return 'ok'; } }",
			"utf8",
		);
		await writeFile(
			nodePath.join(srcAbs, "nested", "_utils.ts"),
			"export const hidden = 1;",
			"utf8",
		);
		await mkdir(distAbs, { recursive: true });

		const vault = createVault(tempRoot, () => [`${srcDir}/project-report.ts`]);

		const compile = new CompileService({
			vault,
			paths: {
				scriptsRoot: "scripts",
				srcDir,
				distDir,
				ok: true,
			},
			showBuildNotice: false,
		});

		const result = await compile.rebuild();

		expect(result?.success).toBe(true);
		expect(result?.entryCount).toBe(1);

		const output = await readFile(
			nodePath.join(distAbs, "project-report.js"),
			"utf8",
		);
		expect(output).toContain("ProjectReport");
		expect(output).toContain("render");
	});

	it("bundles tsx imported from a ts entry (user-provided react/jsx-runtime)", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-"));
		const srcDir = "scripts/src";
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		const scriptsRoot = nodePath.join(tempRoot, "scripts");
		const srcAbs = nodePath.join(tempRoot, srcDir);
		const distAbs = nodePath.join(tempRoot, distDir);
		const reactDir = nodePath.join(scriptsRoot, "node_modules", "react");

		await mkdir(reactDir, { recursive: true });
		await writeFile(
			nodePath.join(reactDir, "package.json"),
			JSON.stringify({ name: "react", version: "0.0.0" }),
			"utf8",
		);
		await writeFile(
			nodePath.join(reactDir, "jsx-runtime.js"),
			[
				"exports.jsx = function jsx(type, props) { return { type, props }; };",
				"exports.jsxs = exports.jsx;",
				'exports.Fragment = Symbol.for("react.fragment");',
			].join("\n"),
			"utf8",
		);
		await mkdir(nodePath.join(srcAbs, "_ui"), { recursive: true });
		await mkdir(distAbs, { recursive: true });
		await writeFile(
			nodePath.join(srcAbs, "_ui", "panel.tsx"),
			'export function Panel() { return <span className="vs-panel">panel</span>; }',
			"utf8",
		);
		await writeFile(
			nodePath.join(srcAbs, "react-report.ts"),
			"import { Panel } from './_ui/panel';\nexport class ReactReport { static panel() { return Panel; } }",
			"utf8",
		);

		const vault = createVault(tempRoot, () => [`${srcDir}/react-report.ts`]);
		const compile = new CompileService({
			vault,
			paths: {
				scriptsRoot: "scripts",
				srcDir,
				distDir,
				ok: true,
			},
			showBuildNotice: false,
		});

		const result = await compile.rebuild();

		expect(result?.success).toBe(true);
		const output = await readFile(
			nodePath.join(distAbs, "react-report.js"),
			"utf8",
		);
		expect(output).toContain("ReactReport");
		expect(output).toContain("vs-panel");
	});

	it("keeps existing dist when build fails", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-"));
		const srcDir = "scripts/src";
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		const srcAbs = nodePath.join(tempRoot, srcDir);
		const distAbs = nodePath.join(tempRoot, distDir);
		const staleOutput = nodePath.join(distAbs, "stale.js");

		await mkdir(srcAbs, { recursive: true });
		await mkdir(distAbs, { recursive: true });
		await writeFile(staleOutput, "module.exports = { stale: true };", "utf8");
		await writeFile(
			nodePath.join(srcAbs, "broken.ts"),
			"export const x = <<<",
			"utf8",
		);

		const vault = createVault(tempRoot, () => [`${srcDir}/broken.ts`]);
		const compile = new CompileService({
			vault,
			paths: {
				scriptsRoot: "scripts",
				srcDir,
				distDir,
				ok: true,
			},
			showBuildNotice: false,
		});

		const result = await compile.rebuild();

		expect(result?.success).toBe(false);
		expect(await readFile(staleOutput, "utf8")).toContain("stale: true");
	});

	it("keeps prior dist after watch rebuild fails (missing dependency)", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-"));
		const srcDir = "scripts/src";
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		const srcAbs = nodePath.join(tempRoot, srcDir);
		const distAbs = nodePath.join(tempRoot, distDir);
		const logPath = nodePath.join(srcAbs, "_log.ts");
		const helloPath = nodePath.join(srcAbs, "hello.ts");
		const printPath = nodePath.join(srcAbs, "print.ts");

		await mkdir(srcAbs, { recursive: true });
		await mkdir(distAbs, { recursive: true });
		await writeFile(
			logPath,
			"export function log(message: string) { return message; }",
			"utf8",
		);
		await writeFile(
			helloPath,
			"import { log } from './_log';\nexport class Hello { static greet() { return log('hi'); } }",
			"utf8",
		);
		await writeFile(
			printPath,
			"export class Print { static print(message: string) { return message; } }",
			"utf8",
		);

		let filePaths = [`${srcDir}/hello.ts`, `${srcDir}/print.ts`, `${srcDir}/_log.ts`];
		const vault = createVault(tempRoot, () => filePaths);

		const compile = new CompileService({
			vault,
			paths: {
				scriptsRoot: "scripts",
				srcDir,
				distDir,
				ok: true,
			},
			showBuildNotice: false,
		});

		await compile.start({ watch: true });
		const initial = await compile.rebuild();
		expect(initial?.success).toBe(true);

		const helloJs = nodePath.join(distAbs, "hello.js");
		const printJs = nodePath.join(distAbs, "print.js");
		const helloBefore = await readFile(helloJs, "utf8");
		const printBefore = await readFile(printJs, "utf8");
		expect(helloBefore).toContain("Hello");
		expect(printBefore).toContain("Print");

		await rm(logPath);
		filePaths = [`${srcDir}/hello.ts`, `${srcDir}/print.ts`];

		await compile.refreshWatch();
		const failed = await compile.rebuild();

		expect(failed?.success).toBe(false);
		expect(await readFile(helloJs, "utf8")).toBe(helloBefore);
		expect(await readFile(printJs, "utf8")).toBe(printBefore);

		await compile.dispose();
	});

	it("does not rebuild on src modify after watch is disposed", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-"));
		const srcDir = "scripts/src";
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		const srcAbs = nodePath.join(tempRoot, srcDir);
		const distAbs = nodePath.join(tempRoot, distDir);
		const entryPath = nodePath.join(srcAbs, "project-report.ts");

		await mkdir(srcAbs, { recursive: true });
		await mkdir(distAbs, { recursive: true });
		await writeFile(
			entryPath,
			"export class ProjectReport { static render() { return 'ok'; } }",
			"utf8",
		);

		const vault = createVault(tempRoot, () => [`${srcDir}/project-report.ts`]);
		const compile = new CompileService({
			vault,
			paths: {
				scriptsRoot: "scripts",
				srcDir,
				distDir,
				ok: true,
			},
			showBuildNotice: false,
		});

		let buildCount = 0;
		compile.onBuildEnd(() => {
			buildCount++;
		});

		await compile.start({ watch: true });
		await compile.rebuild();
		expect(compile.hasWatchContext()).toBe(true);

		const buildsAfterWatch = buildCount;
		expect(buildsAfterWatch).toBeGreaterThan(0);

		await compile.dispose();
		expect(compile.hasWatchContext()).toBe(false);
		expect(compile.isWatchEnabled()).toBe(false);

		await compile.start({ watch: false });
		const buildsAfterDisable = buildCount;
		expect(buildsAfterDisable).toBeGreaterThan(buildsAfterWatch);

		await writeFile(
			entryPath,
			"export class ProjectReport { static render() { return 'updated'; } }",
			"utf8",
		);

		await new Promise((resolve) => setTimeout(resolve, 800));

		expect(buildCount).toBe(buildsAfterDisable);

		await compile.dispose();
	});

	it("starts watch after refreshWatch when entries appear later", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-"));
		const srcDir = "scripts/src";
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		const srcAbs = nodePath.join(tempRoot, srcDir);
		const distAbs = nodePath.join(tempRoot, distDir);

		await mkdir(srcAbs, { recursive: true });
		await mkdir(distAbs, { recursive: true });

		let filePaths: string[] = [];
		const vault = createVault(tempRoot, () => filePaths);

		const compile = new CompileService({
			vault,
			paths: {
				scriptsRoot: "scripts",
				srcDir,
				distDir,
				ok: true,
			},
			showBuildNotice: false,
		});

		await compile.start({ watch: true });
		expect(compile.hasWatchContext()).toBe(false);

		await writeFile(
			nodePath.join(srcAbs, "project-report.ts"),
			"export class ProjectReport { static render() { return 'ok'; } }",
			"utf8",
		);
		filePaths = [`${srcDir}/project-report.ts`];

		await compile.refreshWatch();
		expect(compile.hasWatchContext()).toBe(true);

		await compile.rebuild();

		const output = await readFile(
			nodePath.join(distAbs, "project-report.js"),
			"utf8",
		);
		expect(output).toContain("ProjectReport");

		await compile.dispose();
	});

	it("prunes orphan dist after entry src is removed (AC-8)", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-"));
		const srcDir = "scripts/src";
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		const srcAbs = nodePath.join(tempRoot, srcDir);
		const distAbs = nodePath.join(tempRoot, distDir);

		await mkdir(srcAbs, { recursive: true });
		await mkdir(distAbs, { recursive: true });
		await writeFile(
			nodePath.join(srcAbs, "keep.ts"),
			"export class Keep { static run() { return 'ok'; } }",
			"utf8",
		);
		await writeFile(
			nodePath.join(srcAbs, "remove-me.ts"),
			"export class RemoveMe { static run() { return 'gone'; } }",
			"utf8",
		);
		await writeFile(
			nodePath.join(distAbs, "stale-orphan.js"),
			"exports.StaleOrphan = 1;",
			"utf8",
		);

		let filePaths = [`${srcDir}/keep.ts`, `${srcDir}/remove-me.ts`];
		const vault = createVault(tempRoot, () => filePaths);

		const compile = new CompileService({
			vault,
			paths: {
				scriptsRoot: "scripts",
				srcDir,
				distDir,
				ok: true,
			},
			showBuildNotice: false,
		});

		await compile.rebuild();
		await expect(
			readFile(nodePath.join(distAbs, "remove-me.js"), "utf8"),
		).resolves.toContain("RemoveMe");

		await rm(nodePath.join(srcAbs, "remove-me.ts"));
		filePaths = [`${srcDir}/keep.ts`];

		await compile.rebuild();

		await expect(
			readFile(nodePath.join(distAbs, "keep.js"), "utf8"),
		).resolves.toContain("Keep");
		await expect(
			readFile(nodePath.join(distAbs, "remove-me.js"), "utf8"),
		).rejects.toThrow();
		await expect(
			readFile(nodePath.join(distAbs, "stale-orphan.js"), "utf8"),
		).rejects.toThrow();

		await compile.dispose();
	});
});
