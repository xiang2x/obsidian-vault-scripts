/**
 * @vitest-environment jsdom
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import nodePath from "node:path";
import os from "node:os";
import { FileSystemAdapter, Platform, TFile, type Vault } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	checkMobileDistExists,
	registerMobileDistListeners,
} from "~/plugin-host/mobile-bootstrap";
import { NOTICE_MOBILE_DIST_MISSING } from "~/shared/constants";

function createVault(basePath: string): Vault {
	return {
		adapter: new FileSystemAdapter(basePath),
		getFiles: () => [],
	} as unknown as Vault;
}

describe("mobile bootstrap (AC-9)", () => {
	let tempRoot = "";
	const originalDesktop = Platform.isDesktopApp;

	afterEach(async () => {
		Platform.isDesktopApp = originalDesktop;
		if (tempRoot) {
			await rm(tempRoot, { recursive: true, force: true });
			tempRoot = "";
		}
		vi.useRealTimers();
	});

	it("notices when dist is empty on mobile", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-mobile-"));
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		await mkdir(nodePath.join(tempRoot, distDir), { recursive: true });

		const notices: string[] = [];
		const ok = await checkMobileDistExists(
			createVault(tempRoot),
			{
				scriptsRoot: "scripts",
				srcDir: "scripts/src",
				distDir,
				ok: true,
			},
			(message) => notices.push(message),
		);

		expect(ok).toBe(false);
		expect(notices).toEqual([NOTICE_MOBILE_DIST_MISSING]);
	});

	it("passes when dist has compiled js", async () => {
		tempRoot = await mkdtemp(nodePath.join(os.tmpdir(), "vault-scripts-mobile-"));
		const distDir = ".obsidian/plugins/vault-scripts/dist";
		const distAbs = nodePath.join(tempRoot, distDir);
		await mkdir(distAbs, { recursive: true });
		await writeFile(
			nodePath.join(distAbs, "project-report.js"),
			"exports.ProjectReport = class {}",
			"utf8",
		);

		const notices: string[] = [];
		const ok = await checkMobileDistExists(
			createVault(tempRoot),
			{
				scriptsRoot: "scripts",
				srcDir: "scripts/src",
				distDir,
				ok: true,
			},
			(message) => notices.push(message),
		);

		expect(ok).toBe(true);
		expect(notices).toHaveLength(0);
	});

	it("debounces dist change callbacks on mobile", async () => {
		vi.useFakeTimers();
		Platform.isDesktopApp = false;

		const onDistChanged = vi.fn();
		const registerEvent = vi.fn();
		const plugin = {
			app: {
				vault: {
					on: vi.fn(() => ({}) as never),
				},
			},
			registerEvent,
		} as never;

		registerMobileDistListeners(
			plugin,
			{
				scriptsRoot: "scripts",
				srcDir: "scripts/src",
				distDir: ".obsidian/plugins/vault-scripts/dist",
				ok: true,
			},
			onDistChanged,
		);

		expect(registerEvent).toHaveBeenCalledTimes(4);

		const createHandler = (plugin.app.vault.on as ReturnType<typeof vi.fn>).mock.calls.find(
			(call) => call[0] === "create",
		)?.[1] as (file: { path: string }) => void;

		createHandler?.(
			new TFile(".obsidian/plugins/vault-scripts/dist/project-report.js"),
		);
		createHandler?.(
			new TFile(".obsidian/plugins/vault-scripts/dist/project-report.js"),
		);

		expect(onDistChanged).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(500);
		expect(onDistChanged).toHaveBeenCalledTimes(1);
	});

	it("does not register dist listeners on desktop", () => {
		Platform.isDesktopApp = true;
		const registerEvent = vi.fn();
		const plugin = {
			app: { vault: { on: vi.fn() } },
			registerEvent,
		} as never;

		registerMobileDistListeners(
			plugin,
			{
				scriptsRoot: "scripts",
				srcDir: "scripts/src",
				distDir: ".obsidian/plugins/vault-scripts/dist",
				ok: true,
			},
			vi.fn(),
		);

		expect(registerEvent).not.toHaveBeenCalled();
	});
});
