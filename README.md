# dsh-plugin-manager-wj

**WJ Plugin Management** is the Web management layer for DeepSeek Harness's three-layer plugin-management design. It extends the independent WJ bundle and adds a management tab under **Settings → Plugins**.

## Features

- **Harness Core:** consumes the Host's plugin registry, configuration resolver, conflict detector, lifecycle/dependency manager, and settings services.
- **Management API:** shows plugin state and health findings, configuration provenance, and tool/MCP runtime registrations. It can enable or disable profile-addressable plugins.
- **Management UI:** filters findings and plugins, edits non-secret scalar settings through the existing schema-backed `configForms`, and previews supported duplicate-registration repairs.

Enabling or disabling a plugin writes through the Host's existing profile manager. A change can apply immediately, require a restart, be overridden by a higher-priority layer, or be refused by the Host. Repair previews are short-lived and become invalid when their finding changes. Selecting a low-risk repair with one eligible target executes it automatically; a high-risk repair first shows the exact effect and requires an explicit confirmation click. The current repair action disables the selected plugin involved in a duplicate global tool or MCP registration.

Configuration fields are discovered from each Host-provided schema. Secret fields are omitted from the editor, and provenance shows layer names and redacted identities, never values or filesystem paths. The Host remains responsible for schema validation and persistence.

## Requirements and limitations

Use a Harness Host that exposes the plugin-management Remote, settings forms, and runtime inventory. Older Hosts may show inventory only or report diagnostics as unavailable; upgrade Harness to use management actions. Only plugins addressable through the active profile can be toggled. The UI does not install/remove packages, edit credentials, or run arbitrary repair commands.

## Install

1. Make this package available to the Harness package resolver, for example from a local checkout or published package.
2. Add the `dsh-plugin-manager-wj` bundle to the target Web profile.
3. Open **Settings → Plugins → Plugin management**.

`dsh.client` loads the browser client, and `cordis.patch.yml` inserts the bundle into the Host. Remove the bundle from the profile to remove the management tab. Core registry and management services do not depend on this UI bundle.

This repository does not publish the package or configure a package registry.

## Development

The package is an ES module. `index.js` is the Host entry point and `client.js` contains the browser UI. Localized package metadata is in `locale/`; the UI's full dictionaries are registered in `client.js`. Run `node --test` for the bundle behavior check and `node --check client.js` for a syntax check. Harness API and Host behavior are implemented and tested in the `deepseek-harness` repository.

## License

MIT.
