# dsh-plugin-manager-wj

[![npm version](https://img.shields.io/npm/v/@tinyforge/dsh-plugin-manager-wj.svg)](https://www.npmjs.com/package/@tinyforge/dsh-plugin-manager-wj)
[![npm downloads](https://img.shields.io/npm/dm/@tinyforge/dsh-plugin-manager-wj.svg)](https://www.npmjs.com/package/@tinyforge/dsh-plugin-manager-wj)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**WJ 插件管理中心**是 DeepSeek Harness 三层插件管理架构的 Web 管理层，扩展现有独立 WJ bundle，并在 **设置 → 插件** 下添加管理标签页。页面内有 **插件 / 配置 / Skill / MCP** 四个视图，可直接切换，不需要离开当前页面。

## 功能

- **可切换视图：**一条标签栏在插件健康、配置、Skill 目录与 MCP/工具清单之间切换。已访问过的视图保持挂载，因此切换时配置草稿和搜索词都不会丢失。
- **Harness Core：**使用 Host 提供的插件注册表、配置解析、冲突检测、生命周期与依赖管理，以及设置服务。
- **Management API：**查看插件状态、健康诊断、配置来源和工具/MCP 运行时注册；可启停当前 Profile 能寻址的插件。
- **Management UI：**按视图过滤，通过现有 schema 表单 `configForms` 编辑非密钥标量配置，并预览受支持的重复注册修复。

### 视图

| 视图 | 数据来源 | 说明 |
| --- | --- | --- |
| 插件 | `pluginManager.listPlugins`、`pluginManager.getHealthSnapshot` | 启停、健康诊断与受控修复预览。 |
| 配置 | `configForms.describe`、`pluginManager.getConfigProvenance` | 隐藏密钥字段；来源只显示层名称与脱敏标识。 |
| Skill | 通过当前会话读取 `skills/list` | 按会话解析，目录来自会话工作目录，并在活动会话变化时自动重新加载；模型可调用与仅用户可调用分开标记。 |
| MCP | `pluginInventory.list` | MCP 客户端连接状态，以及工具注册的归属插件。 |

启停操作通过 Host 现有 Profile 管理器写入。更改可能即时生效、需要重启、被更高优先级配置覆盖，或被 Host 拒绝。修复预览有时效，并会在诊断项变化后失效。用户选择修复后，只有恰好存在一个可操作目标的低风险修复会自动执行；高风险修复先显示具体影响，再要求用户明确确认。当前修复动作是停用参与全局工具名或 MCP 名称冲突的所选插件。

配置字段来自 Host 提供的 schema。编辑器隐藏密钥字段；配置来源只显示层名称和脱敏标识，不暴露值或文件系统路径。schema 校验和持久化由 Host 负责。

## 要求与限制

需要提供插件管理 Remote、设置表单和运行时清单的 Harness Host。较旧 Host 可能只能查看清单，或显示诊断不可用；升级 Harness 后才能执行管理操作。只有当前 Profile 可寻址的插件可以启停。

Skill 视图需要两个可选客户端服务：skills Remote 与一个存活会话。两者都在调用时通过 `ctx.get` 读取，不写进 `inject`——把可选服务写进 `inject` 会让客户端插件在缺少该服务的 Host 上一直处于 pending 状态，整个标签页都不会出现。因此该视图只会降级而不会消失：没有 Remote 时给出说明；没有会话时进入等待状态，一旦出现会话或活动会话切换，就自动加载目录，无需手动刷新。命名空间是探测出来的而不是写死的（依次尝试 `skills`、`skill`、`skillCatalog`，再扫描任何含 “skill” 的已注册 `remote.*`），所以 Host 改名也不需要改代码。Skill 在这里是只读的，界面不会加载 skill 正文。此界面不安装或卸载包、不编辑凭据，也不运行任意修复命令。

## 安装

已发布到 npm：[`@tinyforge/dsh-plugin-manager-wj`](https://www.npmjs.com/package/@tinyforge/dsh-plugin-manager-wj)。

```sh
npm install @tinyforge/dsh-plugin-manager-wj
```

1. 让 Harness package resolver 能加载本包 —— 在 Host 插件管理里按包名安装，或执行上面的命令。
2. 将 `@tinyforge/dsh-plugin-manager-wj` bundle 加入目标 Web profile。
3. 打开 **设置 → 插件 → 插件管理**，使用视图标签切换。

`dsh.client` 会加载浏览器客户端，`cordis.patch.yml` 会将 bundle 插入 Host。从 profile 移除该 bundle 即可移除管理标签页。Harness 核心注册表和管理服务不依赖此 UI bundle。

## 发布

```sh
npm test                        # node --test：4 个行为测试
npm publish --access public     # 发布到 registry.npmjs.org
```

包名带 scope，发布新版本需要 `@tinyforge` npm scope 的维护者权限。发布后给对应提交打 tag（`git tag v1.3.0 && git push --tags`），让 GitHub 历史与 registry 版本对应。

## 开发

本包使用 ES module。`index.js` 是 Host 入口，`client.js` 是浏览器界面。本地化包元数据位于 `locale/`，界面完整词典在 `client.js` 中注册。

- `node --test` 运行 `tests/client.test.js` 的行为检查：四个视图渲染并可切换、访问过的视图保持挂载、搜索与启停作用于当前视图、密钥配置对象不会进入编辑器、打开会话后无需刷新即加载 Skill 目录、改名后的 skills 命名空间能被发现，以及瞬时目录失败可就地重试恢复。
- `node --check client.js` 检查浏览器 bundle 语法。
- `tests/harness.html` 在浏览器中用测试夹具挂载真实 `client.js`，不依赖 Node 也能断言同一批行为；直接从磁盘打开并读取 JSON 报告。
- `tests/parse-check.html` 是最小的浏览器冒烟页：确认 `client.js` 能解析并注册 `settings.plugins.tab`。

Harness API 和 Host 行为在 `deepseek-harness` 仓库实现并测试。

## 许可证

MIT。
