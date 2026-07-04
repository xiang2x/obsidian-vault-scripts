# MVP 手工 E2E（AC-2 / AC-4 / AC-5）

自动化覆盖见 `tests/mvp/mvp-fixtures.test.ts`。以下在 Obsidian Desktop 中手工验收。

## 前置

1. `pnpm run build`，将 `dist/` 下产物（含 `main.js`、`manifest.json`、`esbuild-wasm/`）复制到 `<vault>/.obsidian/plugins/vault-scripts/`。
2. 将仓库 `fixtures/scripts/` 复制到 `<vault>/scripts/`（或合并进已有 scriptsRoot）。
3. **Settings → Vault Scripts**：
   - **Scripts root** = `scripts`
   - **Auto watch** = 开启
4. 重载插件，确认控制台无 `[vault-scripts]` 编译错误。

## AC-2 — dataviewjs 渲染

1. 新建笔记，插入 dataviewjs 块：

```dataviewjs
await window.vs.ProjectReport.render(dv.container, { title: "Weekly status" });
```

2. 切换到阅读模式。
3. **通过**：块内出现标题 **WEEKLY STATUS** 与 fixture 说明文字。

## AC-3 — 命令面板 invoke

1. `Cmd/Ctrl+P` 打开命令面板。
2. 搜索 **Vault Scripts: CreateProject**。
3. 执行命令。
4. **通过**：出现 Notice「CREATEPROJECT INVOKED (FIXTURE DEMO)」。

## AC-4 — Templater invoke

1. 安装并启用 Templater。
2. 新建模板或笔记，插入：

```javascript
<%*
await window.vs.CreateProject.invoke(app);
%>
```

3. 运行 Templater。
4. **通过**：与 AC-3 相同 Notice。

## AC-5 — watch 热更新

1. 打开 `scripts/src/project-report.ts`，将段落文案 `fixture` 改为 `fixture-hot-reload`（或任意可识别字符串）。
2. 保存文件，等待数秒（watch rebuild）。
3. 刷新 dataview 笔记（或切换编辑/阅读模式触发重渲染）。
4. **通过**：dataview 仍正常渲染；若改了可见文案，应看到新内容。

## 故障排查

| 现象                  | 检查                                 |
| --------------------- | ------------------------------------ |
| `vs is undefined`     | 插件是否启用；控制台是否有 load 错误 |
| `VS_EXPORT_NOT_FOUND` | dist 是否存在；**Rebuild & reload**  |
| dataview 无输出       | 块是否 `await`；`window.vs` 是否可用 |
| 类型报错（IDE）       | 见 fixtures README；与运行时无关     |
