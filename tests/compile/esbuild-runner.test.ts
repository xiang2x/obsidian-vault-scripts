import { describe, expect, it } from "vitest";
import { OBSIDIAN_EXTERNALS } from "~/compile/externals";
import {
	USER_SCRIPT_ESBUILD_OPTIONS,
	createEsbuildOptions,
} from "~/compile/esbuild-runner";

describe("createEsbuildOptions", () => {
	it("enables tsx/jsx with automatic runtime (React from user node_modules)", () => {
		const options = createEsbuildOptions({
			entryAbsPaths: ["/vault/scripts/src/entry.ts"],
			srcDirAbsolute: "/vault/scripts/src",
			distDirAbsolute: "/vault/.obsidian/plugins/vault-scripts/dist",
		});

		expect(options.loader).toEqual(USER_SCRIPT_ESBUILD_OPTIONS.loader);
		expect(options.jsx).toBe("automatic");
		expect(options.external).toEqual(OBSIDIAN_EXTERNALS);
		expect(options.external).not.toContain("react");
		expect(options.external).not.toContain("react-dom");
	});
});
