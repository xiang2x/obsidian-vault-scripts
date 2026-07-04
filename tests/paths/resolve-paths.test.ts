import type { Vault } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "#/settings";
import { resolvePaths } from "#/paths/resolve-paths";

const MANIFEST_DIR = ".obsidian/plugins/vault-scripts";

function createVault(exists: (path: string) => boolean): Vault {
	return {
		adapter: {
			exists: vi.fn(async (path: string) => exists(path)),
		},
	} as unknown as Vault;
}

describe("resolvePaths", () => {
	describe("distDir", () => {
		it("always resolves distDir under manifestDir", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => false),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths.distDir).toBe(".obsidian/plugins/vault-scripts/dist");
		});

		it("normalizes messy manifestDir before joining dist", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => false),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "" },
				manifestDir: ".obsidian//plugins\\vault-scripts/",
			});

			expect(paths.distDir).toBe(".obsidian/plugins/vault-scripts/dist");
		});

		it("still resolves distDir when scriptsRoot validation fails", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => false),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "../escape" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths.distDir).toBe(".obsidian/plugins/vault-scripts/dist");
			expect(paths.ok).toBe(false);
		});
	});

	describe("scriptsRoot validation", () => {
		it("returns ok=false for empty scriptsRoot", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => true),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths).toMatchObject({
				scriptsRoot: null,
				srcDir: null,
				ok: false,
				reason: "Scripts root cannot be empty.",
			});
		});

		it("returns ok=false for whitespace-only scriptsRoot", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => true),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "   \t  " },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths).toMatchObject({
				scriptsRoot: null,
				srcDir: null,
				ok: false,
				reason: "Scripts root cannot be empty.",
			});
		});

		it("rejects scriptsRoot that escapes the vault via .. prefix", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => true),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "../scripts" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths.ok).toBe(false);
			expect(paths.reason).toBe("Path must stay inside the vault.");
			expect(paths.scriptsRoot).toBeNull();
			expect(paths.srcDir).toBeNull();
		});

		it("rejects scriptsRoot containing /../ segments", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => true),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "scripts/../escape" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths.ok).toBe(false);
			expect(paths.reason).toBe("Path must stay inside the vault.");
			expect(paths.scriptsRoot).toBeNull();
		});

		it("rejects traversal dots embedded in scriptsRoot", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => true),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "scripts/foo..bar" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths.ok).toBe(false);
			expect(paths.reason).toBe("Path cannot contain '..'.");
			expect(paths.scriptsRoot).toBeNull();
		});

		it("rejects trailing .. segment in scriptsRoot", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => true),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "scripts/.." },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths.ok).toBe(false);
			expect(paths.reason).toBe("Path cannot contain '..'.");
			expect(paths.scriptsRoot).toBeNull();
		});

		it("normalizes leading slash in scriptsRoot instead of rejecting", async () => {
			const paths = await resolvePaths({
				vault: createVault((path) => path === "scripts/src"),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "/scripts" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths).toEqual({
				scriptsRoot: "scripts",
				srcDir: "scripts/src",
				distDir: ".obsidian/plugins/vault-scripts/dist",
				ok: true,
			});
		});

		it("normalizes leading backslash in scriptsRoot instead of rejecting", async () => {
			const paths = await resolvePaths({
				vault: createVault((path) => path === "scripts/src"),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "\\scripts" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths).toEqual({
				scriptsRoot: "scripts",
				srcDir: "scripts/src",
				distDir: ".obsidian/plugins/vault-scripts/dist",
				ok: true,
			});
		});

		it("rejects Windows drive-letter scriptsRoot", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => true),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "C:\\vault\\scripts" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths.ok).toBe(false);
			expect(paths.reason).toBe("Path must be relative to the vault root.");
			expect(paths.scriptsRoot).toBeNull();
		});
	});

	describe("successful resolution", () => {
		it("resolves normal scriptsRoot and srcDir", async () => {
			const paths = await resolvePaths({
				vault: createVault((path) => path === "900-vault/scripts/src"),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "900-vault/scripts" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths).toEqual({
				scriptsRoot: "900-vault/scripts",
				srcDir: "900-vault/scripts/src",
				distDir: ".obsidian/plugins/vault-scripts/dist",
				ok: true,
			});
		});

		it("resolves default scriptsRoot when src exists", async () => {
			const paths = await resolvePaths({
				vault: createVault((path) => path === "scripts/src"),
				settings: DEFAULT_SETTINGS,
				manifestDir: MANIFEST_DIR,
			});

			expect(paths).toEqual({
				scriptsRoot: "scripts",
				srcDir: "scripts/src",
				distDir: ".obsidian/plugins/vault-scripts/dist",
				ok: true,
			});
		});

		it("normalizes messy scriptsRoot before resolving srcDir", async () => {
			const paths = await resolvePaths({
				vault: createVault((path) => path === "900-vault/scripts/src"),
				settings: {
					...DEFAULT_SETTINGS,
					scriptsRoot: "  900-vault//scripts\\  ",
				},
				manifestDir: MANIFEST_DIR,
			});

			expect(paths).toEqual({
				scriptsRoot: "900-vault/scripts",
				srcDir: "900-vault/scripts/src",
				distDir: ".obsidian/plugins/vault-scripts/dist",
				ok: true,
			});
		});

		it("checks vault adapter for normalized srcDir", async () => {
			const vault = createVault((path) => path === "scripts/src");
			await resolvePaths({
				vault,
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "scripts" },
				manifestDir: MANIFEST_DIR,
			});

			expect(vault.adapter.exists).toHaveBeenCalledOnce();
			expect(vault.adapter.exists).toHaveBeenCalledWith("scripts/src");
		});
	});

	describe("missing src directory", () => {
		it("returns srcDir but ok=false when src folder is missing", async () => {
			const paths = await resolvePaths({
				vault: createVault(() => false),
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "scripts" },
				manifestDir: MANIFEST_DIR,
			});

			expect(paths.scriptsRoot).toBe("scripts");
			expect(paths.srcDir).toBe("scripts/src");
			expect(paths.ok).toBe(false);
			expect(paths.reason).toBeUndefined();
		});

		it("does not call vault adapter when scriptsRoot is invalid", async () => {
			const vault = createVault(() => true);
			await resolvePaths({
				vault,
				settings: { ...DEFAULT_SETTINGS, scriptsRoot: "../scripts" },
				manifestDir: MANIFEST_DIR,
			});

			expect(vault.adapter.exists).not.toHaveBeenCalled();
		});
	});
});
