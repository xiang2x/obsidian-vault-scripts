# M6 验收核对表（AC-7～AC-9）

## 自动化证据

| AC   | 摘要                    | 测试                                                              |
| ---- | ----------------------- | ----------------------------------------------------------------- |
| AC-7 | 冲突名不可用 + Notice   | `tests/m6/conflict-ac7.test.ts`                                   |
| AC-8 | 删 src → prune dist     | `tests/compile/dist-pruner.test.ts`、`build-orchestrator.test.ts` |
| AC-9 | Mobile dist 检查 + 监听 | `tests/plugin-host/mobile-bootstrap.test.ts`                      |

```bash
pnpm run test
```

## 手工证据

| AC   | 步骤                                          | 通过 □ | 日期 | 备注   |
| ---- | --------------------------------------------- | ------ | ---- | ------ |
| AC-7 | 两 entry 同名 export → Notice + `vs.X` 不可用 |        |      | 可选   |
| AC-8 | 删一个 src entry → dist 孤儿清理              |        |      | 可选   |
| AC-9 | PC build → Sync → Mobile dataview 调用 `vs`   |        |      | 需真机 |

详细步骤：[m6-e2e.md](./m6-e2e.md)

## M6 签收

- [ ] AC-7～9 自动化全绿
- [ ] AC-9 真机至少验证一次（或记录延期原因）

**签收**：**\_\_\_\_** · 日期：**\_\_\_\_**
