import type { ResolvedPaths } from "~/paths";
import type { Vault } from "obsidian";
import { ModuleLoader, VaultFsReader } from "./loader";
import { ExportRegistry } from "./registry";
import { createVsProxy } from "./proxy";

export interface RuntimeServices {
	loader: ModuleLoader;
	registry: ExportRegistry;
	createVsProxy: () => ReturnType<typeof createVsProxy>;
}

export function createRuntime(
	vault: Vault,
	paths: ResolvedPaths,
): RuntimeServices {
	const loader = new ModuleLoader(new VaultFsReader(vault));
	const registry = new ExportRegistry(vault, paths, loader);

	return {
		loader,
		registry,
		createVsProxy: () => createVsProxy(registry, loader),
	};
}

export * from "./loader";
export * from "./registry";
export * from "./proxy";
export * from "./commands";
