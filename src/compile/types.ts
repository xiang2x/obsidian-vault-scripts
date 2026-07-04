import type { Message } from 'esbuild-wasm';

export interface BuildResult {
  buildId: number;
  success: boolean;
  errors: Message[];
  entryCount: number;
  durationMs: number;
  correlationId: string;
}

export type BuildEndListener = (result: BuildResult) => void;

export interface CompileStartOptions {
  watch?: boolean;
}

export const ENTRY_EXTENSIONS = ['.ts', '.mts', '.mjs'] as const;

export const ENTRY_EXCLUDE_FILE_PATTERNS = [/\.d\.ts$/, /\.test\.ts$/, /\.test\.mjs$/] as const;

/** Directory names under srcDir that must not be scanned as entries (e.g. npm install target). */
export const ENTRY_EXCLUDE_DIR_NAMES = ['node_modules'] as const;
