export type ExportStatus = "active" | "conflict" | "missing";

export interface ExportEntry {
	exportName: string;
	distPath: string;
	hasInvoke: boolean;
	status: ExportStatus;
	conflictWith?: string[];
}

export interface RegistrySnapshot {
	active: ExportEntry[];
	conflicts: Array<{ exportName: string; paths: string[] }>;
}

export interface ExportNameOccurrence {
	exportName: string;
	distPath: string;
}
