/**
 * @vitest-environment node
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { pruneOrphanDist } from "~/compile/dist-pruner";

describe("pruneOrphanDist (AC-8)", () => {
	let tempRoot = "";

	afterEach(async () => {
		if (tempRoot) {
			await rm(tempRoot, { recursive: true, force: true });
			tempRoot = "";
		}
	});

	it("removes dist js/map artifacts for deleted entries", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-prune-"));
		const distDir = nodePath.join(tempRoot, "dist");
		const srcDir = "scripts/src";

		await mkdir(nodePath.join(distDir, "nested"), { recursive: true });
		await writeFile(nodePath.join(distDir, "keep.js"), "exports.Keep = 1;", "utf8");
		await writeFile(nodePath.join(distDir, "keep.js.map"), "{}", "utf8");
		await writeFile(nodePath.join(distDir, "orphan.js"), "exports.Orphan = 1;", "utf8");
		await writeFile(nodePath.join(distDir, "orphan.js.map"), "{}", "utf8");
		await writeFile(
			nodePath.join(distDir, "nested", "orphan-nested.js"),
			"exports.Nested = 1;",
			"utf8",
		);

		await pruneOrphanDist(distDir, srcDir, [`${srcDir}/keep.ts`]);

		await expect(
			import("node:fs/promises").then((fs) => fs.access(nodePath.join(distDir, "keep.js"))),
		).resolves.toBeUndefined();
		await expect(
			import("node:fs/promises").then((fs) =>
				fs.access(nodePath.join(distDir, "orphan.js")),
			),
		).rejects.toThrow();
		await expect(
			import("node:fs/promises").then((fs) =>
				fs.access(nodePath.join(distDir, "nested", "orphan-nested.js")),
			),
		).rejects.toThrow();
	});

	it("does nothing when no entries remain (retain dist policy)", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-prune-"));
		const distDir = nodePath.join(tempRoot, "dist");
		const stale = nodePath.join(distDir, "stale.js");

		await mkdir(distDir, { recursive: true });
		await writeFile(stale, "exports.Stale = 1;", "utf8");

		await pruneOrphanDist(distDir, "scripts/src", []);

		await expect(import("node:fs/promises").then((fs) => fs.access(stale))).resolves.toBeUndefined();
	});
});
