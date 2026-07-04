import { describe, expect, it, vi } from "vitest";
import { tryTouchDataview } from "~/plugin-host/dataview-touch";
import type { App } from "obsidian";

describe("tryTouchDataview", () => {
	it("touches dataview when installed", () => {
		const touch = vi.fn();
		const app = {
			plugins: {
				plugins: {
					dataview: {
						index: { touch },
					},
				},
			},
		} as unknown as App;

		tryTouchDataview(app);
		expect(touch).toHaveBeenCalledOnce();
	});

	it("ignores missing dataview plugin", () => {
		expect(() => tryTouchDataview({} as App)).not.toThrow();
	});
});
