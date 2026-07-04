import type { ResolvedPaths } from "../paths";
import type { VaultScriptsSettings } from "../settings";
import type { VsProxy } from "../runtime/proxy";

export type { VsProxy };

export interface VaultScriptsPluginApi {
	vs: VsProxy;
	rebuild(): Promise<void>;
}

export interface HostState {
	settings: VaultScriptsSettings;
	paths: ResolvedPaths;
	lastAppliedBuildId: number;
}
