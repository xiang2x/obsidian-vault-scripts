import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			obsidian: path.resolve(rootDir, "tests/obsidian-mock.ts"),
			"~": path.resolve(rootDir, "src"),
			"#": path.resolve(rootDir, "src"),
		},
	},
	test: {
		environment: "jsdom",
	},
});
