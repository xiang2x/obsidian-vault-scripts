import { describe, expect, it } from "vitest";
import { resolveConflicts } from "~/runtime/registry/conflict-resolver";

describe("resolveConflicts", () => {
	it("marks duplicate export names as conflicts", () => {
		const snapshot = resolveConflicts(
			[
				{ exportName: "Report", distPath: "/dist/a.js" },
				{ exportName: "Report", distPath: "/dist/b.js" },
				{ exportName: "CreateProject", distPath: "/dist/c.js" },
			],
			new Map([
				[
					"/dist/c.js",
					{
						CreateProject: class {
							static invoke() {
								return "ok";
							}
						},
					},
				],
			]),
		);

		expect(snapshot.conflicts).toEqual([
			{ exportName: "Report", paths: ["/dist/a.js", "/dist/b.js"] },
		]);
		expect(snapshot.active).toHaveLength(1);
		expect(snapshot.active[0]?.exportName).toBe("CreateProject");
		expect(snapshot.active[0]?.hasInvoke).toBe(true);
	});
});
