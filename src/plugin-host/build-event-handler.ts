import type { App } from "obsidian";
import { Notice } from "obsidian";
import type { BuildResult } from "~/compile";
import type { CommandRegistrar } from "~/runtime/commands";
import type { RuntimeServices } from "~/runtime";
import { LOG_PREFIX, NOTICE_EXPORT_CONFLICT } from "~/shared/constants";
import { tryTouchDataview } from "./dataview-touch";
import type { HostState } from "./types";

export interface BuildEventHandlerOptions {
	getState: () => HostState | undefined;
	setLastAppliedBuildId: (buildId: number) => void;
	runtime: RuntimeServices;
	commands: CommandRegistrar;
	app: App;
}

export class BuildEventHandler {
	constructor(private readonly options: BuildEventHandlerOptions) {}

	async handle(result: BuildResult): Promise<void> {
		if (!result.success) {
			return;
		}

		const state = this.options.getState();
		if (!state) {
			return;
		}

		if (result.buildId <= state.lastAppliedBuildId) {
			return;
		}

		this.options.runtime.loader.invalidate(true);
		const snapshot = await this.options.runtime.registry.reindexFromDist();
		notifyExportConflicts(snapshot.conflicts);
		this.options.commands.registerAll(snapshot.active);
		this.options.setLastAppliedBuildId(result.buildId);
		tryTouchDataview(this.options.app);
	}
}

export function notifyExportConflicts(
	conflicts: Array<{ exportName: string; paths: string[] }>,
	notice: (message: string) => void = (message) => new Notice(message),
): void {
	if (conflicts.length === 0) {
		return;
	}

	notice(NOTICE_EXPORT_CONFLICT);
	console.warn(`${LOG_PREFIX} export conflicts`, conflicts);
}
