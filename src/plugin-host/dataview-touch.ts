import type { App } from "obsidian";

interface DataviewPluginLike {
	index?: {
		touch?: () => void;
	};
}

/**
 * Best-effort dataview refresh after dist reindex. Silent when dataview is absent.
 */
export function tryTouchDataview(app: App): void {
	try {
		const plugins = (
			app as App & {
				plugins?: { plugins?: Record<string, DataviewPluginLike> };
			}
		).plugins?.plugins;
		const dataview = plugins?.dataview;
		dataview?.index?.touch?.();
	} catch {
		// dataview optional — ignore
	}
}
