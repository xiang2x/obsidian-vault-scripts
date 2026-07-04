/**
 * @vitest-environment node
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import os from "node:os";
import { FileSystemAdapter, type Vault } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toAbsoluteVaultPath } from "~/compile/vault-paths";
import { ModuleLoader } from "~/runtime/loader/module-loader";
import { VaultFsReader } from "~/runtime/loader/vault-fs-reader";
import { ExportRegistry } from "~/runtime/registry/export-registry";
import { createVsProxy } from "~/runtime/proxy/vs-proxy";

function createVault(basePath: string, distFiles: Record<string, string>): Vault {
	const adapter = new FileSystemAdapter(basePath);

	return {
		adapter: Object.assign(adapter, {
			list: vi.fn(async (dir: string) => {
				const prefix = dir.endsWith("/") ? dir : `${dir}/`;
				const files: string[] = [];
				const folders = new Set<string>();

				for (const relPath of Object.keys(distFiles)) {
					if (!relPath.startsWith(prefix)) {
						continue;
					}
					const rest = relPath.slice(prefix.length);
					const slash = rest.indexOf("/");
					if (slash === -1) {
						files.push(rest);
					} else {
						folders.add(rest.slice(0, slash));
					}
				}

				return { files, folders: [...folders] };
			}),
		}),
		getFiles: () => [],
	} as unknown as Vault;
}

describe("Runtime integration", () => {
	let tempRoot = "";

	afterEach(async () => {
		if (tempRoot) {
			await rm(tempRoot, { recursive: true, force: true });
			tempRoot = "";
		}
	});

	it("reindexes dist and invokes static export (AC-2 slice)", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-runtime-"));
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		const distRel = `${distDir}/project-report.js`;
		const distAbs = nodePath.join(tempRoot, distRel);

		await mkdir(nodePath.dirname(distAbs), { recursive: true });
		await writeFile(
			distAbs,
			`exports.ProjectReport = class ProjectReport { static render() { return "ok"; } };`,
			"utf8",
		);

		const vault = createVault(tempRoot, { [distRel]: distRel });
		const paths = {
			scriptsRoot: "scripts",
			srcDir: "scripts/src",
			distDir,
			ok: true,
		};

		const loader = new ModuleLoader(new VaultFsReader(vault));
		const registry = new ExportRegistry(vault, paths, loader);
		const snapshot = await registry.reindexFromDist();

		expect(snapshot.active).toHaveLength(1);
		expect(snapshot.active[0]?.exportName).toBe("ProjectReport");

		const vs = createVsProxy(registry, loader);
		const absoluteDist = toAbsoluteVaultPath(vault, distRel);
		expect(absoluteDist).toContain("project-report.js");

		const render = (vs.ProjectReport as { render: () => Promise<string> }).render;
		await expect(render()).resolves.toBe("ok");
	});
});
