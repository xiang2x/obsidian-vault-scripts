import { normalizePath } from 'obsidian';
import z from 'zod';

export interface VaultScriptsSettings {
  scriptsRoot: string;
  autoWatch: boolean;
  showBuildNotice: boolean;
}

const SCRIPT_ROOT_ERRORS: Record<string, string> = {
  EMPTY: 'Scripts root cannot be empty.',
  OUTSIDE_VAULT: 'Path must stay inside the vault.',
  TRAVERSAL: "Path cannot contain '..'.",
  ABSOLUTE: 'Path must be relative to the vault root.',
};

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || path.startsWith('\\') || /^[a-zA-Z]:[\\/]/.test(path);
}

export const ScriptRootSchema = z.string().superRefine((value, ctx) => {
  const normalizedPath = normalizePath(value.trim());

  if (normalizedPath.length <= 0) {
    ctx.addIssue(SCRIPT_ROOT_ERRORS.EMPTY);
    return;
  }
  if (normalizedPath.startsWith('..') || normalizedPath.includes('/../')) {
    ctx.addIssue(SCRIPT_ROOT_ERRORS.OUTSIDE_VAULT);
    return;
  }

  if (normalizedPath.includes('..')) {
    ctx.addIssue(SCRIPT_ROOT_ERRORS.TRAVERSAL);
    return;
  }

  if (isAbsolutePath(normalizedPath)) {
    ctx.addIssue(SCRIPT_ROOT_ERRORS.ABSOLUTE);
    return;
  }
});

export const DEFAULT_SETTINGS: VaultScriptsSettings = {
  scriptsRoot: 'scripts',
  autoWatch: true,
  showBuildNotice: true,
};
