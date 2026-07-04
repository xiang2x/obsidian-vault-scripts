import { Notice } from "obsidian";

import { formatTitle } from "../_utils/format-title";

/** Command entry — `await vs.CreateProject.invoke(app)` or command palette. */
export class CreateProject {
	static async invoke(app: import("obsidian").App): Promise<void> {
		void app;
		new Notice(formatTitle("CreateProject invoked (fixture demo)"));
	}
}
