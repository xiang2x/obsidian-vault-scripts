import type { App, Plugin } from "obsidian";
import type { ExportEntry } from "../registry";
import type { VsProxy } from "../proxy";
import {
	createInvokeCommand,
	createInvokeCommandId,
	runInvokeCommand,
} from "./invoke-command-factory";

export class CommandRegistrar {
	private readonly registeredIds: string[] = [];

	constructor(
		private readonly plugin: Plugin,
		private readonly app: App,
		private readonly getVs: () => VsProxy,
	) {}

	registerAll(entries: ExportEntry[]): void {
		this.unregisterAll();

		const invokeEntries = entries.filter(
			(entry) => entry.hasInvoke && entry.status === "active",
		);

		for (const entry of invokeEntries) {
			const command = createInvokeCommand(entry.exportName);
			this.plugin.addCommand({
				id: command.id,
				name: command.name,
				callback: () => {
					void runInvokeCommand(entry.exportName, this.getVs, this.app);
				},
			});
			this.registeredIds.push(createInvokeCommandId(entry.exportName));
		}
	}

	unregisterAll(): void {
		for (const id of this.registeredIds) {
			this.plugin.removeCommand(id);
		}
		this.registeredIds.length = 0;
	}

	getRegisteredIds(): readonly string[] {
		return this.registeredIds;
	}
}
