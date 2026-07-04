import { describe, expect, it } from "vitest";
import { formatPathPreview } from "~/settings/path-preview";

describe("formatPathPreview", () => {
	it("shows resolved src and dist when ok", () => {
		expect(
			formatPathPreview({
				scriptsRoot: "scripts",
				srcDir: "scripts/src",
				distDir: ".obsidian/plugins/vault-scripts/dist",
				ok: true,
			}),
		).toEqual({
			src: "scripts/src",
			dist: ".obsidian/plugins/vault-scripts/dist",
			status: "Source directory exists",
		});
	});

	it("shows reason when src is missing", () => {
		const preview = formatPathPreview({
			scriptsRoot: null,
			srcDir: null,
			distDir: ".obsidian/plugins/vault-scripts/dist",
			ok: false,
			reason: "Scripts root cannot be empty.",
		});
		expect(preview.src).toBe("—");
		expect(preview.status).toBe("Scripts root cannot be empty.");
	});
});
