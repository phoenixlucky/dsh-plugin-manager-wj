# dsh-plugin-manager-wj

[![npm version](https://img.shields.io/npm/v/@tinyforge/dsh-plugin-manager-wj.svg)](https://www.npmjs.com/package/@tinyforge/dsh-plugin-manager-wj)
[![npm downloads](https://img.shields.io/npm/dm/@tinyforge/dsh-plugin-manager-wj.svg)](https://www.npmjs.com/package/@tinyforge/dsh-plugin-manager-wj)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**WJ 插件管理中心**是 DeepSeek Harness 三层插件管理架构的 Web 管理层，扩展现有独立 WJ bundle，并在 **设置 → 插件** 下添加管理标签页。页面内有 **插件 / 配置 / Skill / 工具** 四个视图，可直接切换，不需要离开当前页面。

## 功能

- **可切换视图：**一条标签栏在插件健康、配置、Skill 目录与工具注册归属之间切换。已访问过的视图保持挂载，因此切换时配置草稿和搜索词都不会丢失。
- **Harness Core：**使用 Host 提供的插件注册表、配置解析、冲突检测、生命周期与依赖管理，以及设置服务。
- **Management API：**查看插件状态、激活诊断、配置来源和工具运行时注册；可启停当前 Profile 能寻址的插件。
- **Management UI：**按视图过滤，通过现有 schema 表单 `configForms` 编辑非密钥标量配置；工具视图给出每个工具的作用域与归属（MCP 服务器或推断出的插件包）。插件行显示包本地化的标题与说明；Loader 内部条目若没有包元数据，会明确写出这一点，而不是留空。

### 视图

| 视图 | 数据来源 | 说明 |
| --- | --- | --- |
| 插件 | `pluginInventory.list()` 的 Loader 投影 | 启停当前 Profile 能寻址的条目，并由失败 fiber 派生激活诊断。 |
| 配置 | `configForms.describe`、`pluginManager.getConfigProvenance` | 隐藏密钥字段；来源只显示层名称与脱敏标识。 |
| Skill | 通过当前会话读取 `skills/list` | 按会话解析，目录来自会话工作目录，并在活动会话变化时自动重新加载；模型可调用与仅用户可调用分开标记。 |
| 工具 | 本包 Host 半边的 `GET /api/wj/tool-inventory` | 运行时工具注册清单，以及每个工具由哪个插件提供、作用于哪个范围。 |

启停操作通过 Host 的 `pluginManager.setPluginEnabled` 写入 Profile。更改可能即时生效、需要重启、被更高优先级配置覆盖、被 Host 取消或被拒绝，结果原样回显。

工具归属分三种来源：名字符合 `mcp__<服务器>__<工具>` 的 MCP 工具直接归给该服务器；其余名字由 Host 半边扫描各插件包入口 bundle 中的 `name: '…'` 字面量匹配，标注为**推断**；两者都匹配不到时如实显示"宿主未暴露归属"，不做猜测。

MCP 服务器本身由 Host 的 MCP 设置 bundle 管理（例如 `@tinyforge/dsh-mcp-settings`）：它注册 `settings.section` 的 `mcp` 页面，并读取 `mcpClientStatus/list`。本插件既不读取 `mcpClientStatus`，也不列出 MCP 服务器清单——工具视图只展示工具注册行，MCP 工具由所属服务器标注。

配置字段来自 Host 提供的 schema。编辑器隐藏密钥字段；配置来源只显示层名称和脱敏标识，不暴露值或文件系统路径。schema 校验和持久化由 Host 负责。

## 要求与限制

需要提供插件 Loader 投影（`pluginInventory.list()`）的 Harness Host；0.2.2-rc 系列即如此。较旧 Host 若返回的是带 `toolRegistrations` 的旧清单，插件仍能显示插件与工具行，只是没有失败 fiber 诊断。工具视图依赖本包 Host 半边注册的 `/api/wj/tool-inventory`；该路由不存在的 Host（例如只装客户端半边）会明确提示路由缺失，而不是显示空清单。只有当前 Profile 可寻址的插件可以启停。

本包**不再依赖** Host 的诊断接口：`getHealthSnapshot`、`previewRemediation`、`applyRemediation` 在当前官方 Host 中已不存在，页面改为由 Loader 投影自行派生诊断（失败 fiber + 其 `diagnostic`），因此不会再出现"此 Harness Host 尚未提供诊断接口"的整页提示。

标签页只硬注入两个核心客户端服务：`slots` 与 `locale`。其余服务 —— `pluginInventory`、`pluginManager` 两个 remote、`configForms`、skills Remote 与存活会话 —— 都在调用时通过 `ctx.get` 解析，而不写进 `inject`：把可选服务写进 `inject` 会让客户端插件在缺少该服务的 Host 上一直处于 pending 状态，而 pending 的插件不注册任何标签页，设置页面会变成完全没有插件视图，而不是降级显示。因此 Skill 视图只会降级而不会消失：没有 Remote 时给出说明；没有会话时进入等待状态，一旦出现会话或活动会话切换，就自动加载目录，无需手动刷新。命名空间是探测出来的而不是写死的（依次尝试 `skills`、`skill`、`skillCatalog`，再扫描任何含 “skill” 的已注册 `remote.*`），所以 Host 改名也不需要改代码。Skill 在这里是只读的：Host 只提供 `skills/list`（策略 `reader-session-read`），也没有 skills 配置命名空间，因此没有可用于启用或停用条目的 Remote，界面展示当前会话可见的内容，而不提供一个实际无效的开关。界面不会加载 skill 正文。此界面不安装或卸载包、不编辑凭据，也不运行任意修复命令。

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
npm test                        # node --test：30 项检查（视图、工具归属、Host 路由、inject 契约、模块 id、patch 结构）
npm publish --access public     # 发布到 registry.npmjs.org
```

包名带 scope，发布新版本需要 `@tinyforge` npm scope 的维护者权限。发布后给对应提交打 tag（`git tag v1.6.0 && git push --tags`），让 GitHub 历史与 registry 版本对应。

## 开发

本包使用 ES module，两个半边各有入口：`index.js` 是 Host 入口，`client.js` 是浏览器界面。本地化包元数据位于 `locale/`，界面完整词典在 `client.js` 中注册。

Host 半边把浏览器读不到的东西端出去：官方 `ctx.remote` 是编译期白名单，第三方包无法新增命名空间，`ctx.tools` 又只存在于 Host，因此工具清单经 `ctx.connection.fetch.register()` 以 `GET /api/wj/tool-inventory` 提供给自己的客户端，只对 owner peer 开放。`inject` 只写 `connection`，缺少它会话时插件保持 active 并让页面自行说明，而不是启动失败。

`client.js` 以 `__ModuleLoader__.load({ id: '@tinyforge/dsh-plugin-manager-wj', … })` 注册。这个 id 必须是完整包名（含 scope）：客户端模块加载器按包名给每个 Loader 行建索引，注册成别的 id 会被判定为"加载了却没有注册自身所在的行"，插件因此拿不到 fiber，设置里的标签页完全不出现。改包名时必须在同一次提交里一起改这个 id。

- `node --test` 运行行为检查：四个视图渲染并可切换、访问过的视图保持挂载、搜索与启停作用于当前视图、密钥配置对象不会进入编辑器、打开会话后无需刷新即加载 Skill 目录、改名后的 skills 命名空间能被发现、瞬时目录失败可就地重试恢复、Host 不挂载任何可选服务时标签页仍然注册；Host 半边侧另有一组纯函数与路由检查（MCP 命名、包源码扫描预算、按作用域收集工具、快照形状、`GET /api/wj/tool-inventory` 的 JSON 与响应头、缺少 connection 时不激活路由）。
- `node --check client.js` 与 `node --check index.js` 检查两个半边的语法。
- `tests/patch.test.js` 解析 `cordis.patch.yml`，确保没有裸标量以 YAML 保留字符开头 —— 带 scope 的包名必须保持加引号，否则 Host 会拒绝该 bundle patch。
- `tests/inject.test.js` 把插件的 `inject` 固定为仅核心服务，这样一旦有人重新硬注入可选 remote，测试就会失败，而不是在某些 Host 上悄悄把设置页清空。
- `tests/module-id.test.js` 断言注册的模块 id 等于 `package.json` 的 `name`，避免改名后浏览器 bundle 悄悄脱离自己的 Loader 行。
- `tests/harness.html` 在浏览器中用测试夹具挂载真实 `client.js`，不依赖 Node 也能断言同一批行为；直接从磁盘打开并读取 JSON 报告。
- `tests/parse-check.html` 是最小的浏览器冒烟页：确认 `client.js` 能解析并注册 `plugins.tab`（插件页的标签槽；旧版的 `settings.plugins.tab` 在当前 DSH 中并不存在，注册会落空）。

Harness API 和 Host 行为在 `deepseek-harness` 仓库实现并测试。

## 许可证

MIT。
