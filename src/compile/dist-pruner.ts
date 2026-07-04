import { readdir, unlink } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { normalizePath } from 'obsidian';

const DIST_ARTIFACT_EXTENSIONS = ['.js', '.map'] as const;

function expectedDistRelPaths(entryVaultPaths: string[], srcDir: string): Set<string> {
  const normalizedSrc = normalizePath(srcDir);
  const expected = new Set<string>();

  for (const entry of entryVaultPaths) {
    const normalizedEntry = normalizePath(entry);
    const rel = normalizedEntry.startsWith(`${normalizedSrc}/`)
      ? normalizedEntry.slice(normalizedSrc.length + 1)
      : normalizedEntry;

    const base = rel.replace(/\.(ts|mts|mjs)$/, '');
    for (const ext of DIST_ARTIFACT_EXTENSIONS) {
      expected.add(`${base}${ext}`);
    }
  }

  return expected;
}

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

/**
 * Remove dist artifacts that no longer correspond to discovered entries.
 */
export async function pruneOrphanDist(
  distDirAbsolute: string,
  srcDirVaultRelative: string,
  entryVaultPaths: string[],
): Promise<void> {
  if (entryVaultPaths.length === 0) {
    return;
  }

  const expected = expectedDistRelPaths(entryVaultPaths, srcDirVaultRelative);
  const files = await walkFiles(distDirAbsolute);

  for (const file of files) {
    const rel = normalizePath(relative(distDirAbsolute, file));
    const ext = extname(rel);

    if (!DIST_ARTIFACT_EXTENSIONS.includes(ext as '.js' | '.map')) {
      continue;
    }

    if (!expected.has(rel)) {
      await unlink(file);
    }
  }
}
