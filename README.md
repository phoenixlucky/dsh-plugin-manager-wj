# dsh-plugin-manager-wj

**WJ plugin control center** is a read-only DeepSeek Harness Web bundle for inspecting the tools and MCP servers registered at runtime. The package version is **1.1.0**.

The bundle adds a **Registration inventory** tab under **Settings → Plugins**. It reads the Host's `pluginInventory/list` snapshot and displays:

- Tool name, owning plugin, scope, and whether registration is conditional.
- MCP server name, owning plugin, scope, connection state, and public tool names.
- Search across tool names, plugin identifiers, MCP server names, connection states, and MCP tool names; refresh and retry controls are also available.

## Requirements

Use a DeepSeek Harness Host that exposes tool and MCP runtime inventory through `pluginInventory/list`. If the Host does not provide the expected tool-registration fields, the tab shows an unsupported-version message. Older Hosts may therefore need an upgrade.

This package only displays the inventory returned by the Host. It does not read plugin configuration, credentials, tool schemas, or execution functions, and it cannot add, remove, or change registrations.

## Install

1. Make this package available to the Harness package resolver, for example from a local checkout or a package registry where it has been published.
2. Add the `dsh-plugin-manager-wj` bundle to the target Web profile.
3. Open **Settings → Plugins** and select **Registration inventory**.

The package's `dsh.client` manifest loads the browser client, and `cordis.patch.yml` inserts the bundle into the Host. To remove the tab, remove the bundle from the profile. The Harness core registries do not depend on this UI bundle.

This repository does not publish the package or configure a package registry. Publish it to a registry or make it available through Git before installing it from that source.

## Development

The package is an ES module. Its Host entry point is `index.js`; the inventory UI is in `client.js`. Localized strings are in `locale/`, and `cordis.patch.yml` contains the Host bundle patch. No build or test scripts are currently defined in `package.json`.

## License

MIT. See the package metadata for the license declaration.
