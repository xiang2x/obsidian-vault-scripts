import type { ResolvedPaths } from "~/paths/types";

export interface PathPreviewLines {
	src: string;
	dist: string;
	status: string;
}

export function formatPathPreview(paths: ResolvedPaths): PathPreviewLines {
	return {
		src: paths.srcDir ?? "—",
		dist: paths.distDir,
		status: paths.ok
			? "Source directory exists"
			: (paths.reason ?? "Source directory missing"),
	};
}
