export const LOG_PREFIX = "[vault-scripts]";

/** Shipped beside main.js; contains lib/, bin/, and wasm assets (not node_modules). */
export const ESBUILD_RUNTIME_DIR = "esbuild-wasm";

export const COMMAND_REBUILD = "rebuild";
export const COMMAND_INVOKE_PREFIX = "invoke:";

export const VS_NOT_READY =
	"Vault Scripts runtime is not ready yet. Check settings and dist output.";

export const VS_EXPORT_NOT_FOUND = "VS_EXPORT_NOT_FOUND";
export const VS_EXPORT_CONFLICT = "VS_EXPORT_CONFLICT";
export const VS_DIST_MISSING = "VS_DIST_MISSING";
export const VS_REQUIRE_DENIED = "VS_REQUIRE_DENIED";
export const VS_USER_SCRIPT_ERROR = "VS_USER_SCRIPT_ERROR";

export const NOTICE_EXPORT_CONFLICT =
	"Vault Scripts: export name conflict detected. Conflicting vs exports are disabled.";

export const NOTICE_MOBILE_DIST_MISSING =
	"Vault Scripts: dist is empty or missing. Build on desktop and sync before using scripts on mobile.";

export const NOTICE_INVOKE_FAILED = "Vault Scripts: script invoke failed — see console for details.";
