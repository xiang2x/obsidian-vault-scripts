import type { BuildResult as EsbuildBuildResult, Message } from "esbuild-wasm";
import { Notice, type Vault } from "obsidian";
import type { ResolvedPaths } from "~/paths";
import { LOG_PREFIX } from "~/shared/constants";
import { discoverEntries } from "./entry-discovery";
import { pruneOrphanDist } from "./dist-pruner";
import { writeBuildOutputs } from "./dist-writer";
import {
	createEsbuildContext,
	runEsbuildBuild,
	type EsbuildPaths,
} from "./esbuild-runner";
import type {
	BuildEndListener,
	BuildResult,
	CompileStartOptions,
} from "./types";
import { toAbsoluteVaultPath } from "./vault-paths";

export interface CompileServiceOptions {
	vault: Vault;
	paths: ResolvedPaths;
	showBuildNotice: boolean;
}

/**
 * BuildOrchestrator — discover → esbuild → prune → onBuildEnd.
 */
export class CompileService {
	private buildIdCounter = 0;
	private context: Awaited<ReturnType<typeof createEsbuildContext>> | undefined;
	private readonly listeners: BuildEndListener[] = [];
	private pendingRebuild: {
		correlationId: string;
		resolve: (result: BuildResult) => void;
	} | undefined;

	constructor(private readonly options: CompileServiceOptions) {}

	private watchEnabled = false;

	onBuildEnd(listener: BuildEndListener): void {
		this.listeners.push(listener);
	}

	async start(options: CompileStartOptions = {}): Promise<void> {
		if (!this.canCompile()) {
			return;
		}

		this.watchEnabled = Boolean(options.watch);

		if (options.watch) {
			await this.startWatch();
			return;
		}

		await this.rebuild();
	}

	hasWatchContext(): boolean {
		return this.context !== undefined;
	}

	isWatchEnabled(): boolean {
		return this.watchEnabled;
	}

	/** Re-discover entries and restart esbuild watch (e.g. after new src files appear). */
	async refreshWatch(): Promise<void> {
		if (!this.canCompile() || !this.watchEnabled) {
			return;
		}
		await this.startWatch();
	}

	async rebuild(): Promise<BuildResult | undefined> {
		if (!this.canCompile()) {
			return undefined;
		}

		const correlationId = crypto.randomUUID();

		if (this.context) {
			const resultPromise = new Promise<BuildResult>((resolve) => {
				this.pendingRebuild = { correlationId, resolve };
			});
			try {
				await this.context.rebuild();
			} catch {
				// esbuild throws when errors.length > 0; onEnd still emits BuildResult.
			}
			return resultPromise;
		}

		return this.executeBuild(correlationId);
	}

	async dispose(): Promise<void> {
		await this.disposeWatchContext();
		this.watchEnabled = false;
	}

	private async disposeWatchContext(): Promise<void> {
		const context = this.context;
		this.context = undefined;
		this.pendingRebuild = undefined;
		if (context) {
			await context.dispose();
		}
	}

	private canCompile(): boolean {
		const { paths } = this.options;
		return Boolean(paths.ok && paths.srcDir && paths.distDir);
	}

	private async startWatch(): Promise<void> {
		await this.disposeWatchContext();

		const entryVaultPaths = await discoverEntries(
			this.options.vault,
			this.options.paths.srcDir!,
		);

		if (entryVaultPaths.length === 0) {
			console.log(
				`${LOG_PREFIX} watch deferred: no entries under ${this.options.paths.srcDir}`,
			);
			await this.executeBuild(crypto.randomUUID());
			return;
		}

		console.log(`${LOG_PREFIX} watching ${entryVaultPaths.length} entries`, {
			srcDir: this.options.paths.srcDir,
			entries: entryVaultPaths,
		});

		const esbuildPaths = this.buildEsbuildPaths(entryVaultPaths);
		this.context = await createEsbuildContext(esbuildPaths, (result) => {
			const correlationId =
				this.pendingRebuild?.correlationId ?? crypto.randomUUID();
			void this.handleEsbuildResult(result, correlationId);
		});
		await this.context.watch();
	}

	private async executeBuild(correlationId: string): Promise<BuildResult> {
		const { vault, paths } = this.options;
		const srcDir = paths.srcDir!;
		const entryVaultPaths = await discoverEntries(vault, srcDir);

		if (entryVaultPaths.length === 0) {
			console.log(`${LOG_PREFIX} build skipped: no entries under ${srcDir}`);
			return this.finalizeBuild({
				correlationId,
				success: true,
				errors: [],
				entryCount: 0,
				startMs: Date.now(),
			});
		}

		const esbuildPaths = this.buildEsbuildPaths(entryVaultPaths);
		const startMs = Date.now();

		try {
			const result = await runEsbuildBuild(esbuildPaths);
			return this.handleEsbuildResult(result, correlationId, startMs, entryVaultPaths);
		} catch (error) {
			const errors = toBuildMessages(error);
			return this.finalizeBuild({
				correlationId,
				success: false,
				errors,
				entryCount: entryVaultPaths.length,
				startMs,
			});
		}
	}

	private async handleEsbuildResult(
		result: EsbuildBuildResult,
		correlationId: string,
		startMs = Date.now(),
		entryVaultPaths?: string[],
	): Promise<BuildResult> {
		const entries =
			entryVaultPaths ??
			(await discoverEntries(
				this.options.vault,
				this.options.paths.srcDir!,
			));
		const success = result.errors.length === 0;

		if (success) {
			await writeBuildOutputs(result);
			if (entries.length > 0) {
				await pruneOrphanDist(
					toAbsoluteVaultPath(this.options.vault, this.options.paths.distDir),
					this.options.paths.srcDir!,
					entries,
				);
			}
		}

		return this.finalizeBuild({
			correlationId,
			success,
			errors: result.errors,
			entryCount: entries.length,
			startMs,
		});
	}

	private buildEsbuildPaths(entryVaultPaths: string[]): EsbuildPaths {
		const { vault, paths } = this.options;
		const srcDir = paths.srcDir!;

		return {
			entryAbsPaths: entryVaultPaths.map((entry) =>
				toAbsoluteVaultPath(vault, entry),
			),
			srcDirAbsolute: toAbsoluteVaultPath(vault, srcDir),
			distDirAbsolute: toAbsoluteVaultPath(vault, paths.distDir),
		};
	}

	private finalizeBuild(input: {
		correlationId: string;
		success: boolean;
		errors: Message[];
		entryCount: number;
		startMs: number;
	}): BuildResult {
		const buildResult: BuildResult = {
			buildId: ++this.buildIdCounter,
			success: input.success,
			errors: input.errors,
			entryCount: input.entryCount,
			durationMs: Date.now() - input.startMs,
			correlationId: input.correlationId,
		};

		this.emit(buildResult);
		return buildResult;
	}

	private emit(result: BuildResult): void {
		if (this.options.showBuildNotice && !result.success) {
			new Notice(`${LOG_PREFIX} build failed — see console for details`);
			console.error(`${LOG_PREFIX} build failed`, result.errors);
		}

		if (
			this.pendingRebuild &&
			this.pendingRebuild.correlationId === result.correlationId
		) {
			this.pendingRebuild.resolve(result);
			this.pendingRebuild = undefined;
		}

		for (const listener of this.listeners) {
			listener(result);
		}
	}
}

function toBuildMessages(error: unknown): Message[] {
	if (error instanceof Error) {
		return [
			{
				id: "",
				pluginName: "",
				text: error.message,
				location: null,
				notes: [],
				detail: undefined,
			},
		];
	}

	return [
		{
			id: "",
			pluginName: "",
			text: String(error),
			location: null,
			notes: [],
			detail: undefined,
		},
	];
}
