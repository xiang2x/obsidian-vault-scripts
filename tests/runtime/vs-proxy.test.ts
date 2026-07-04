import { describe, expect, it, vi } from "vitest";
import { ModuleLoader } from "~/runtime/loader/module-loader";
import type { FsReader } from "~/runtime/loader/types";
import { ExportRegistry } from "~/runtime/registry/export-registry";
import { createVsProxy } from "~/runtime/proxy/vs-proxy";
import {
	VS_EXPORT_CONFLICT,
	VS_EXPORT_NOT_FOUND,
} from "~/shared/constants";

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

function createPrintRegistry(distPath: string): ExportRegistry {
	return {
		hasConflict: () => false,
		getEntry: (name: string) =>
			name === "Print"
				? {
						exportName: "Print",
						distPath,
						hasInvoke: false,
						status: "active" as const,
					}
				: undefined,
	} as unknown as ExportRegistry;
}

describe("createVsProxy", () => {
	it("calls class static methods via lazy proxy", async () => {
		const distPath = "/vault/dist/project-report.js";
		const loader = new ModuleLoader(
			createFsReader({
				[distPath]: {
					mtimeMs: 1,
					code: `exports.ProjectReport = class ProjectReport { static render() { return "rendered"; } };`,
				},
			}),
		);

		const registry = {
			hasConflict: () => false,
			getEntry: (name: string) =>
				name === "ProjectReport"
					? {
							exportName: "ProjectReport",
							distPath,
							hasInvoke: false,
							status: "active" as const,
						}
					: undefined,
		} as unknown as ExportRegistry;

		const vs = createVsProxy(registry, loader);
		const render = (vs.ProjectReport as { render: () => Promise<string> }).render;
		await expect(render()).resolves.toBe("rendered");
	});

	it("calls Print.print for class exports", async () => {
		const distPath = "/vault/dist/print.js";
		const loader = new ModuleLoader(
			createFsReader({
				[distPath]: {
					mtimeMs: 1,
					code: `exports.Print = class Print { static print(message) { return message; } };`,
				},
			}),
		);
		const vs = createVsProxy(createPrintRegistry(distPath), loader);
		const print = (vs.Print as { print: (msg: string) => Promise<string> }).print;
		await expect(print("ssss")).resolves.toBe("ssss");
	});

	it("rejects calling class export as a function", async () => {
		const distPath = "/vault/dist/print.js";
		const loader = new ModuleLoader(
			createFsReader({
				[distPath]: {
					mtimeMs: 1,
					code: `exports.Print = class Print { static print(message) { return message; } };`,
				},
			}),
		);
		const vs = createVsProxy(createPrintRegistry(distPath), loader);
		const callPrint = vs.Print as (msg: string) => Promise<unknown>;
		await expect(callPrint("ssss")).rejects.toThrow(/static method/);
	});

	it("throws for missing exports", () => {
		const registry = {
			hasConflict: () => false,
			getEntry: () => undefined,
		} as unknown as ExportRegistry;
		const vs = createVsProxy(registry, new ModuleLoader(createFsReader({})));

		expect(() => vs.Missing).toThrow(VS_EXPORT_NOT_FOUND);
	});

	it("throws for conflict exports", () => {
		const registry = {
			hasConflict: (name: string) => name === "Report",
			getEntry: () => undefined,
		} as unknown as ExportRegistry;
		const vs = createVsProxy(registry, new ModuleLoader(createFsReader({})));

		expect(() => vs.Report).toThrow(VS_EXPORT_CONFLICT);
	});
});
