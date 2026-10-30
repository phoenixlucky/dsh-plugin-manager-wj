import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'

function element(type, props, ...children) {
  return { type, props: props ?? {}, children: children.flat(Infinity) }
}

function find(node, predicate, matches = []) {
  if (Array.isArray(node)) {
    for (const child of node) find(child, predicate, matches)
  } else if (node && typeof node === 'object') {
    if (predicate(node)) matches.push(node)
    find(node.children, predicate, matches)
  }
  return matches
}

test('schema form omits a secret object and all of its descendants', () => {
  let plugin
  const React = {
    Fragment: Symbol('Fragment'),
    createElement: element,
    useEffect() {},
    useState(initial) {
      const index = hookIndex++
      return [index === 0 ? ready : initial, () => {}]
    },
  }
  let hookIndex = 0
  const source = readFileSync(fileURLToPath(new URL('../client.js', import.meta.url)), 'utf8')
  runInNewContext(source, {
    window: { __ModuleLoader__: { load(bundle) { plugin = bundle.factory(name => name === 'react' ? React : undefined) } } },
  })
  assert.ok(plugin.inject.includes('remote.pluginManager'))
  assert.ok(plugin.inject.includes('configForms'))

  const locale = {
    register() {},
    bind() { return key => key },
  }
  const forms = {
    describe() { return { ensure: async () => {}, getSnapshot: () => ({ view: { namespaces: [] } }) } },
    get() {
      return {
        subscribe: () => () => {},
        getSnapshot: () => ({ status: 'ready', value: { credentials: {}, label: 'visible' }, revision: 2, writable: true }),
      }
    },
  }
  const ctx = {
    locale,
    remote: { pluginInventory: { list: async () => ({ ok: true, value: { toolRegistrations: [], mcpClients: [] } }) } },
    get: key => key === 'configForms' ? forms : undefined,
    effect(run) { run() },
    slots: {
      inject(_name, register) { register() },
      register(_definition, component) { pluginComponent = component; return () => {} },
    },
  }
  let pluginComponent
  plugin.apply(ctx)

  const view = {
    ns: 'secret-plugin',
    schema: {
      uid: 'root',
      refs: {
        root: { type: 'object', dict: { credentials: 'credentials', label: 'label' } },
        credentials: { type: 'object', meta: { role: 'secret' }, dict: { token: 'token' } },
        token: { type: 'string' },
        label: { type: 'string' },
      },
    },
    secrets: [{ path: ['credentials'], set: true }],
    value: { credentials: {}, label: 'visible' },
    revision: 2,
    writable: true,
  }
  const ready = {
    kind: 'ready',
    inventory: { toolRegistrations: [], mcpClients: [] },
    plugins: [],
    health: { pluginCount: 0, enabledCount: 0, findings: [] },
    settings: { namespaces: [view] },
    provenance: new Map(),
  }
  hookIndex = 0
  const page = pluginComponent({ list: async () => ({}), manager: undefined, forms, t: key => key })
  const section = find(page, node => node.type?.name === 'ConfigSection')[0]
  assert.ok(section, 'configuration form should be part of the management page')
  hookIndex = 0
  const form = section.type(section.props)
  const editors = find(form, node => node.type?.name === 'FieldEditor')
  assert.equal(JSON.stringify(editors.map(editor => editor.props.field.path)), JSON.stringify([['label']]))
})
