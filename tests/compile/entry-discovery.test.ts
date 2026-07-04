/**
 * @vitest-environment node
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import os from "node:os";
import { FileSystemAdapter, type Vault } from "obsidian";
import { afterEach, describe, expect, it } from "vitest";
import { discoverEntries, isEntryFile } from "~/compile/entry-discovery";

function createVault(basePath: string): Vault {
	return {
		adapter: new FileSystemAdapter(basePath),
		getFiles: () => [],
	} as unknown as Vault;
}

describe("isEntryFile", () => {
	const srcDir = "scripts/src";

	it("accepts normal ts entries", () => {
		expect(isEntryFile("scripts/src/project-report.ts", srcDir)).toBe(true);
		expect(isEntryFile("scripts/src/nested/create.ts", srcDir)).toBe(true);
	});

	it("rejects _utils and nested _private paths (AC-6)", () => {
		expect(isEntryFile("scripts/src/_utils/foo.ts", srcDir)).toBe(false);
		expect(isEntryFile("scripts/src/nested/_private/bar.ts", srcDir)).toBe(
			false,
		);
		expect(isEntryFile("scripts/src/_entry.ts", srcDir)).toBe(false);
	});

	it("rejects declaration and test files", () => {
		expect(isEntryFile("scripts/src/types.d.ts", srcDir)).toBe(false);
		expect(isEntryFile("scripts/src/foo.test.ts", srcDir)).toBe(false);
		expect(isEntryFile("scripts/src/foo.test.mjs", srcDir)).toBe(false);
	});

	it("rejects files outside srcDir", () => {
		expect(isEntryFile("scripts/other/foo.ts", srcDir)).toBe(false);
	});

	it("rejects paths under node_modules", () => {
		expect(
			isEntryFile("scripts/src/node_modules/pkg/index.ts", srcDir),
		).toBe(false);
		expect(
			isEntryFile("scripts/src/nested/node_modules/foo.ts", srcDir),
		).toBe(false);
	});
});

describe("discoverEntries", () => {
	let tempRoot = "";

	afterEach(async () => {
		if (tempRoot) {
			await rm(tempRoot, { recursive: true, force: true });
			tempRoot = "";
		}
	});

	it("returns sorted vault-relative entry paths via adapter.list", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-entries-"));
		const srcDir = "900-vault/scripts-v2/src";
		const srcAbs = nodePath.join(tempRoot, srcDir);

		await mkdir(nodePath.join(srcAbs, "nested"), { recursive: true });
		await mkdir(nodePath.join(srcAbs, "_utils"), { recursive: true });
		await writeFile(nodePath.join(srcAbs, "z-last.ts"), "export const z = 1;", "utf8");
		await writeFile(nodePath.join(srcAbs, "a-first.ts"), "export const a = 1;", "utf8");
		await writeFile(nodePath.join(srcAbs, "_utils", "helper.ts"), "export const h = 1;", "utf8");
		await writeFile(nodePath.join(srcAbs, "a-first.test.ts"), "test", "utf8");

		const vault = createVault(tempRoot);

		await expect(discoverEntries(vault, srcDir)).resolves.toEqual([
			"900-vault/scripts-v2/src/a-first.ts",
			"900-vault/scripts-v2/src/z-last.ts",
		]);
	});

	it("finds files even when vault.getFiles() is empty", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-entries-"));
		const srcDir = "scripts/src";
		const srcAbs = nodePath.join(tempRoot, srcDir);

		await mkdir(srcAbs, { recursive: true });
		await writeFile(nodePath.join(srcAbs, "print.ts"), "export class Print {}", "utf8");

		const vault = createVault(tempRoot);
		await expect(discoverEntries(vault, srcDir)).resolves.toEqual([
			"scripts/src/print.ts",
		]);
	});

	it("handles adapter.list returning vault-relative file paths", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-entries-"));
		const srcDir = "900-vault/scripts-v2/src";

		const vault = {
			adapter: {
				exists: async () => true,
				list: async (dir: string) => {
					if (dir === srcDir) {
						return {
							files: [`${srcDir}/print.ts`],
							folders: [],
						};
					}
					return { files: [], folders: [] };
				},
			},
			getFiles: () => [],
		} as unknown as import("obsidian").Vault;

		await expect(discoverEntries(vault, srcDir)).resolves.toEqual([
			"900-vault/scripts-v2/src/print.ts",
		]);
	});

	it("skips node_modules when walking srcDir", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-entries-"));
		const srcDir = "scripts/src";
		const srcAbs = nodePath.join(tempRoot, srcDir);
		const nmAbs = nodePath.join(srcAbs, "node_modules", "lodash");

		await mkdir(nmAbs, { recursive: true });
		await writeFile(nodePath.join(srcAbs, "print.ts"), "export class Print {}", "utf8");
		await writeFile(
			nodePath.join(nmAbs, "index.ts"),
			"export const lodash = 1;",
			"utf8",
		);

		const vault = createVault(tempRoot);
		await expect(discoverEntries(vault, srcDir)).resolves.toEqual([
			"scripts/src/print.ts",
		]);
	});
});
