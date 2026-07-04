import { describe, expect, it, vi } from "vitest";
import { Plugin, type App } from "obsidian";
import { CommandRegistrar } from "~/runtime/commands/command-registrar";
import {
	createInvokeCommandId,
	createInvokeCommandName,
	runInvokeCommand,
} from "~/runtime/commands/invoke-command-factory";
import type { ExportEntry } from "~/runtime/registry";

function createEntry(
	exportName: string,
	hasInvoke: boolean,
): ExportEntry {
	return {
		exportName,
		distPath: `/vault/dist/${exportName.toLowerCase()}.js`,
		hasInvoke,
		status: "active",
	};
}

describe("invoke command factory", () => {
	it("builds stable command ids and names", () => {
		expect(createInvokeCommandId("CreateProject")).toBe("invoke:CreateProject");
		expect(createInvokeCommandName("CreateProject")).toBe(
			"Vault Scripts: CreateProject",
		);
	});

	it("runs invoke through vs proxy", async () => {
		const invoke = vi.fn(async () => "ok");
		const getVs = () => ({
			CreateProject: { invoke },
		});
		const notice = vi.fn();

		await runInvokeCommand("CreateProject", getVs, {} as App, notice);

		expect(invoke).toHaveBeenCalledOnce();
		expect(notice).not.toHaveBeenCalled();
	});

	it("notices when invoke fails", async () => {
		const notice = vi.fn();
		await runInvokeCommand("Missing", () => ({}), {} as App, notice);
		expect(notice).toHaveBeenCalledOnce();
	});
});

describe("CommandRegistrar", () => {
	it("registers only active invoke exports", () => {
		const plugin = new Plugin();
		const addCommand = vi.spyOn(plugin, "addCommand");
		const registrar = new CommandRegistrar(plugin, {} as App, () => ({}));

		registrar.registerAll([
			createEntry("CreateProject", true),
			createEntry("ProjectReport", false),
		]);

		expect(addCommand).toHaveBeenCalledTimes(1);
		expect(addCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "invoke:CreateProject",
				name: "Vault Scripts: CreateProject",
			}),
		);
		expect(registrar.getRegisteredIds()).toEqual(["invoke:CreateProject"]);
	});

	it("unregisters previous commands before re-registering", () => {
		const plugin = new Plugin();
		const removeCommand = vi.spyOn(plugin, "removeCommand");
		const registrar = new CommandRegistrar(plugin, {} as App, () => ({}));

		registrar.registerAll([createEntry("CreateProject", true)]);
		registrar.registerAll([createEntry("ArchiveProject", true)]);

		expect(removeCommand).toHaveBeenCalledWith("invoke:CreateProject");
		expect(registrar.getRegisteredIds()).toEqual(["invoke:ArchiveProject"]);
	});
});
