# Vault Scripts

Write TypeScript/ESM in your vault, compile on desktop, call compiled scripts from dataview, Templater, and the command palette via `window.vs`.

[中文文档](./README.zh-CN.md)

## What it does

- **Desktop**: esbuild watch compiles `{scriptsRoot}/src/**/*.ts` to `.obsidian/plugins/vault-scripts/dist/`
- **Desktop & Mobile**: load compiled scripts through a lazy proxy — `await window.vs.<ExportName>.<method>(...)`
- **Modules**: use `import`/`export` and `_`-prefixed internal folders (not separate entries)
- **Commands**: classes with `static invoke(app)` register palette commands automatically

Compile runs **only on desktop** (`Platform.isDesktopApp`). Mobile reads synced `dist/` and does not compile.

## Install

Releases include `esbuild-wasm/` (~14MB), which **cannot** be delivered completely through the Obsidian community plugin catalog or BRAT. Install manually from the release zip.

### From GitHub Release (recommended)

1. Open [Releases](https://github.com/xiang2x/obsidian-vault-scripts/releases) and download `vault-scripts-x.y.z.zip` for your version.
2. Unzip **into** your vault plugins folder (do not add an extra nesting level):

   ```
   <Vault>/.obsidian/plugins/
   ```

   After unzip you should have:

   ```
   <Vault>/.obsidian/plugins/vault-scripts/
     main.js
     manifest.json
     esbuild-wasm/          ← required for desktop compile
       lib/main.js
       bin/esbuild
       esbuild.wasm
       ...
   ```

3. Open **Settings → Community plugins**, enable **Vault Scripts**, and reload Obsidian.

> Copying only `main.js` and `manifest.json` without `esbuild-wasm/` will break desktop compile.

### From source (development)

```bash
pnpm install
pnpm run build
```

Copy the **entire** `dist/` output into your vault:

```
<Vault>/.obsidian/plugins/vault-scripts/
  main.js
  manifest.json
  esbuild-wasm/          ← required (~14MB)
    lib/main.js
    bin/esbuild
    esbuild.wasm
    ...
```

Enable **Vault Scripts** under **Settings → Community plugins**, then reload Obsidian.

> Do not copy only `main.js` and `manifest.json` — desktop compile needs the `esbuild-wasm/` folder beside them.

### Scripts folder in vault

Default **Scripts root** is `scripts` (vault-relative). Expected layout:

```
scripts/
  src/
    project-report.ts      ← entry → vs.ProjectReport
    actions/
      create-project.ts    ← entry → vs.CreateProject
    _utils/
      helpers.ts           ← internal (bundled, not an entry)
```

Copy [fixtures/scripts](./fixtures/scripts/) as a starting point, or create your own `src/` tree.

Configure **Settings → Vault Scripts → Scripts root** if you use a different path (e.g. `900-vault/scripts-v2`).

## Quick start

1. Set **Scripts root** and ensure `src/` exists.
2. On desktop, save a `.ts` file under `src/` — watch rebuilds `dist/` automatically.
3. In dataviewjs:

```dataviewjs
await window.vs.ProjectReport.render(dv.container, { title: "Weekly status" });
```

4. Or run **Vault Scripts: CreateProject** from the command palette, or in Templater:

```javascript
<%*
await window.vs.CreateProject.invoke(app);
%>
```

## User script conventions

| Pattern                | Export                                           | Call                                       |
| ---------------------- | ------------------------------------------------ | ------------------------------------------ |
| Report / utility class | `export class X { static foo() {} }`             | `await vs.X.foo(...)`                      |
| Function export        | `export function X() {}`                         | `await vs.X(...)`                          |
| Command / automation   | `export class X { static async invoke(app) {} }` | `await vs.X.invoke(app)` + command palette |

Rules:

- **Entry files**: `.ts` / `.mts` / `.mjs` under `src/`, not under `_` folders, not `*.d.ts` or `*.test.ts`
- **Do not** call a class export as a function — use a static method, e.g. `await vs.Print.print("hi")` not `vs.Print("hi")`
- **`import type { App } from "obsidian"`** is erased at compile time; for IDE types, add a local `tsconfig.json` + `devDependencies.obsidian` under your scripts folder (types only, not required at runtime)
- **Third-party npm packages** are not officially supported in MVP

### Example: report class

```typescript
export class ProjectReport {
  static render(container: HTMLElement, context: { title?: string } = {}): void {
    container.empty();
    container.createEl('h3', { text: context.title ?? 'Report' });
  }
}
```

### Example: invoke command

```typescript
import { Notice } from 'obsidian';

export class CreateProject {
  static async invoke(app: import('obsidian').App): Promise<void> {
    void app;
    new Notice('CreateProject invoked');
  }
}
```

## Settings

| Option                | Description                                     |
| --------------------- | ----------------------------------------------- |
| **Scripts root**      | Vault-relative folder containing `src/`         |
| **Auto watch**        | Rebuild when source files change (desktop only) |
| **Show build notice** | Notice when compilation fails                   |

**Resolved paths** shows the computed `src` and `dist` directories.

## Commands

| Command                             | Description                          |
| ----------------------------------- | ------------------------------------ |
| **Vault Scripts: Rebuild & reload** | Full rebuild (desktop only)          |
| **Vault Scripts: {ExportName}**     | Runs `static invoke` for that export |

## Platform notes

|                  | Desktop          | Mobile                             |
| ---------------- | ---------------- | ---------------------------------- |
| Compile / watch  | Yes              | No                                 |
| Call `window.vs` | Yes              | Yes (after Sync)                   |
| Empty `dist/`    | Build on desktop | Notice: build on PC and sync first |

After Sync updates `dist/` on mobile, the plugin reindexes automatically.

## Troubleshooting

| Issue                         | Check                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop compile fails         | Confirm `.obsidian/plugins/vault-scripts/esbuild-wasm/` exists; unzip the full release zip or copy the entire `dist/` from `pnpm run build` |
| `vs` is undefined             | Plugin enabled? Reload Obsidian                                                                                                             |
| `VS_EXPORT_NOT_FOUND`         | `dist/` missing or stale — **Rebuild & reload** on desktop                                                                                  |
| `VS_EXPORT_CONFLICT`          | Two entries export the same name — rename one                                                                                               |
| Class constructor error       | Use static methods: `await vs.X.method()`, not `vs.X()`                                                                                     |
| IDE type errors on `obsidian` | Add `tsconfig.json` + `obsidian` types under scripts root (see above)                                                                       |

## Development (plugin)

```bash
pnpm install
pnpm run dev      # watch build → dist/
pnpm run test
pnpm run lint
```

Plugin source lives in `src/`. User script examples: [fixtures/](./fixtures/).

## License

MIT
