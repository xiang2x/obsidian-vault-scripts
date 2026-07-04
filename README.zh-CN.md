# Vault Scripts

在 vault 里用 TypeScript/ESM 写脚本，在桌面端编译，通过 `window.vs` 在 dataview、Templater、命令面板中调用。

[English](./README.md)

## 功能

- **桌面端**：esbuild watch 将 `{scriptsRoot}/src/**/*.ts` 编译到 `.obsidian/plugins/vault-scripts/dist/`
- **桌面端 & 移动端**：通过懒加载代理调用已编译脚本 — `await window.vs.<导出名>.<方法>(...)`
- **模块**：支持 `import`/`export`，`_` 前缀目录为内部模块（不会单独成为 entry）
- **命令**：带 `static invoke(app)` 的 class 会自动注册命令面板

编译**仅在桌面端**运行（`Platform.isDesktopApp`）。移动端读取 Sync 后的 `dist/`，不现场编译。

## 安装

本插件 release 内含 `esbuild-wasm/`（约 14MB），**无法**通过 Obsidian 官方社区插件或 BRAT 完整下发，请**手动安装** release 压缩包。

### 从 GitHub Release 安装（推荐）

1. 打开 [Releases](https://github.com/xiang2x/obsidian-vault-scripts/releases)，下载对应版本的 `vault-scripts-x.y.z.zip`。
2. 将 zip **解压到** vault 的插件目录（不要多嵌一层目录）：

   ```
   <Vault>/.obsidian/plugins/
   ```

   解压后应得到：

   ```
   <Vault>/.obsidian/plugins/vault-scripts/
     main.js
     manifest.json
     esbuild-wasm/          ← 必须（桌面端编译）
       lib/main.js
       bin/esbuild
       esbuild.wasm
       ...
   ```

3. 打开 **设置 → 社区插件**，启用 **Vault Scripts**，然后重载 Obsidian。

> 若只复制了 `main.js` 和 `manifest.json` 而缺少 `esbuild-wasm/`，桌面端编译会失败。

### 从源码构建（开发）

```bash
pnpm install
pnpm run build
```

将 **`dist/` 目录完整内容**复制到 vault：

```
<Vault>/.obsidian/plugins/vault-scripts/
  main.js
  manifest.json
  esbuild-wasm/          ← 必须（约 14MB）
    lib/main.js
    bin/esbuild
    esbuild.wasm
    ...
```

在 **设置 → 社区插件** 中启用 **Vault Scripts**，然后重载 Obsidian。

> 不要只复制 `main.js` 和 `manifest.json` — 桌面端编译依赖同目录下的 `esbuild-wasm/` 文件夹。

### Vault 中的脚本目录

默认 **Scripts root** 为 `scripts`（相对 vault 根目录）。目录结构：

```
scripts/
  src/
    project-report.ts      ← entry → vs.ProjectReport
    actions/
      create-project.ts    ← entry → vs.CreateProject
    _utils/
      helpers.ts           ← 内部模块（会打进 bundle，不是 entry）
```

可复制 [fixtures/scripts](./fixtures/scripts/) 作为示例，或自行创建 `src/`。

若使用其他路径（如 `900-vault/scripts-v2`），在 **设置 → Vault Scripts → Scripts root** 中修改。

## 快速开始

1. 配置 **Scripts root**，确保存在 `src/` 目录。
2. 在桌面端保存 `src/` 下的 `.ts` 文件 — watch 会自动更新 `dist/`。
3. 在 dataviewjs 中：

```dataviewjs
await window.vs.ProjectReport.render(dv.container, { title: "周报" });
```

4. 或在命令面板执行 **Vault Scripts: CreateProject**，或在 Templater 中：

```javascript
<%*
await window.vs.CreateProject.invoke(app);
%>
```

## 用户脚本约定

| 用途          | 导出方式                                         | 调用方式                            |
| ------------- | ------------------------------------------------ | ----------------------------------- |
| 报表 / 工具类 | `export class X { static foo() {} }`             | `await vs.X.foo(...)`               |
| 函数导出      | `export function X() {}`                         | `await vs.X(...)`                   |
| 命令 / 自动化 | `export class X { static async invoke(app) {} }` | `await vs.X.invoke(app)` + 命令面板 |

规则：

- **Entry 文件**：`src/` 下的 `.ts` / `.mts` / `.mjs`，不能在 `_` 目录下，不能是 `*.d.ts` 或 `*.test.ts`
- **不要**把 class 当函数调用 — 应走静态方法，例如 `await vs.Print.print("hi")`，而不是 `vs.Print("hi")`
- **`import type { App } from "obsidian"`** 仅用于类型，编译时会擦掉；若 IDE 报类型错，可在脚本目录放 `tsconfig.json` 和 `devDependencies.obsidian`（仅类型，运行时不需要）
- **第三方 npm 包** MVP 阶段未正式支持

### 示例：报表类

```typescript
export class ProjectReport {
  static render(container: HTMLElement, context: { title?: string } = {}): void {
    container.empty();
    container.createEl('h3', { text: context.title ?? '报表' });
  }
}
```

### 示例：invoke 命令

```typescript
import { Notice } from 'obsidian';

export class CreateProject {
  static async invoke(app: import('obsidian').App): Promise<void> {
    void app;
    new Notice('CreateProject 已执行');
  }
}
```

## 设置项

| 选项                  | 说明                             |
| --------------------- | -------------------------------- |
| **Scripts root**      | 含 `src/` 的 vault 相对路径      |
| **Auto watch**        | 源文件变更时自动编译（仅桌面端） |
| **Show build notice** | 编译失败时弹出 Notice            |

**Resolved paths** 区域显示解析后的 `src` 与 `dist` 路径。

## 命令

| 命令                                | 说明                               |
| ----------------------------------- | ---------------------------------- |
| **Vault Scripts: Rebuild & reload** | 全量重新编译（仅桌面端）           |
| **Vault Scripts: {导出名}**         | 执行对应 export 的 `static invoke` |

## 平台差异

|                  | 桌面端       | 移动端                         |
| ---------------- | ------------ | ------------------------------ |
| 编译 / watch     | 支持         | 不支持                         |
| 调用 `window.vs` | 支持         | 支持（Sync 后）                |
| `dist/` 为空     | 在桌面端编译 | Notice 提示先在 PC 编译并 Sync |

移动端 Sync 更新 `dist/` 后，插件会自动重新索引。

## 故障排查

| 现象                       | 检查                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 桌面端无法编译             | 确认 `.obsidian/plugins/vault-scripts/esbuild-wasm/` 存在；请从 release zip 完整解压，或从 `pnpm run build` 产物复制整个 `dist/` |
| `vs` 未定义                | 插件是否启用？是否已重载                                                                                                         |
| `VS_EXPORT_NOT_FOUND`      | `dist/` 缺失或过期 — 桌面端执行 **Rebuild & reload**                                                                             |
| `VS_EXPORT_CONFLICT`       | 两个 entry 导出了同名 — 需改名                                                                                                   |
| Class constructor 报错     | 应使用静态方法：`await vs.X.method()`，不要 `vs.X()`                                                                             |
| IDE 中 `obsidian` 类型报错 | 在 scripts 目录配置 `tsconfig.json` + `obsidian` 类型（见上文）                                                                  |

## 插件开发

```bash
pnpm install
pnpm run dev      # watch 构建到 dist/
pnpm run test
pnpm run lint
```

插件源码在 `src/`。用户脚本示例见 [fixtures/](./fixtures/)。

## 许可证

MIT
