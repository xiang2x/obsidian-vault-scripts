import { normalizePath, type Vault } from "obsidian";
import { ScriptRootSchema, type VaultScriptsSettings } from "../settings";
import { joinPath } from "./normalize-path";

import type { ResolvedPaths, ValidationReason } from "./types";

const SRC_DIR = "src";
const DIST_DIR = "dist";

export interface ResolvePathsInput {
	vault: Vault;
	settings: VaultScriptsSettings;
	manifestDir: string;
}

function invalidPaths(
	distDir: string,
	reason: ValidationReason,
): ResolvedPaths {
	return {
		scriptsRoot: null,
		srcDir: null,
		distDir,
		ok: false,
		reason,
	};
}

/**
 * Resolve scripts src/dist directories from settings and plugin manifest dir.
 */
export async function resolvePaths(
	input: ResolvePathsInput,
): Promise<ResolvedPaths> {
	const distDir = joinPath(normalizePath(input.manifestDir), DIST_DIR);

	const scriptRootResult = ScriptRootSchema.safeParse(
		input.settings.scriptsRoot.trim(),
	);

	if (scriptRootResult.error) {
		return invalidPaths(
			distDir,
			scriptRootResult.error.issues[0].message as ValidationReason,
		);
	}

	const scriptsRoot = normalizePath(scriptRootResult.data);
	const srcDir = joinPath(scriptsRoot, SRC_DIR);

	const srcExists = await input.vault.adapter.exists(srcDir);

	return {
		scriptsRoot,
		srcDir,
		distDir,
		ok: srcExists,
	};
}
