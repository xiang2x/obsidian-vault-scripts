# Vault Scripts — MVP fixtures

Copy `fixtures/scripts/` into your vault (or point **scriptsRoot** at an equivalent folder).

## Layout

```
scripts/                    ← scriptsRoot (default)
  src/
    project-report.ts       ← entry: vs.ProjectReport
    actions/
      create-project.ts     ← entry: vs.CreateProject
    _utils/
      format-title.ts       ← internal module (not an entry)
```

## Install in vault

1. Copy `fixtures/scripts/` to `<vault>/scripts/` (or merge `src/` into your existing scripts root).
2. **Settings → Vault Scripts** → set **Scripts root** to `scripts` (or your path).
3. Reload the plugin on Desktop and wait for watch build (or run **Vault Scripts: Rebuild & reload**).

## dataviewjs (AC-2)

```dataviewjs
await window.vs.ProjectReport.render(dv.container, { title: "Weekly status" });
```

## Templater (AC-4)

```javascript
<%*
await window.vs.CreateProject.invoke(app);
%>
```

## Command palette (AC-3)

Search **Vault Scripts: CreateProject**.

Manual E2E steps: [docs/mvp-e2e.md](../docs/mvp-e2e.md).
