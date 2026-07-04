import { describe, expect, it } from "vitest";
import { joinVaultListingPath } from "~/compile/adapter-list-path";

describe("joinVaultListingPath", () => {
	const srcDir = "900-vault/scripts-v2/src";

	it("joins bare filenames", () => {
		expect(joinVaultListingPath(srcDir, "print.ts")).toBe(
			"900-vault/scripts-v2/src/print.ts",
		);
	});

	it("keeps vault-relative paths from adapter.list", () => {
		expect(joinVaultListingPath(srcDir, "900-vault/scripts-v2/src/print.ts")).toBe(
			"900-vault/scripts-v2/src/print.ts",
		);
	});

	it("joins bare folder names when walking nested dirs", () => {
		expect(joinVaultListingPath(srcDir, "nested")).toBe(
			"900-vault/scripts-v2/src/nested",
		);
	});
});
