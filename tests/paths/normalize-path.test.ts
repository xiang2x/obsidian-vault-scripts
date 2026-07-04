import { describe, expect, it } from "vitest";
import { joinPath } from "#/paths/normalize-path";
import { normalizePath } from "obsidian";

describe("normalizePath", () => {
	it("normalizes slashes and trims edges", () => {
		expect(normalizePath("foo//bar/")).toBe("foo/bar");
		expect(normalizePath("\\scripts\\src")).toBe("scripts/src");
	});
});

describe("joinPath", () => {
	it("joins vault-relative segments", () => {
		expect(joinPath(".obsidian/plugins/vault-scripts", "dist")).toBe(
			".obsidian/plugins/vault-scripts/dist",
		);
		expect(joinPath("900-vault/scripts", "src")).toBe("900-vault/scripts/src");
	});
});
