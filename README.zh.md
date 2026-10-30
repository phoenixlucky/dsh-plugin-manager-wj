# dsh-plugin-manager-wj

**WJ 插件管理中心**是一个只读的 DeepSeek Harness Web bundle，用于查看运行时注册的工具和 MCP Server。当前包版本为 **1.1.0**。

插件会在 **设置 → 插件** 中添加“注册清单”标签页，读取 Host 的 `pluginInventory/list` 快照并展示：

- 工具名称、所属插件、作用域，以及是否为条件注册。
- MCP Server 名称、所属插件、作用域、连接状态和公开工具名称。
- 可按工具名称、插件标识、MCP Server 名称、连接状态或 MCP 工具名称搜索，并支持刷新和失败后重试。

## 要求

DeepSeek Harness Host 需要通过 `pluginInventory/list` 提供工具和 MCP 运行时清单。若 Host 未提供预期的工具注册字段，标签页会显示版本不兼容提示；较旧的 Host 可能需要升级。

本包只展示 Host 返回的清单，不读取插件配置、凭据、工具 schema 或执行函数，也不能添加、删除或修改注册。

## 安装

1. 让 Harness package resolver 能加载本包，例如使用本地检出版本，或使用已发布到 registry 的版本。
2. 将 `dsh-plugin-manager-wj` bundle 加入目标 Web profile。
3. 打开 **设置 → 插件**，选择“注册清单”。

包中的 `dsh.client` manifest 会加载浏览器端插件，`cordis.patch.yml` 会将 bundle 插入 Host。要移除标签页，从 profile 中移除该 bundle 即可。Harness 核心注册表不依赖此 UI bundle。

本仓库不会自动发布包或配置 package registry。通过 Git 或 registry 安装前，需要先将包发布到对应来源或确保该来源可访问。

## 开发

本包使用 ES module。Host 入口为 `index.js`，清单界面位于 `client.js`，本地化文案位于 `locale/`，Host bundle patch 位于 `cordis.patch.yml`。当前 `package.json` 未定义构建或测试脚本。

## 许可证

MIT。许可证声明见包元数据。
