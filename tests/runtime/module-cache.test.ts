import { describe, expect, it } from "vitest";
import { ModuleCache } from "~/runtime/loader/module-cache";

describe("ModuleCache", () => {
	it("returns cached exports when mtime matches", () => {
		const cache = new ModuleCache();
		cache.set("/dist/a.js", 100, { Foo: 1 });

		expect(cache.get("/dist/a.js", 100)).toEqual({ Foo: 1 });
		expect(cache.get("/dist/a.js", 101)).toBeUndefined();
	});

	it("clears all entries when invalidated", () => {
		const cache = new ModuleCache();
		cache.set("/dist/a.js", 100, { Foo: 1 });
		cache.invalidate(true);
		expect(cache.get("/dist/a.js", 100)).toBeUndefined();
	});
});
