# M6 验收（AC-7～AC-9）

P1 体验与 Mobile 闭环。自动化见 `tests/compile/dist-pruner.test.ts`、`tests/m6/conflict-ac7.test.ts`、`tests/plugin-host/mobile-bootstrap.test.ts`。

## AC-7 — 导出名冲突

### 自动化

- `resolveConflicts` 将重复导出名标为 conflict
- `vs.Report` 访问抛出 `VS_EXPORT_CONFLICT`
- `notifyExportConflicts` 弹出 Notice
- 冲突导出名**不会**注册 invoke 命令

### 手工（可选）

1. 在 `src/` 建两个 entry，均 `export class Report { ... }`
2. PC 编译成功后重载插件
3. **通过**：Notice 提示冲突；`vs.Report` 不可用；命令面板无 `Vault Scripts: Report`

## AC-8 — 删除 src 后 prune dist

### 自动化

- `pruneOrphanDist` 单测
- `build-orchestrator` 集成：删 `remove-me.ts` 后 rebuild，`remove-me.js` 消失

### 手工（可选）

1. 保留至少一个 entry，删除另一个 `.ts`
2. 等待 watch rebuild
3. **通过**：对应 `.js` / `.map` 从 `dist/` 移除

> 删除**全部** entry 时 dist 保留（Decision：无 entry 不 prune all）。

## AC-9 — Mobile Sync 后调用 vs

### 自动化

- `checkMobileDistExists`：空 dist → Notice
- `registerMobileDistListeners`：Mobile 下 dist 变更 debounce reindex

### 手工（需真机或模拟器）

1. PC：编译 fixture，`dist/` 有产物
2. Obsidian Sync 到 Mobile
3. Mobile 打开含 dataviewjs 的笔记：

```dataviewjs
await window.vs.ProjectReport.render(dv.container, { title: "Mobile" });
```

4. **通过**：与 PC 相同渲染结果
5. dist 为空时打开插件 → Notice 提示先在 PC build

### Mobile 无 compile

- 命令面板 **Rebuild & reload** 在 Mobile 无效（控制台 warning）
- 修改 `src/` 不会触发编译

## 签收

见 [m6-ac-checklist.md](./m6-ac-checklist.md)。
