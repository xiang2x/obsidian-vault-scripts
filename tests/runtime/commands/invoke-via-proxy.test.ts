import { describe, expect, it, vi } from "vitest";
import { ModuleLoader } from "~/runtime/loader/module-loader";
import type { FsReader } from "~/runtime/loader/types";
import { ExportRegistry } from "~/runtime/registry/export-registry";
import { createVsProxy } from "~/runtime/proxy/vs-proxy";
import { runInvokeCommand } from "~/runtime/commands/invoke-command-factory";
import type { App } from "obsidian";

function createFsReader(files: Record<string, { mtimeMs: number; code: string }>): FsReader {
	return {
		stat: vi.fn(async (path: string) => {
			const file = files[path];
			if (!file) {
				throw new Error("missing");
			}
			return { mtimeMs: file.mtimeMs };
		}),
		read: vi.fn(async (path: string) => {
			const file = files[path];
			if (!file) {
				throw new Error("missing");
			}
			return file.code;
		}),
	};
}

describe("vs invoke (AC-3/AC-4 slice)", () => {
	it("calls class static invoke via vs proxy", async () => {
		const distPath = "/vault/dist/create-project.js";
		const loader = new ModuleLoader(
			createFsReader({
				[distPath]: {
					mtimeMs: 1,
					code: `exports.CreateProject = class CreateProject { static async invoke(app) { return app?.vault ? "ok" : "missing"; } };`,
				},
			}),
		);

		const registry = {
			hasConflict: () => false,
			getEntry: (name: string) =>
				name === "CreateProject"
					? {
							exportName: "CreateProject",
							distPath,
							hasInvoke: true,
							status: "active" as const,
						}
					: undefined,
		} as unknown as ExportRegistry;

		const vs = createVsProxy(registry, loader);
		const notice = vi.fn();
		const app = { vault: { adapter: {} } } as App;

		await runInvokeCommand("CreateProject", () => vs, app, notice);

		expect(notice).not.toHaveBeenCalled();
	});
});
