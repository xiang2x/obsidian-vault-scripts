import builtins from "builtin-modules";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
	resolve: {
		alias: {
			"~": path.resolve(rootDir, "src"),
		},
	},
	plugins: [],
	build: {
		lib: {
			entry: "src/main.ts",
			fileName: "main",
			formats: ["cjs"],
			cssFileName: "styles",
		},
		minify: false,
		emptyOutDir: true,
		rollupOptions: {
			output: {
				dir: "dist",
				entryFileNames: "main.js",
			},
			external: [
				"obsidian",
				"electron",
				"esbuild-wasm",
				"@codemirror/autocomplete",
				"@codemirror/collab",
				"@codemirror/commands",
				"@codemirror/language",
				"@codemirror/lint",
				"@codemirror/search",
				"@codemirror/state",
				"@codemirror/view",
				"@lezer/common",
				"@lezer/highlight",
				"@lezer/lr",
				...builtins,
			],
		},
	},
});
