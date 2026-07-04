import { formatTitle } from "./_utils/format-title";

/** Dataview / report entry — call `await vs.ProjectReport.render(container, ctx)`. */
export class ProjectReport {
	static render(
		container: HTMLElement,
		context: { title?: string } = {},
	): void {
		container.empty();
		const root = container.createDiv({ cls: "vs-project-report" });
		root.createEl("h3", {
			text: formatTitle(context.title ?? "Project report"),
		});
		root.createEl("p", { text: "Rendered by Vault Scripts fixture." });
	}
}
