import type { App } from "obsidian";
import { Notice } from "obsidian";
import {
	COMMAND_INVOKE_PREFIX,
	LOG_PREFIX,
	NOTICE_INVOKE_FAILED,
} from "~/shared/constants";
import type { RegisteredCommand } from "./types";

export function createInvokeCommandId(exportName: string): string {
	return `${COMMAND_INVOKE_PREFIX}${exportName}`;
}

export function createInvokeCommandName(exportName: string): string {
	return `Vault Scripts: ${exportName}`;
}

export function createInvokeCommand(exportName: string): RegisteredCommand {
	return {
		id: createInvokeCommandId(exportName),
		exportName,
		name: createInvokeCommandName(exportName),
	};
}

export async function runInvokeCommand(
	exportName: string,
	getVs: () => Record<string, unknown>,
	app: App,
	notice: (message: string) => void = (message) => new Notice(message),
): Promise<void> {
	try {
		const vs = getVs();
		const exportProxy = vs[exportName] as {
			invoke?: (targetApp: App) => Promise<unknown>;
		};
		const invoke = exportProxy?.invoke;
		if (typeof invoke !== "function") {
			throw new Error(`${exportName}.invoke is not callable`);
		}
		await invoke(app);
	} catch (error) {
		notice(NOTICE_INVOKE_FAILED);
		console.error(`${LOG_PREFIX} invoke failed`, exportName, error);
	}
}
