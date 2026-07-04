import { readdir, readFile, stat as fsStat } from "node:fs/promises";
import { join } from "node:path";

/** Vitest stub — Obsidian API is provided by the host app at runtime. */
export class Plugin {
	settings: unknown;
	app: Record<string, unknown> = {};
	loadData = async (): Promise<unknown> => undefined;
	saveData = async (_data: unknown): Promise<void> => undefined;
	addSettingTab = (_tab: unknown): void => undefined;
	addCommand = (_command: unknown): unknown => undefined;
	removeCommand = (_commandId: string): void => undefined;
}

export class Notice {
	constructor(public message: string) {}
}

export class PluginSettingTab {
	containerEl = {
		empty: (): void => undefined,
		createEl: (): HTMLElement => document.createElement("div"),
	};

	constructor(_app: unknown, _plugin: unknown) {}
}

export class Setting {
	setName(_name: string): this {
		return this;
	}
	setDesc(_desc: string): this {
		return this;
	}
	addText(
		_cb: (text: {
			setPlaceholder: (v: string) => void;
			setValue: (v: string) => void;
			onChange: (cb: (v: string) => void) => void;
			inputEl: {
				setAttr: (k: string, v: string) => void;
				removeAttribute: (k: string) => void;
			};
		}) => void,
	): this {
		return this;
	}
	addToggle(
		_cb: (toggle: {
			setValue: (v: boolean) => void;
			onChange: (cb: (v: boolean) => void) => void;
		}) => void,
	): this {
		return this;
	}
}

export type App = Record<string, unknown>;

export class TAbstractFile {
	path = "";
}

export class TFile extends TAbstractFile {
	constructor(path: string) {
		super();
		this.path = path;
	}
}

export class FileSystemAdapter {
	constructor(private readonly basePath: string) {}

	getBasePath(): string {
		return this.basePath;
	}

	async stat(
		path: string,
	): Promise<{ type: string; mtime: number; size: number } | null> {
		try {
			const absolutePath = join(this.basePath, path);
			const fileStat = await fsStat(absolutePath);
			return {
				type: fileStat.isDirectory() ? "folder" : "file",
				mtime: fileStat.mtimeMs,
				size: fileStat.size,
			};
		} catch {
			return null;
		}
	}

	async read(path: string): Promise<string> {
		return readFile(join(this.basePath, path), "utf8");
	}

	async exists(path: string): Promise<boolean> {
		try {
			await fsStat(join(this.basePath, path));
			return true;
		} catch {
			return false;
		}
	}

	async list(
		path: string,
	): Promise<{ files: string[]; folders: string[] }> {
		const absolutePath = join(this.basePath, path);
		const entries = await readdir(absolutePath, { withFileTypes: true });
		const files: string[] = [];
		const folders: string[] = [];

		for (const entry of entries) {
			if (entry.isDirectory()) {
				folders.push(entry.name);
			} else {
				files.push(entry.name);
			}
		}

		return { files, folders };
	}
}

export const Platform = {
	isDesktopApp: true,
};

export function normalizePath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/\/+/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "")
		.replace(/\u00A0/g, " ")
		.replace(/\u202F/g, " ")
		.normalize();
}
