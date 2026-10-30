# dsh-plugin-manager-wj

**WJ 插件终极调度中心**是一个只读的 DeepSeek Harness Web bundle，用于查看当前工具和 MCP 注册。它在“设置 → 插件”中展示工具所属插件、作用域和条件注册状态，以及 MCP Server 的所属插件、作用域、连接状态和公开工具名。

## 要求

Harness 版本需要在 `pluginInventory/list` 中提供工具和 MCP 运行时清单字段。旧版 Host 会显示明确的版本不兼容提示。本插件不读取插件配置、凭据、工具 schema 或执行函数，也不能修改任何注册。

## 安装

将本包安装到 Harness package resolver 可加载的位置，然后将 bundle 加入目标 Web profile。`cordis.patch.yml` 会插入 Host 条目；包中的 `dsh.client` 清单会把浏览器标签页加载到“设置 → 插件”。从 profile 中移除该 bundle 即可卸载标签页，Harness 核心注册表不依赖此界面插件。

发布到 Git 仓库或包 registry 后，可以从对应来源安装。本仓库不会自动发布包或配置 registry。
