/**
 * Rename Obsidian plugin identifiers and keep package.json / manifest.json in sync.
 *
 * Usage:
 *   node ./scripts/rename-plugin-name.mjs --id my-plugin [--name "My Plugin"] [--description "..."] [--npm-name obsidian-my-plugin] [--dry-run]
 *
 * Examples:
 *   pnpm run rename -- --id json-view --name "JSON View"
 *   node ./scripts/rename-plugin-name.mjs --id json-view --description "View JSON in the vault"
 *
 * Interactive description (TTY only, skipped with --dry-run / --no-interactive / --description):
 *   Prompts whether to update description; if yes, reads new text and writes package.json & manifest.json.
 *
 * No CLI arguments:
 *   With no args and a TTY, runs an interactive wizard (plugin id, display name, npm name, dry-run) then writes.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const ROOT = resolve(import.meta.dirname, '..');
const PKG_PATH = resolve(ROOT, 'package.json');
const MANIFEST_PATH = resolve(ROOT, 'manifest.json');

const TAB = '\t';

function parseArgs(argv) {
  const out = {
    id: undefined,
    name: undefined,
    description: undefined,
    npmName: undefined,
    dryRun: false,
    noInteractive: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      out.help = true;
      continue;
    }
    if (a === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (a === '--no-interactive' || a === '-n') {
      out.noInteractive = true;
      continue;
    }
    if (a === '--id' || a === '--plugin-id') {
      out.id = argv[++i];
      continue;
    }
    if (a === '--name' || a === '--display-name') {
      out.name = argv[++i];
      continue;
    }
    if (a === '--description' || a === '--desc') {
      out.description = argv[++i];
      continue;
    }
    if (a === '--npm-name') {
      out.npmName = argv[++i];
      continue;
    }
    console.error(`Unknown argument: ${a}`);
    process.exitCode = 1;
    out.help = true;
    break;
  }
  return out;
}

/** @param {string} raw */
function normalizePluginId(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** @param {string} id */
function defaultDisplayNameFromId(id) {
  return id
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** @param {string} name */
function defaultNpmNameFromId(id) {
  return `obsidian-${id}`;
}

/**
 * Obsidian plugin id: lowercase, hyphen-separated (folder name under .obsidian/plugins).
 * @param {string} id
 */
function validatePluginId(id) {
  if (!id) {
    return 'Plugin id is required (--id).';
  }
  if (id.length > 128) {
    return 'Plugin id is too long.';
  }
  if (!/^[a-z][a-z0-9-]*$/.test(id)) {
    return 'Plugin id must start with a letter and contain only lowercase letters, digits, and hyphens.';
  }
  if (id.includes('--')) {
    return 'Plugin id must not contain consecutive hyphens.';
  }
  return null;
}

/**
 * npm package name (unscoped): lowercase, URL-safe.
 * @param {string} name
 */
function validateNpmPackageName(name) {
  if (!name) {
    return 'npm package name is empty.';
  }
  if (encodeURIComponent(name) !== name) {
    return 'npm package name should be URL-safe (lowercase, hyphens recommended).';
  }
  if (!/^[a-z0-9-]+$/.test(name)) {
    return 'npm package name may only contain lowercase letters, digits, and hyphens.';
  }
  return null;
}

function printHelp() {
  console.log(`Rename Obsidian plugin — sync package.json & manifest.json

Usage:
  node ./scripts/rename-plugin-name.mjs [--id <plugin-id> | interactive]
  node ./scripts/rename-plugin-name.mjs --id <plugin-id> [options]

No arguments:
  Run with no arguments in a real terminal for the interactive wizard. Non-TTY: pass --id and other flags.

With arguments:
Required (unless interactive):
  --id, --plugin-id     Obsidian plugin id (kebab-case, matches plugin folder name)

Optional:
  --name, --display-name   Human-readable name in manifest (default: title-cased from --id)
  --description, --desc     Sync description in both package.json and manifest.json (skips prompt)
  --npm-name                package.json "name" field (default: obsidian-<plugin-id>)
  --dry-run                 Print changes without writing files (skips description prompt)
  --no-interactive, -n      Never prompt for description (use with --description in CI)
  --help, -h                Show this message
`);
}

/** @param {string} answer */
function isAffirmative(answer) {
  const t = answer.trim().toLowerCase();
  return t === 'y' || t === 'yes';
}

/**
 * @param {{ dryRun: boolean, noInteractive: boolean, cliDescription: string | undefined }} opts
 * @returns {Promise<string | undefined>} New description to apply, or undefined to leave unchanged.
 */
async function promptDescriptionIfNeeded(opts) {
  if (opts.cliDescription !== undefined) {
    return opts.cliDescription;
  }
  if (opts.dryRun || opts.noInteractive || !process.stdin.isTTY || !process.stdout.isTTY) {
    return undefined;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const ans = await rl.question(
      '\nUpdate description in package.json and manifest.json? [y/N]: ',
    );
    if (!isAffirmative(ans)) {
      return undefined;
    }
    const desc = await rl.question('New description: ');
    const trimmed = desc.trim();
    if (!trimmed) {
      console.log('(Empty input; skipping description update.)');
      return undefined;
    }
    return trimmed;
  } finally {
    rl.close();
  }
}

/**
 * Full interactive wizard when CLI has no arguments. Caller must ensure TTY.
 * @returns {Promise<{ id: string, name: string, npmName: string, dryRun: boolean }>}
 */
async function promptInteractiveRename() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(
      '\nRename Obsidian plugin — interactive mode (press Enter for bracketed defaults)\n',
    );

    /** @type {string} */
    let id = '';
    while (true) {
      const raw = await rl.question(
        'Plugin id (kebab-case; matches .obsidian/plugins/<id> in the vault): ',
      );
      id = normalizePluginId(raw ?? '');
      const err = validatePluginId(id);
      if (!err) {
        break;
      }
      console.error(`  ${err}`);
    }

    const defaultName = defaultDisplayNameFromId(id);
    const nameLine = await rl.question(`Display name (manifest.name) [${defaultName}]: `);
    const name = nameLine.trim() || defaultName;
    if (!name.trim()) {
      throw new Error('Display name cannot be empty.');
    }

    const defaultNpm = defaultNpmNameFromId(id);
    /** @type {string} */
    let npmName = defaultNpm;
    while (true) {
      const line = await rl.question(`package.json npm name [${defaultNpm}]: `);
      npmName = (line.trim() || defaultNpm).toLowerCase();
      const err = validateNpmPackageName(npmName);
      if (!err) {
        break;
      }
      console.error(`  ${err}`);
    }

    const dryAns = await rl.question('Dry-run only (preview; do not write files)? [y/N]: ');
    const dryRun = isAffirmative(dryAns);

    return { id, name, npmName, dryRun };
  } finally {
    rl.close();
  }
}

async function run() {
  const argvRest = process.argv.slice(2);
  const args = parseArgs(process.argv);
  if (process.exitCode === 1) {
    printHelp();
    return;
  }
  if (args.help) {
    printHelp();
    return;
  }

  const wantInteractiveWizard =
    argvRest.length === 0 && process.stdin.isTTY && process.stdout.isTTY;

  if (wantInteractiveWizard) {
    const filled = await promptInteractiveRename();
    args.id = filled.id;
    args.name = filled.name;
    args.npmName = filled.npmName;
    args.dryRun = filled.dryRun;
  }

  const rawId = args.id;
  if (!rawId) {
    console.error('Error: Pass --id, or run with no arguments in an interactive terminal.');
    printHelp();
    process.exitCode = 1;
    return;
  }

  const id = normalizePluginId(rawId);
  const idErr = validatePluginId(id);
  if (idErr) {
    console.error(`Error: ${idErr}`);
    process.exitCode = 1;
    return;
  }

  const displayName = args.name?.trim() || defaultDisplayNameFromId(id);
  if (!displayName) {
    console.error('Error: display name is empty.');
    process.exitCode = 1;
    return;
  }

  const npmName = (args.npmName?.trim() || defaultNpmNameFromId(id)).toLowerCase();
  const npmErr = validateNpmPackageName(npmName);
  if (npmErr) {
    console.error(`Error: ${npmErr}`);
    process.exitCode = 1;
    return;
  }

  let pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'));
  let manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

  const oldId = manifest.id;
  const oldPkgName = pkg.name;
  const oldManifestName = manifest.name;

  const nextPkg = { ...pkg, name: npmName };
  const nextManifest = { ...manifest, id, name: displayName };

  const descriptionToApply = await promptDescriptionIfNeeded({
    dryRun: args.dryRun,
    noInteractive: args.noInteractive,
    cliDescription: args.description,
  });

  if (descriptionToApply !== undefined) {
    nextPkg.description = descriptionToApply;
    nextManifest.description = descriptionToApply;
  }

  const summary = [
    ['package.json name', `${oldPkgName} → ${nextPkg.name}`],
    ['manifest id', `${oldId} → ${nextManifest.id}`],
    ['manifest name', `${oldManifestName} → ${nextManifest.name}`],
  ];
  if (descriptionToApply !== undefined) {
    summary.push([
      'description',
      `package: ${JSON.stringify(pkg.description)} → ${JSON.stringify(nextPkg.description)}\n${TAB}manifest: ${JSON.stringify(manifest.description)} → ${JSON.stringify(nextManifest.description)}`,
    ]);
  }

  console.log('Planned changes:\n');
  for (const [label, val] of summary) {
    console.log(`  ${label}: ${val}\n`);
  }

  if (args.dryRun) {
    console.log('(dry-run: no files written)');
    return;
  }

  writeFileSync(PKG_PATH, `${JSON.stringify(nextPkg, null, TAB)}\n`, 'utf8');
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, TAB)}\n`, 'utf8');

  console.log(`Updated:\n  ${PKG_PATH}\n  ${MANIFEST_PATH}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
