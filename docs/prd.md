# Vault Scripts 插件 — PRD

> 产品需求文档 · 技术实现见 [L0.md](./L0.md) · 执行计划见 [delivery-plan.md](./delivery-plan.md)

---

## PM Brief（决策要点）

### Problem / Opportunity

- **现状与痛点**（本插件要解决的）
  - **不能用 TypeScript**：CustomJS、QuickAdd UserScript 等宿主仅接受 JS；类型只能靠 IDE，无法在 vault 脚本体系里自然使用 TS。
  - **不能用模块组织脚本**：无 ESM `import`/`export`；共享逻辑靠 `0-xxx-shared.js` 文件名排序、复制粘贴或运行时 `require` hack，难以维护。
  - **无预编译**：CodeScript 等方案在运行时 Babel 转译，每次加载有成本；希望改为 **PC 静态编译、PC/Mobile 读同一套 dist 产物**。
- 只在编译后的脚本侧提供 **`vs.<导出名>`** 供各宿主**按需引用**。

### 平台模型（PC + Mobile）

| 能力                 | PC（Desktop Obsidian） | Mobile                      |
| -------------------- | ---------------------- | --------------------------- |
| 启用插件             | ✓                      | ✓                           |
| 编写 / 修改 `src/`   | ✓                      | 可改文件，但不触发编译      |
| esbuild 编译 / watch | ✓                      | ✗（运行时不初始化 Compile） |
| 调用 `vs.<导出名>`   | ✓                      | ✓（读 Sync 后的 `dist/`）   |

**结论**：本插件面向 **PC 与 Mobile 双端**；差异仅在于 **Compile 只在 Desktop 执行**，Mobile 消费 PC 已编译产物，而非「仅 Mobile 使用」。

### Target users & scenarios

- **主要用户**：维护个人 Obsidian vault 的 power user（本库作者及同类用户）。
- **关键场景（Top 3）**
  1. 在 `src/` 写 TS，**PC** 自动编译，dataview 里 `await vs.ProjectReport.render(...)`（**PC / Mobile 均可调用**）。
  2. 命令类脚本 `export class CreateProject { static invoke }`，Templater / 命令面板调用（**双端**）。
  3. **Mobile** 通过 Sync 获得 PC 已编译的 `dist`，与 PC **同一套** `vs` API（Mobile 不现场编译）。

### Goals（成功定义）

- **业务目标**：提供 vault 内 **TS/ESM 编写 → PC 编译 → PC/Mobile 运行** 的插件能力。
- **用户价值**：在 vault 内用 TS/ESM 与 `_` 共享模块写脚本；零 vault 内构建配置；**PC** 预编译 + 热更新；**PC 与 Mobile** 均可通过 `vs` 调用已编译脚本（Mobile 依赖 Sync 后的 dist）。

### Non-goals（明确不做）

- vault 内任意 npm 依赖 bundle。
- Mobile 现场编译。
- 纯 Mobile 冷启动（从未 PC build）的完整自助（仅提示）。
- 替代 QuickAdd 表单 UI。
- 运行时 TS 类型检查。
- 统一 dataview / Templater / QuickAdd 的**入口语法或调用规范**（各宿主仍按自身方式写块；仅在块内调用已编译的 `vs.Xxx`）。
- **既有脚本迁移**（如 `customer-js`、CustomJS、quick-add 迁到 `src/`）：属 vault 维护者自行处理，**非插件交付范围**。

### Scope（MoSCoW）

| 级别       | 内容                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Must**   | 单一 `main.js`；插件内置 esbuild（**仅 PC 运行时调用**）；`scriptsRoot` 配置；`src/` + `dist/`；`vs.<导出名>`；`_` 内部模块；PC watch + **双端**读 dist 运行 |
| **Should** | 命令面板自动注册 `static invoke`；dataview touch；导出名冲突 Notice；孤儿 dist 清理                                                                          |
| **Could**  | 设置页候选路径检测；Mobile dist 变更监听；`vs.d.ts` 生成                                                                                                     |
| **Won't**  | npm 依赖、路径 API、CodeScript 式运行时 Babel、vault 内 `package.json`                                                                                       |

### Prioritization rationale

先 **P0 闭环**（能写 TS → 能 build → 宿主内能调 `vs`），再体验 polish，最后 IDE/ npm 增强。

### Metrics（North Star + Guardrails）

- **North Star**：用户在 `{scriptsRoot}/src` 用 TS/ESM 写脚本，Desktop 编译成功后，在 dataview / 命令面板等宿主内可通过 **`vs.<导出名>`** 正常调用。
- **Guardrails**：编译失败不破坏上次成功 dist；导出名冲突不 silent wrong module。
- **数据来源**：无产品埋点；以 **AC 表 + 手工回归** 验收。

### Assumptions

- 用户至少在 **PC** 打开 vault 并成功 build 一次后，Mobile 才能通过 Sync 使用已编译脚本（Mobile 本身不编译）。
- dist 位于 `.obsidian/plugins/vault-scripts/dist/`，随 Obsidian Sync 同步。
- 用户接受导出名全局唯一，冲突时需改名。

### Constraints

- Obsidian 插件 API；**PC / Mobile 均安装同一 `main.js`**；Compile 仅在 `Platform.isDesktopApp` 时初始化；Mobile 无 Node `fs` 编译能力，但可运行 `vs`。
- 用户脚本等同任意代码，仅在自己的 vault 执行。

### Risks & mitigations

| 风险                         | 缓解                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Sync 延迟导致 Mobile 旧 dist | 文档说明；可选 dist 监听                                                                    |
| 插件升级清空 dist            | Desktop onload 自动 rebuild                                                                 |
| 导出名冲突                   | reindex 告警，不挂 `vs`                                                                     |
| esbuild 体积 / Mobile 不编译 | 单一 `main.js`；Mobile **运行时不调用** Compile（`Platform.isDesktopApp`）；PC 正常使用编译 |

### Dependencies

- esbuild（插件 bundle 内含；**仅 PC 运行时用于 Compile**，Mobile 不触发编译）。

### Open Questions（Brief 层）

| 级别 | 问题                                  | 选项                          | 推荐        | 拍板人    |
| ---- | ------------------------------------- | ----------------------------- | ----------- | --------- |
| P1   | `scriptsRoot` 首次启用默认值          | A 空 B `scripts` C 检测后建议 | B `scripts` | 产品/用户 |
| P2   | `scriptsRoot` 缺失时是否自动建 `src/` | A 仅提示 B 自动建空目录       | A           | 产品      |
| P3   | 插件显示名                            | A Vault Scripts B Script Kit  | A           | 产品      |

---

## PRD Draft（结构化文档）

### 1. 背景与问题

Obsidian vault 内有大量嵌入脚本（如 dataviewjs 报表、Templater 自动化）。当前痛点是 **无法使用 TypeScript**，且 **无法用 ESM 模块**（`import`/`export`、`_utils` 共享）组织代码，只能依赖 CustomJS eval、分散 CJS 或运行时转译。需要 **Vault Scripts** 插件：在 `{scriptsRoot}/src` 写 TS/ESM，Desktop esbuild 预编译为 `dist/`，各宿主在需要时调用 **`vs.<导出名>`** 加载已编译脚本——**不改造宿主本身的语法**。

### 2. 目标与非目标

**目标**

1. vault 内零构建配置（无 `package.json`）。
2. `{scriptsRoot}/src` 下 **TS/ESM 模块**（`.ts` / `.mts` / `.mjs`；`_` 前缀内部共享）。
3. 运行时只加载编译产物 `dist/`（无运行时 Babel）。
4. 编译后的脚本通过 **`vs.<导出名>`** 暴露（实现细节，非「统一宿主」目标）。
5. **PC** 编译 + watch；**PC 与 Mobile** 均通过 `vs` 消费 `dist/`（Mobile 依赖 Sync）。
6. src 变更 → rebuild → 刷新 dataview（可选）。

**非目标**：见 PM Brief Non-goals。

### 3. 用户与使用场景

| 角色                    | 场景                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| 脚本作者（PC）          | 在 `src/` 写 `export class Xxx { static render }`，PC 保存即编译         |
| 笔记作者（PC / Mobile） | dataviewjs 中 `await vs.ProjectReport.render(dv.container, { dv, ... })` |
| 自动化（PC / Mobile）   | Templater：`await vs.CreateProject.invoke(app)`；或命令面板              |
| Mobile 用户             | Sync dist 后，与 PC 相同方式调用 `vs.Xxx`（不现场编译）                  |

### 4. 需求范围（Must/Should/Could/Won't）

见 PM Brief MoSCoW 表。

### 5. 用户故事 / 关键流程

#### 5.1 正常流：编写 → 编译 → 调用

1. 用户在插件设置填写本 vault 的 `scriptsRoot`（如 `900-vault/scripts`）。
2. 在 `{scriptsRoot}/src/` 编写 entry（如 `plan-review/project-report.ts`）。
3. **PC**：插件 esbuild watch，产出 `.obsidian/plugins/vault-scripts/dist/...js`。
4. **PC / Mobile**：dataviewjs：`await vs.ProjectReport.render(...)`。
5. **Mobile**：Sync dist 后，调用方式与 PC 一致（Mobile 不编译）。

#### 5.2 正常流：命令脚本

1. `src/actions/create-project.ts` 导出 `export class CreateProject { static async invoke(app) }`。
2. 插件注册命令「Vault Scripts: CreateProject」。
3. Templater：`await vs.CreateProject.invoke(app)`。

#### 5.3 脚本组织约定（产品语义）

- 文件夹仅整理代码，**不影响** `vs` 名称。
- **`_` 前缀**目录/文件为内部模块，仅 `import`，不挂 `vs`。
- **命名空间**：`export class` 的 static 方法（`vs.Invest.renderBaseline`）。
- **唯一寻址**：`vs.<导出名>`；导出名全局唯一。

#### 5.4 异常流 / 边界

| 条件                 | 期望行为                            |
| -------------------- | ----------------------------------- |
| `scriptsRoot` 未配置 | 不 build；设置页 + Notice 引导      |
| esbuild 失败         | Notice；保留上次成功 dist           |
| dist 缺失（Desktop） | onload 自动 build                   |
| dist 缺失（Mobile）  | Notice，提示 PC build + Sync        |
| 导出名冲突           | 冲突名不挂 `vs`；Notice             |
| invoke 抛错          | Notice + console.error              |
| 仅在 Mobile 改 src   | dist 不更新，直至 PC rebuild + Sync |

### 6. 交互与 UI

| 入口         | 内容                                                                                    |
| ------------ | --------------------------------------------------------------------------------------- |
| **设置页**   | `scriptsRoot` 路径；Auto watch；Touch Dataview；Show build notice；可选「检测候选路径」 |
| **命令面板** | `Vault Scripts: Rebuild & reload`；各 `static invoke` 类对应命令                        |
| **Notice**   | 编译失败、冲突、dist 缺失                                                               |

无独立脚本管理 UI（第一版）。

### 7. 埋点与指标（Metrics）

个人 vault 工具，**不做应用内埋点**。验收见 §10。

### 8. 依赖与风险

见 PM Brief Dependencies / Risks。

插件**不要求**用户卸载 CustomJS / CodeScript；与其它方案可并存，由用户自行选择。

### 9. 发布计划 / 里程碑

| 阶段       | 交付                                                                |
| ---------- | ------------------------------------------------------------------- |
| **P0 MVP** | 插件脚手架；build + load + `vs` Proxy；invoke 命令；AC-1～AC-6 通过 |
| **P1**     | pruneOrphanDist；冲突检测；AC-7～AC-9                               |
| **P2**     | `vs.d.ts`；npm 依赖（高级）                                         |

### 10. 验收标准（Acceptance Criteria）

| ID   | 级别 | Given                                       | When                                      | Then                                  |
| ---- | ---- | ------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| AC-1 | P0   | 已配置 `scriptsRoot` 且 `src/` 有合法 entry | Desktop 保存 ts                           | `dist/` 生成对应 `.js`，无报错        |
| AC-2 | P0   | dist 已 build                               | dataviewjs 调用 `vs.ProjectReport.render` | 容器渲染成功                          |
| AC-3 | P0   | entry 含 `export class X { static invoke }` | 打开命令面板                              | 可见对应命令且执行成功                |
| AC-4 | P0   | Templater 块                                | `await vs.CreateProject.invoke(app)`      | 逻辑执行成功                          |
| AC-5 | P0   | 修改 src 且 watch 开启                      | 保存文件                                  | dist 更新；再次调用 `vs` 用新代码     |
| AC-6 | P0   | `_utils/foo.ts` 被 entry import             | build                                     | `_utils` 不单独出现在 dist entry 列表 |
| AC-7 | P1   | 两 entry 导出同名 `Report`                  | reindex                                   | `vs.Report` 不可用；有 Notice         |
| AC-8 | P1   | 删除 src 文件                               | watch onEnd                               | 对应 dist 孤儿文件被清理              |
| AC-9 | P1   | PC build 后 Sync 到 Mobile                  | Mobile 打开 dataview                      | `vs.Xxx` 与 PC 一致                   |

### 11. 未决问题（Open Questions）

| 级别 | 问题                                    | 选项                               | 推荐                                                |
| ---- | --------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| P1   | `scriptsRoot` 内置初始值                | 空 / `scripts`                     | `scripts`                                           |
| P2   | Compile 与 Runtime 模块边界             | 双入口构建 / 单 main.js 运行时分支 | **单 main.js；Compile 仅 PC 运行时初始化**（见 L0） |
| P2   | ExportRegistry 是否 eval dist 扫 export | eval / 静态分析                    | eval（MVP）                                         |
| P3   | 是否生成 `vs.d.ts`                      | P2 / 不做                          | P2                                                  |

---

### 契约雏形（供 L0 消费）

#### 核心对象

| 对象                     | 关键属性                                      | 说明               |
| ------------------------ | --------------------------------------------- | ------------------ |
| **VaultScriptsSettings** | `scriptsRoot`, `autoWatch`, `showBuildNotice` | 存 `data.json`     |
| **ExportEntry**          | `exportName`, `distPath`, `hasInvoke`         | 导出名 → dist 文件 |
| **ScriptModule**         | `exports`                                     | CJS eval 结果      |

#### 用户脚本契约

| 用途     | export                                     | 调用                            |
| -------- | ------------------------------------------ | ------------------------------- |
| 命名空间 | `class Xxx { static foo(); static bar() }` | `vs.Xxx.foo(...)`               |
| 函数     | `function Xxx()`                           | `vs.Xxx(...)`                   |
| 命令     | `class Xxx { static invoke(app) }`         | `vs.Xxx.invoke(app)` + 命令面板 |

#### 错误语义（用户可见）

| 情形               | 反馈                |
| ------------------ | ------------------- |
| 未配置 scriptsRoot | 设置页引导          |
| 编译失败           | Notice + 控制台     |
| 导出名不存在       | 调用时报错          |
| 导出名冲突         | Notice；该名不挂 vs |

---

## PM Final Review & Change Log（PM 终审）

### Decision consistency check

- **符合 Goals/Non-goals**：PRD 聚焦产品行为与验收；技术细节下沉 L0.md。
- **范围膨胀**：已剔除路径加载、aliases、npm、宿主统一、**遗留脚本迁移**。
- **隐性承诺**：未承诺纯 Mobile 冷启动；未承诺 QuickAdd UI 替代。

### Changes made

- [x] 将原 `tech-design.md` 拆为 PRD（本文）+ L0（架构）。
- [x] 强化 AC 可测性（Given/When/Then）。
- [x] 明确 `scriptsRoot` 按 vault 隔离，Open Question 保留默认值。
- [x] invoke 脚本约定为 `class { static invoke }` + `vs.Xxx.invoke`（非统一宿主语法）。

### Remaining open decisions

| 级别 | 决策点                              | 影响                          | 推荐                                              |
| ---- | ----------------------------------- | ----------------------------- | ------------------------------------------------- |
| P1   | `scriptsRoot` 默认 `scripts` 还是空 | 首次体验                      | `scripts`                                         |
| P2   | Mobile 与 Compile 关系              | 不打包 esbuild / 运行时不编译 | **已决：单 main.js；Mobile 运行时不调用 Compile** |

### Next actions

| 角色 | 动作                                         |
| ---- | -------------------------------------------- |
| PM   | 拍板 `scriptsRoot` 默认值                    |
| 研发 | 按 [L0.md](./L0.md) 实现 P0；对照 AC-1～AC-6 |
| QA   | 按 AC 表回归（示例脚本即可，不要求迁移存量） |

---

_PRD 版本：1.2 · 聚焦：TS + 模块 + 预编译；非目标：宿主统一、遗留脚本迁移_
