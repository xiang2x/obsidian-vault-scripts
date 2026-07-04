import type { Plugin } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { SettingsStore, DEFAULT_SETTINGS } from "#/settings/index.ts";

function createPluginMock(
	stored?: Partial<typeof DEFAULT_SETTINGS>,
): Plugin & { saved?: unknown } {
	const plugin = {
		loadData: vi.fn().mockResolvedValue(stored),
		saveData: vi.fn().mockImplementation(async (data: unknown) => {
			plugin.saved = data;
		}),
		saved: undefined as unknown,
	};
	return plugin as unknown as Plugin & { saved?: unknown };
}

describe("SettingsStore", () => {
	it("merges persisted data with defaults", async () => {
		const plugin = createPluginMock({ scriptsRoot: "900-vault/scripts" });
		const store = new SettingsStore(plugin);

		const settings = await store.load();

		expect(settings).toEqual({
			...DEFAULT_SETTINGS,
			scriptsRoot: "900-vault/scripts",
		});
	});

	it("returns defaults when data.json is empty", async () => {
		const plugin = createPluginMock();
		const store = new SettingsStore(plugin);

		expect(await store.load()).toEqual(DEFAULT_SETTINGS);
	});

	it("persists settings via saveData", async () => {
		const plugin = createPluginMock();
		const store = new SettingsStore(plugin);
		const next = { ...DEFAULT_SETTINGS, autoWatch: false };

		await store.save(next);

		expect(plugin.saveData).toHaveBeenCalledWith(next);
		expect((plugin as Plugin & { saved?: unknown }).saved).toEqual(next);
	});
});
