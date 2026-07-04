import { describe, expect, it } from "vitest";
import { pluginRequire } from "~/runtime/loader/require-shim";
import { VS_REQUIRE_DENIED } from "~/shared/constants";

describe("pluginRequire", () => {
	it("allows obsidian", () => {
		expect(pluginRequire("obsidian")).toBeDefined();
	});

	it("rejects non-whitelisted modules", () => {
		expect(() => pluginRequire("node:fs")).toThrow(VS_REQUIRE_DENIED);
	});
});
