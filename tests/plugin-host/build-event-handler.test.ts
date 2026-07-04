import { describe, expect, it, vi } from "vitest";
import type { App } from "obsidian";
import type { BuildResult } from "~/compile";
import { BuildEventHandler } from "~/plugin-host/build-event-handler";
import type { CommandRegistrar } from "~/runtime/commands";
import type { RuntimeServices } from "~/runtime";
import type { HostState } from "~/plugin-host/types";

function createBuildResult(overrides: Partial<BuildResult> = {}): BuildResult {
	return {
		buildId: 1,
		success: true,
		errors: [],
		entryCount: 1,
		durationMs: 10,
		correlationId: "test",
		...overrides,
	};
}

describe("BuildEventHandler", () => {
	it("applies successful builds once by buildId", async () => {
		const invalidate = vi.fn();
		const reindexFromDist = vi.fn(async () => ({
			active: [
				{
					exportName: "CreateProject",
					distPath: "/vault/dist/create-project.js",
					hasInvoke: true,
					status: "active" as const,
				},
			],
			conflicts: [],
		}));
		const registerAll = vi.fn();
		let lastAppliedBuildId = 0;

		const handler = new BuildEventHandler({
			getState: () =>
				({
					lastAppliedBuildId,
					paths: { ok: true },
					settings: {},
				}) as HostState,
			setLastAppliedBuildId: (buildId) => {
				lastAppliedBuildId = buildId;
			},
			runtime: {
				loader: { invalidate },
				registry: { reindexFromDist },
			} as unknown as RuntimeServices,
			commands: { registerAll } as unknown as CommandRegistrar,
			app: {} as App,
		});

		await handler.handle(createBuildResult({ buildId: 1 }));
		await handler.handle(createBuildResult({ buildId: 1 }));
		await handler.handle(createBuildResult({ buildId: 2, success: false }));

		expect(invalidate).toHaveBeenCalledTimes(1);
		expect(reindexFromDist).toHaveBeenCalledTimes(1);
		expect(registerAll).toHaveBeenCalledTimes(1);
		expect(lastAppliedBuildId).toBe(1);
	});
});
