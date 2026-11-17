# dsh-plugin-manager-wj

[![npm version](https://img.shields.io/npm/v/@tinyforge/dsh-plugin-manager-wj.svg)](https://www.npmjs.com/package/@tinyforge/dsh-plugin-manager-wj)
[![npm downloads](https://img.shields.io/npm/dm/@tinyforge/dsh-plugin-manager-wj.svg)](https://www.npmjs.com/package/@tinyforge/dsh-plugin-manager-wj)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**WJ Plugin Management** is the Web management layer for DeepSeek Harness's three-layer plugin-management design. It extends the independent WJ bundle and adds a management tab under **Settings → Plugins** whose four views switch without leaving the page: **Plugins**, **Configuration**, **Skills** and **MCP**.

## Features

- **Switchable views:** one tab strip switches between plugin health, configuration, the skill catalog, and MCP/tool inventory. A visited view stays mounted, so a configuration draft and the search term survive switching.
- **Harness Core:** consumes the Host's plugin registry, configuration resolver, conflict detector, lifecycle/dependency manager, and settings services.
- **Management API:** shows plugin state and health findings, configuration provenance, and tool/MCP runtime registrations. It can enable or disable profile-addressable plugins.
- **Management UI:** filters the active view, edits non-secret scalar settings through the existing schema-backed `configForms`, and previews supported duplicate-registration repairs.

### Views

| View | Source | Notes |
| --- | --- | --- |
| Plugins | `pluginManager.listPlugins`, `pluginManager.getHealthSnapshot` | Enable/disable, findings, and bounded repair previews. |
| Configuration | `configForms.describe`, `pluginManager.getConfigProvenance` | Secret fields are omitted; provenance shows layers and redacted identities. |
| Skills | `skills/list` through the active session | Session-scoped, so the catalog resolves from the session working directory and reloads automatically when the active session changes. Model-invocable and user-only entries are marked separately. |
| MCP | `pluginInventory.list` | MCP client connections plus the owners of registered tools. |

Enabling or disabling a plugin writes through the Host's existing profile manager. A change can apply immediately, require a restart, be overridden by a higher-priority layer, or be refused by the Host. Repair previews are short-lived and become invalid when their finding changes. Selecting a low-risk repair with one eligible target executes it automatically; a high-risk repair first shows the exact effect and requires an explicit confirmation click. The current repair action disables the selected plugin involved in a duplicate global tool or MCP registration.

Configuration fields are discovered from each Host-provided schema. Secret fields are omitted from the editor, and provenance shows layer names and redacted identities, never values or filesystem paths. The Host remains responsible for schema validation and persistence.

## Requirements and limitations

Use a Harness Host that exposes the plugin-management Remote, settings forms, and runtime inventory. Older Hosts may show inventory only or report diagnostics as unavailable; upgrade Harness to use management actions. Only plugins addressable through the active profile can be toggled.

The tab hard-injects only two core client services, `slots` and `locale`. Everything else — the `pluginInventory` and `pluginManager` remotes, `configForms`, the skills Remote and the live session — is resolved through `ctx.get` at call time rather than declared in `inject`, because a Client plugin that lists an optional service in `inject` stays pending on a Host without it, and a pending plugin registers no tab at all: the settings page then shows no plugin views instead of a degraded one. The Skills view therefore degrades rather than disappearing: no Remote means an explanatory message, and no session means a waiting state that loads the catalog by itself as soon as a session appears or the active session changes, with no manual refresh. The namespace is discovered rather than hardcoded (`skills`, `skill`, `skillCatalog`, then any registered `remote.*` name containing "skill"), so a Host that renames it needs no code change. Skills are read-only here; the UI never loads skill bodies. The UI does not install/remove packages, edit credentials, or run arbitrary repair commands.

## Install

Published on npm as [`@tinyforge/dsh-plugin-manager-wj`](https://www.npmjs.com/package/@tinyforge/dsh-plugin-manager-wj):

```sh
npm install @tinyforge/dsh-plugin-manager-wj
```

1. Make the package available to the Harness package resolver — install it through the Host's plugin manager by package name, or with the command above.
2. Add the `@tinyforge/dsh-plugin-manager-wj` bundle to the target Web profile.
3. Open **Settings → Plugins → Plugin management** and use the view tabs.

`dsh.client` loads the browser client, and `cordis.patch.yml` inserts the bundle into the Host. Remove the bundle from the profile to remove the management tab. Core registry and management services do not depend on this UI bundle.

## Release

```sh
npm test                        # node --test: 11 checks (views, inject contract, patch shape)
npm publish --access public     # writes to registry.npmjs.org
```

The package name is scoped, so publishing a new version needs maintainer access to the `@tinyforge` npm scope. Tag the published commit (`git tag v1.3.2 && git push --tags`) so the GitHub history matches the registry.

## Development

The package is an ES module. `index.js` is the Host entry point and `client.js` contains the browser UI. Localized package metadata is in `locale/`; the UI's full dictionaries are registered in `client.js`.

- `node --test` runs the bundle behavior checks in `tests/client.test.js`: the four views render and switch, the visited views stay mounted, search and enable/disable act on the active view, a secret configuration object stays out of the editor, opening a session loads the skill catalog without a refresh, a renamed skills namespace is discovered, and a transient catalog failure recovers from the inline retry.
- `node --check client.js` checks the browser bundle syntax.
- `tests/patch.test.js` parses `cordis.patch.yml` and asserts no plain scalar starts with a reserved YAML indicator — the scoped package name must stay quoted, or the Host rejects the bundle patch.
- `tests/inject.test.js` pins the plugin's `inject` list to the core services only, so a regressed hard-injection of an optional remote fails the suite instead of silently emptying the settings page on some Hosts.
- `tests/harness.html` mounts the real `client.js` against fixtures in a browser and asserts the same behavior without Node; open it directly from disk and read the JSON report.
- `tests/parse-check.html` is a minimal browser smoke page: it confirms `client.js` parses and registers `settings.plugins.tab`.

Harness API and Host behavior are implemented and tested in the `deepseek-harness` repository.

## License

MIT.
