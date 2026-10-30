# dsh-plugin-manager-wj

**WJ plugin control center** is a read-only DeepSeek Harness Web bundle for inspecting active tool and MCP registrations. Its Settings tab shows each tool's owning plugin, scope, and conditional status, plus each MCP server's owner, scope, connection state, and public tool names.

## Requirements

Use a Harness build that includes the tool and MCP registration inventory fields on `pluginInventory/list`. Older Hosts show an explicit unsupported-version message. The plugin does not read plugin configuration, credentials, tool schemas, or execution functions, and it cannot change registrations.

## Install

Install this package where the Harness package resolver can load it, then add the bundle to the target Web profile. The included `cordis.patch.yml` inserts the Host row; the package's `dsh.client` manifest loads the browser tab into Settings → Plugins. Remove that bundle from the profile to uninstall the tab. The Harness core registries remain independent of this UI plugin.

The package can be installed from a Git repository or a package registry after it is published there. This repository does not publish or configure a registry automatically.
