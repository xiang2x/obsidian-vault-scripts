# MVP 验收核对表（AC-1～AC-6）

> M5 签收用。P1 项（AC-7～AC-9）见 [m6-ac-checklist.md](./m6-ac-checklist.md)。

## 自动化证据

| AC   | 摘要                            | 自动化             | 命令 / 文件                              |
| ---- | ------------------------------- | ------------------ | ---------------------------------------- |
| AC-1 | 保存 ts → dist 生成             | integration        | `tests/mvp/mvp-fixtures.test.ts`         |
| AC-2 | dataview `ProjectReport.render` | integration        | 同上                                     |
| AC-3 | 命令面板 invoke                 | integration        | 同上                                     |
| AC-5 | watch / rebuild 更新 dist       | integration        | 同上                                     |
| AC-6 | `_utils` 非 entry               | unit + integration | `entry-discovery.test.ts` + MVP fixtures |

```bash
pnpm run test
pnpm run build
```

CI：`.github/workflows/ci.yml`（lint + test + build）。

## 手工证据（Desktop）

| AC   | 步骤                                                            | 通过 □ | 日期 | 备注 |
| ---- | --------------------------------------------------------------- | ------ | ---- | ---- |
| AC-1 | 保存 fixture `project-report.ts`，检查 `dist/project-report.js` |        |      |      |
| AC-2 | [mvp-e2e.md](./mvp-e2e.md) dataviewjs 块                        |        |      |      |
| AC-3 | 命令面板 **Vault Scripts: CreateProject**                       |        |      |      |
| AC-4 | Templater `await vs.CreateProject.invoke(app)`                  |        |      |      |
| AC-5 | 改 src 保存 → dist 变化 → dataview 仍可用                       |        |      |      |
| AC-6 | `dist/` 无 `_utils/format-title.js` 独立 entry                  |        |      |      |

## Fixture 位置

- 源码：`fixtures/scripts/src/`
- 说明：`fixtures/README.md`

## M5 签收

- [ ] 上表 AC-1～AC-6 自动化全绿
- [ ] 手工 E2E 至少跑通 AC-2、AC-3、AC-4 一次
- [ ] 设置页 **Resolved paths** 显示正确 `src` / `dist`

**签收**：**\_\_\_\_** · 日期：**\_\_\_\_**
