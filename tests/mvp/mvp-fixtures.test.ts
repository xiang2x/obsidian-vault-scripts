/**
 * @vitest-environment node
 */
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { FileSystemAdapter, type Vault } from "obsidian";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { copyEsbuildWasmRuntime } from "../../scripts/copy-esbuild-wasm.mjs";
import { CompileService } from "~/compile/build-orchestrator";
import { discoverEntries } from "~/compile/entry-discovery";
import {
	configureEsbuildPluginDirForTests,
	resetEsbuildWasmState,
	stopEsbuildWasm,
} from "~/compile/esbuild-init";
import { toAbsoluteVaultPath } from "~/compile/vault-paths";
import { CommandRegistrar } from "~/runtime/commands/command-registrar";
import { createInvokeCommandId } from "~/runtime/commands/invoke-command-factory";
import { ModuleLoader } from "~/runtime/loader/module-loader";
import { VaultFsReader } from "~/runtime/loader/vault-fs-reader";
import { ExportRegistry } from "~/runtime/registry/export-registry";
import { createVsProxy } from "~/runtime/proxy/vs-proxy";

const PLUGIN_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PLUGIN_DIST = nodePath.join(PLUGIN_ROOT, "dist");
const FIXTURE_SCRIPTS = nodePath.join(PLUGIN_ROOT, "fixtures", "scripts");

const SCRIPTS_ROOT = "scripts";
const SRC_DIR = `${SCRIPTS_ROOT}/src`;
const DIST_DIR = ".obsidian/plugins/vault-scripts/dist";

function createVault(basePath: string): Vault {
	return {
		adapter: new FileSystemAdapter(basePath),
		getFiles: () => [],
	} as unknown as Vault;
}

async function seedFixtureVault(tempRoot: string): Promise<void> {
	await cp(FIXTURE_SCRIPTS, nodePath.join(tempRoot, SCRIPTS_ROOT), {
		recursive: true,
	});
	await mkdir(nodePath.join(tempRoot, DIST_DIR), { recursive: true });
}

describe("MVP fixtures (AC-1～AC-6)", () => {
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

	it("AC-1: compiles fixture entries to dist", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-mvp-"));
		await seedFixtureVault(tempRoot);

		const compile = new CompileService({
			vault: createVault(tempRoot),
			paths: {
				scriptsRoot: SCRIPTS_ROOT,
				srcDir: SRC_DIR,
				distDir: DIST_DIR,
				ok: true,
			},
			showBuildNotice: false,
		});

		const result = await compile.rebuild();
		expect(result?.success).toBe(true);
		expect(result?.entryCount).toBe(2);

		const reportJs = await readFile(
			nodePath.join(tempRoot, DIST_DIR, "project-report.js"),
			"utf8",
		);
		const createJs = await readFile(
			nodePath.join(tempRoot, DIST_DIR, "actions", "create-project.js"),
			"utf8",
		);

		expect(reportJs).toContain("ProjectReport");
		expect(createJs).toContain("CreateProject");
	});

	it("AC-6: discovers entries only; _utils is bundled not listed", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-mvp-"));
		await seedFixtureVault(tempRoot);

		const entries = await discoverEntries(createVault(tempRoot), SRC_DIR);
		expect(entries).toEqual([
			`${SRC_DIR}/actions/create-project.ts`,
			`${SRC_DIR}/project-report.ts`,
		]);

		const compile = new CompileService({
			vault: createVault(tempRoot),
			paths: {
				scriptsRoot: SCRIPTS_ROOT,
				srcDir: SRC_DIR,
				distDir: DIST_DIR,
				ok: true,
			},
			showBuildNotice: false,
		});
		await compile.rebuild();

		const reportJs = await readFile(
			nodePath.join(tempRoot, DIST_DIR, "project-report.js"),
			"utf8",
		);
		expect(reportJs).toContain("formatTitle");
		await expect(
			readFile(nodePath.join(tempRoot, DIST_DIR, "_utils", "format-title.js")),
		).rejects.toThrow();
	});

	it("AC-2: vs.ProjectReport.render via runtime", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-mvp-"));
		await seedFixtureVault(tempRoot);

		const vault = createVault(tempRoot);
		const compile = new CompileService({
			vault,
			paths: {
				scriptsRoot: SCRIPTS_ROOT,
				srcDir: SRC_DIR,
				distDir: DIST_DIR,
				ok: true,
			},
			showBuildNotice: false,
		});
		await compile.rebuild();

		const loader = new ModuleLoader(new VaultFsReader(vault));
		const registry = new ExportRegistry(vault, {
			scriptsRoot: SCRIPTS_ROOT,
			srcDir: SRC_DIR,
			distDir: DIST_DIR,
			ok: true,
		}, loader);
		await registry.reindexFromDist();

		const vs = createVsProxy(registry, loader);
		const render = (vs.ProjectReport as {
			render: (
				container: HTMLElement,
				ctx: { title?: string },
			) => Promise<void>;
		}).render;

		const created: Array<{ tag: string; text?: string }> = [];
		const root = {
			createEl: (tag: string, opts?: { text?: string }) => {
				created.push({ tag, text: opts?.text });
				return root;
			},
		};
		const container = {
			empty: vi.fn(),
			createDiv: vi.fn(() => root),
		} as unknown as HTMLElement;

		await render(container, { title: "status" });

		expect(container.empty).toHaveBeenCalled();
		expect(created.some((el) => el.tag === "h3" && el.text === "STATUS")).toBe(
			true,
		);
	});

	it("AC-3: registers invoke command for CreateProject", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-mvp-"));
		await seedFixtureVault(tempRoot);

		const vault = createVault(tempRoot);
		const compile = new CompileService({
			vault,
			paths: {
				scriptsRoot: SCRIPTS_ROOT,
				srcDir: SRC_DIR,
				distDir: DIST_DIR,
				ok: true,
			},
			showBuildNotice: false,
		});
		await compile.rebuild();

		const loader = new ModuleLoader(new VaultFsReader(vault));
		const registry = new ExportRegistry(vault, {
			scriptsRoot: SCRIPTS_ROOT,
			srcDir: SRC_DIR,
			distDir: DIST_DIR,
			ok: true,
		}, loader);
		const snapshot = await registry.reindexFromDist();
		const createEntry = snapshot.active.find(
			(entry) => entry.exportName === "CreateProject",
		);
		expect(createEntry?.hasInvoke).toBe(true);

		const vs = createVsProxy(registry, loader);
		const addCommand = vi.fn();
		const plugin = { addCommand, removeCommand: vi.fn() } as never;
		const registrar = new CommandRegistrar(plugin, {} as never, () => vs);
		registrar.registerAll(snapshot.active);

		expect(addCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				id: createInvokeCommandId("CreateProject"),
				name: "Vault Scripts: CreateProject",
			}),
		);
	});

	it("AC-5: rebuild picks up src changes", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-mvp-"));
		await seedFixtureVault(tempRoot);

		const reportPath = nodePath.join(tempRoot, SRC_DIR, "project-report.ts");
		const vault = createVault(tempRoot);
		const compile = new CompileService({
			vault,
			paths: {
				scriptsRoot: SCRIPTS_ROOT,
				srcDir: SRC_DIR,
				distDir: DIST_DIR,
				ok: true,
			},
			showBuildNotice: false,
		});

		await compile.rebuild();
		const distPath = nodePath.join(tempRoot, DIST_DIR, "project-report.js");
		const before = await readFile(distPath, "utf8");
		expect(before).toContain("fixture");

		const source = await readFile(reportPath, "utf8");
		await writeFile(
			reportPath,
			source.replace("fixture", "fixture-hot-reload"),
			"utf8",
		);

		await compile.rebuild();
		const after = await readFile(distPath, "utf8");
		expect(after).toContain("fixture-hot-reload");
		expect(after).not.toBe(before);

		const absoluteDist = toAbsoluteVaultPath(
			vault,
			`${DIST_DIR}/project-report.js`,
		);
		expect(absoluteDist).toContain("project-report.js");
	});
});
