import { describe, expect, it } from "vitest";
import { isPathUnder } from "~/paths/normalize-path";

describe("isPathUnder", () => {
	it("matches nested paths", () => {
		expect(isPathUnder("scripts/src/foo.ts", "scripts/src")).toBe(true);
		expect(isPathUnder("scripts/src", "scripts/src")).toBe(true);
	});

	it("rejects siblings and parents", () => {
		expect(isPathUnder("scripts/dist/foo.js", "scripts/src")).toBe(false);
		expect(isPathUnder("other/src/foo.ts", "scripts/src")).toBe(false);
	});
});
