import type { ExportNameOccurrence, RegistrySnapshot } from "./types";

function detectHasInvoke(
	exportName: string,
	exports: Record<string, unknown>,
): boolean {
	const value = exports[exportName];
	if (typeof value !== "function") {
		return false;
	}
	const fn = value as { invoke?: unknown };
	return typeof fn.invoke === "function";
}

export function extractExportNames(
	distPath: string,
	exports: Record<string, unknown>,
): ExportNameOccurrence[] {
	const names: ExportNameOccurrence[] = [];

	for (const exportName of Object.keys(exports)) {
		if (exportName === "default") {
			continue;
		}
		names.push({ exportName, distPath });
	}

	return names;
}

export function detectHasInvokeForExport(
	exportName: string,
	exports: Record<string, unknown>,
): boolean {
	return detectHasInvoke(exportName, exports);
}

export function resolveConflicts(
	occurrences: ExportNameOccurrence[],
	exportsByDist: Map<string, Record<string, unknown>>,
): RegistrySnapshot {
	const byName = new Map<string, string[]>();

	for (const { exportName, distPath } of occurrences) {
		const paths = byName.get(exportName) ?? [];
		paths.push(distPath);
		byName.set(exportName, paths);
	}

	const active = [];
	const conflicts = [];

	for (const [exportName, paths] of byName.entries()) {
		if (paths.length > 1) {
			conflicts.push({ exportName, paths: [...paths] });
			continue;
		}

		const distPath = paths[0]!;
		const exports = exportsByDist.get(distPath) ?? {};
		active.push({
			exportName,
			distPath,
			hasInvoke: detectHasInvokeForExport(exportName, exports),
			status: "active" as const,
		});
	}

	return { active, conflicts };
}
