export type ValidationReason =
	| "EMPTY"
	| "TRAVERSAL"
	| "ABSOLUTE"
	| "OUTSIDE_VAULT";

export interface ValidationResult {
	valid: boolean;
	reason?: ValidationReason;
}

export interface ResolvedPaths {
	/** Vault-relative absolute path to scripts root, or null when invalid. */
	scriptsRoot: string | null;
	/** join(scriptsRoot, "src"), or null when scripts root is invalid. */
	srcDir: string | null;
	/** join(manifestDir, "dist") — always set. */
	distDir: string;
	/** Configured, valid, and srcDir exists on disk. */
	ok: boolean;
	/** Set when ok is false. */
	reason?: ValidationReason;
}
