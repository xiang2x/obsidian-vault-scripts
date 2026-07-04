import type { ResolvedPaths } from "~/paths";
import type { Vault } from "obsidian";
import type { ModuleLoader } from "../loader";
import { LOG_PREFIX } from "~/shared/constants";
import {
	extractExportNames,
	resolveConflicts,
} from "./conflict-resolver";
import { listDistJsFiles } from "./dist-scanner";
import type { ExportEntry, RegistrySnapshot } from "./types";

export class ExportRegistry {
	private entries = new Map<string, ExportEntry>();
	private conflictNames = new Set<string>();

	constructor(
		private readonly vault: Vault,
		private readonly paths: ResolvedPaths,
		private readonly loader: ModuleLoader,
	) {}

	async reindexFromDist(): Promise<RegistrySnapshot> {
		this.entries.clear();
		this.conflictNames.clear();

		if (!this.paths.distDir) {
			return { active: [], conflicts: [] };
		}

		let distFiles: string[] = [];

		try {
			distFiles = await listDistJsFiles(this.vault, this.paths.distDir);
		} catch (error) {
			console.warn(`${LOG_PREFIX} dist scan failed`, error);
			return { active: [], conflicts: [] };
		}

		const occurrences = [];
		const exportsByDist = new Map<string, Record<string, unknown>>();

		for (const distPath of distFiles) {
			try {
				const { exports } = await this.loader.loadModule(distPath);
				exportsByDist.set(distPath, exports);
				occurrences.push(...extractExportNames(distPath, exports));
			} catch (error) {
				console.error(`${LOG_PREFIX} skip dist during reindex`, distPath, error);
			}
		}

		const snapshot = resolveConflicts(occurrences, exportsByDist);

		for (const conflict of snapshot.conflicts) {
			this.conflictNames.add(conflict.exportName);
		}

		for (const entry of snapshot.active) {
			this.entries.set(entry.exportName, entry);
		}

		return snapshot;
	}

	getEntry(exportName: string): ExportEntry | undefined {
		if (this.conflictNames.has(exportName)) {
			return undefined;
		}
		return this.entries.get(exportName);
	}

	getActiveEntries(): ExportEntry[] {
		return [...this.entries.values()];
	}

	hasConflict(exportName: string): boolean {
		return this.conflictNames.has(exportName);
	}
}
