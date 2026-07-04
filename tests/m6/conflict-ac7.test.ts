/**
 * @vitest-environment node
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import os from "node:os";
import { FileSystemAdapter, type Vault } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyExportConflicts } from "~/plugin-host/build-event-handler";
import { CommandRegistrar } from "~/runtime/commands/command-registrar";
import { ModuleLoader } from "~/runtime/loader/module-loader";
import { VaultFsReader } from "~/runtime/loader/vault-fs-reader";
import { ExportRegistry } from "~/runtime/registry/export-registry";
import { createVsProxy } from "~/runtime/proxy/vs-proxy";
import {
	NOTICE_EXPORT_CONFLICT,
	VS_EXPORT_CONFLICT,
} from "~/shared/constants";

function createVault(basePath: string): Vault {
	return {
		adapter: new FileSystemAdapter(basePath),
		getFiles: () => [],
	} as unknown as Vault;
}

describe("AC-7 export conflicts", () => {
	let tempRoot = "";

	afterEach(async () => {
		if (tempRoot) {
			await rm(tempRoot, { recursive: true, force: true });
			tempRoot = "";
		}
	});

	it("reindex marks conflicts and disables vs.Report", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-ac7-"));
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		const distAbs = nodePath.join(tempRoot, distDir);

		await mkdir(distAbs, { recursive: true });
		await writeFile(
			nodePath.join(distAbs, "a.js"),
			`exports.Report = class Report { static render() { return "a"; } };`,
			"utf8",
		);
		await writeFile(
			nodePath.join(distAbs, "b.js"),
			`exports.Report = class Report { static render() { return "b"; } };`,
			"utf8",
		);

		const vault = createVault(tempRoot);
		const paths = {
			scriptsRoot: "scripts",
			srcDir: "scripts/src",
			distDir,
			ok: true,
		};
		const loader = new ModuleLoader(new VaultFsReader(vault));
		const registry = new ExportRegistry(vault, paths, loader);
		const snapshot = await registry.reindexFromDist();

		expect(snapshot.conflicts).toEqual([
			{
				exportName: "Report",
				paths: expect.arrayContaining([
					expect.stringContaining("a.js"),
					expect.stringContaining("b.js"),
				]),
			},
		]);
		expect(snapshot.active).toHaveLength(0);
		expect(registry.hasConflict("Report")).toBe(true);
		expect(registry.getEntry("Report")).toBeUndefined();

		const vs = createVsProxy(registry, loader);
		expect(() => vs.Report).toThrow(VS_EXPORT_CONFLICT);
	});

	it("shows Notice for conflicting export names", () => {
		const notices: string[] = [];
		notifyExportConflicts(
			[{ exportName: "Report", paths: ["/dist/a.js", "/dist/b.js"] }],
			(message) => notices.push(message),
		);
		expect(notices).toEqual([NOTICE_EXPORT_CONFLICT]);
	});

	it("registers invoke only for active exports from registry snapshot", () => {
		const addCommand = vi.fn();
		const plugin = { addCommand, removeCommand: vi.fn() } as never;
		const registrar = new CommandRegistrar(plugin, {} as never, () => ({}));
		registrar.registerAll([
			{
				exportName: "CreateProject",
				distPath: "/dist/create-project.js",
				hasInvoke: true,
				status: "active",
			},
		]);

		expect(addCommand).toHaveBeenCalledTimes(1);
		expect(addCommand).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Vault Scripts: CreateProject" }),
		);
	});
});
