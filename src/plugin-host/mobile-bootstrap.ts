import { Notice, TAbstractFile, TFile, type Plugin, type Vault } from "obsidian";

import { isPathUnder, type ResolvedPaths } from "~/paths";
import { listDistJsFiles } from "~/runtime/registry/dist-scanner";
import { LOG_PREFIX, NOTICE_MOBILE_DIST_MISSING } from "~/shared/constants";
import { isDesktopApp } from "~/shared/utils";

const MOBILE_DIST_REINDEX_DEBOUNCE_MS = 500;

export async function checkMobileDistExists(
	vault: Vault,
	paths: ResolvedPaths,
	notice: (message: string) => void = (message) => new Notice(message),
): Promise<boolean> {
	if (!paths.distDir) {
		notice(NOTICE_MOBILE_DIST_MISSING);
		console.warn(`${LOG_PREFIX} mobile bootstrap: distDir missing`);
		return false;
	}

	try {
		const distFiles = await listDistJsFiles(vault, paths.distDir);
		if (distFiles.length === 0) {
			notice(NOTICE_MOBILE_DIST_MISSING);
			console.warn(`${LOG_PREFIX} mobile bootstrap: dist is empty`, {
				distDir: paths.distDir,
			});
			return false;
		}
		return true;
	} catch (error) {
		notice(NOTICE_MOBILE_DIST_MISSING);
		console.warn(`${LOG_PREFIX} mobile bootstrap: dist scan failed`, error);
		return false;
	}
}

/**
 * After Sync updates dist on Mobile, debounce reindex when dist files change.
 */
export function registerMobileDistListeners(
	plugin: Plugin,
	paths: ResolvedPaths,
	onDistChanged: () => void | Promise<void>,
): void {
	if (isDesktopApp() || !paths.distDir) {
		return;
	}

	let timer: number | undefined;

	const schedule = (): void => {
		if (timer !== undefined) {
			window.clearTimeout(timer);
		}
		timer = window.setTimeout(() => {
			timer = undefined;
			void onDistChanged();
		}, MOBILE_DIST_REINDEX_DEBOUNCE_MS);
	};

	const touchesDist = (vaultPath: string): boolean =>
		isPathUnder(vaultPath, paths.distDir!);

	const onFileEvent = (file: TAbstractFile): void => {
		if (file instanceof TFile && touchesDist(file.path)) {
			schedule();
		}
	};

	plugin.registerEvent(plugin.app.vault.on("create", onFileEvent));
	plugin.registerEvent(plugin.app.vault.on("modify", onFileEvent));
	plugin.registerEvent(plugin.app.vault.on("delete", onFileEvent));
	plugin.registerEvent(
		plugin.app.vault.on("rename", (file, oldPath) => {
			if (file instanceof TFile && touchesDist(file.path)) {
				schedule();
			}
			if (touchesDist(oldPath)) {
				schedule();
			}
		}),
	);
}
