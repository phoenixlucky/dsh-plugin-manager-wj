# dsh-plugin-manager-wj

**WJ 插件管理中心**是 DeepSeek Harness 三层插件管理架构的 Web 管理层，扩展现有独立 WJ bundle，并在 **设置 → 插件** 下添加管理标签页。

## 功能

- **Harness Core：**使用 Host 提供的插件注册表、配置解析、冲突检测、生命周期与依赖管理，以及设置服务。
- **Management API：**查看插件状态、健康诊断、配置来源和工具/MCP 运行时注册；可启停当前 Profile 能寻址的插件。
- **Management UI：**搜索插件与诊断，通过现有 schema 表单 `configForms` 编辑非密钥标量配置，并预览受支持的重复注册修复。

启停操作通过 Host 现有 Profile 管理器写入。更改可能即时生效、需要重启、被更高优先级配置覆盖，或被 Host 拒绝。修复预览有时效，并会在诊断项变化后失效。用户选择修复后，只有恰好存在一个可操作目标的低风险修复会自动执行；高风险修复先显示具体影响，再要求用户明确确认。当前修复动作是停用参与全局工具名或 MCP 名称冲突的所选插件。

配置字段来自 Host 提供的 schema。编辑器隐藏密钥字段；配置来源只显示层名称和脱敏标识，不暴露值或文件系统路径。schema 校验和持久化由 Host 负责。

## 要求与限制

需要提供插件管理 Remote、设置表单和运行时清单的 Harness Host。较旧 Host 可能只能查看清单，或显示诊断不可用；升级 Harness 后才能执行管理操作。只有当前 Profile 可寻址的插件可以启停。此界面不安装或卸载包、不编辑凭据，也不运行任意修复命令。

## 安装

1. 让 Harness package resolver 能加载本包，例如使用本地检出版本或已发布包。
2. 将 `dsh-plugin-manager-wj` bundle 加入目标 Web profile。
3. 打开 **设置 → 插件 → 插件管理**。

`dsh.client` 会加载浏览器客户端，`cordis.patch.yml` 会将 bundle 插入 Host。从 profile 移除该 bundle 即可移除管理标签页。Harness 核心注册表和管理服务不依赖此 UI bundle。

本仓库不会自动发布包或配置 package registry。

## 开发

本包使用 ES module。`index.js` 是 Host 入口，`client.js` 是浏览器界面。本地化包元数据位于 `locale/`，界面完整词典在 `client.js` 中注册。运行 `node --test` 检查 bundle 行为，运行 `node --check client.js` 检查语法。Harness API 和 Host 行为在 `deepseek-harness` 仓库实现并测试。

## 许可证

MIT。
