import * as obsidian from "obsidian";
import { OBSIDIAN_EXTERNALS } from "~/compile/externals";
import { VS_REQUIRE_DENIED } from "~/shared/constants";

const ALLOWED = new Set(OBSIDIAN_EXTERNALS);

const MODULE_LOADERS: Record<string, () => unknown> = {
	obsidian: () => obsidian,
};

/**
 * Whitelist require() for user script bundles (externals from esbuild).
 */
export function pluginRequire(id: string): unknown {
	if (!ALLOWED.has(id)) {
		throw new Error(`${VS_REQUIRE_DENIED}: module "${id}" is not allowed`);
	}

	const loader = MODULE_LOADERS[id];
	if (loader) {
		return loader();
	}

	throw new Error(
		`${VS_REQUIRE_DENIED}: module "${id}" is allowed but not wired in the plugin host`,
	);
}
