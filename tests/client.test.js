import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../client.js', import.meta.url)), 'utf8')

const element = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) })
const Fragment = Symbol('Fragment')
const sameDeps = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length
  && a.every((value, index) => Object.is(value, b[index]))

function textOf(node) {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  return textOf(node.children)
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

/** Minimal hook runtime: per-component state cells plus deferred effects, enough for this UI. */
function createRuntime() {
  const stores = new Map()
  const queued = []
  let hookStore
  let dirty = false
  const React = {
    Fragment,
    createElement: element,
    useState(initial) {
      const store = hookStore
      const index = store.index++
      if (!store.cells[index]) store.cells[index] = { value: typeof initial === 'function' ? initial() : initial }
      const cell = store.cells[index]
      return [cell.value, next => {
        const value = typeof next === 'function' ? next(cell.value) : next
        if (Object.is(value, cell.value)) return
        cell.value = value
        dirty = true
      }]
    },
    useEffect(fn, deps) {
      const store = hookStore
      const index = store.index++
      const cell = store.cells[index] ?? (store.cells[index] = {})
      const changed = !cell.initialized || !Array.isArray(deps) || !cell.deps || !sameDeps(cell.deps, deps)
      cell.deps = Array.isArray(deps) ? [...deps] : undefined
      cell.fn = fn
      if (changed) {
        cell.initialized = true
        queued.push(cell)
      }
    },
  }

  const storeFor = path => {
    let store = stores.get(path)
    if (!store) {
      store = { path, cells: [], index: 0 }
      stores.set(path, store)
    }
    return store
  }

  const renderNode = (node, path) => {
    if (node === null || node === undefined || typeof node === 'boolean') return null
    if (typeof node === 'string' || typeof node === 'number') return node
    if (Array.isArray(node)) return node.map((child, index) => renderNode(child, `${path}.${index}`))
    const { type, props, children } = node
    if (type === Fragment) return renderNode(children, path)
    if (typeof type === 'function') {
      const store = storeFor(path)
      const previous = hookStore
      hookStore = store
      store.index = 0
      let output
      try {
        output = type({ ...props, children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children })
      } finally {
        hookStore = previous
      }
      return renderNode(output, `${path}>${type.name}`)
    }
    return { type, props, children: children.map((child, index) => renderNode(child, `${path}.${index}`)) }
  }

  return {
    React,
    render(root) {
      dirty = false
      const tree = renderNode(root, 'root')
      const batch = queued.splice(0)
      for (const cell of batch) {
        if (typeof cell.cleanup === 'function') cell.cleanup()
        const cleanup = cell.fn()
        cell.cleanup = typeof cleanup === 'function' ? cleanup : undefined
      }
      return tree
    },
    get dirty() { return dirty },
  }
}

const configView = {
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

/**
 * options.sessionsById   – retained session rows the client store starts with
 * options.skillNamespaces – registry keys exposing the catalog (`remote.<name>`)
 */
function createPage(options = {}) {
  let bundle
  runInNewContext(source, { window: { __ModuleLoader__: { load(next) { bundle = next } } } })
  assert.ok(bundle, 'client bundle should register with the module loader')

  const runtime = createRuntime()
  const dictionary = {}
  const t = key => dictionary[key] ?? key
  const skillsCalls = []
  const enabledWrites = []
  const sessionListeners = new Set()
  const sessionsById = { ...options.sessionsById }
  let remainingFailures = options.skillFailures ?? 0

  const forms = {
    describe() { return { ensure: async () => {}, getSnapshot: () => ({ view: { namespaces: [configView] } }) } },
    get() {
      return {
        subscribe: () => () => {},
        getSnapshot: () => ({ status: 'ready', value: { credentials: {}, label: 'visible' }, revision: 2, writable: true }),
        mutate: async () => true,
      }
    },
  }
  const sessions = {
    list: {
      getSnapshot: () => ({ byId: sessionsById }),
      subscribe: listener => { sessionListeners.add(listener); return () => sessionListeners.delete(listener) },
    },
  }
  const skills = {
    list: async request => {
      skillsCalls.push(request?.sessionId)
      if (remainingFailures > 0) {
        remainingFailures -= 1
        throw new Error('skills unavailable')
      }
      return {
        ok: true,
        value: {
          skills: [
            { name: 'office-xlsx', description: 'Spreadsheet workflows', whenToUse: 'When editing a workbook', modelInvocable: true, path: 'E:/skills/office-xlsx/SKILL.md' },
            { name: 'dsh-badge', description: 'Harness badge', modelInvocable: false },
          ],
        },
      }
    },
  }
  const manager = {
    listPlugins: async () => ({
      ok: true,
      value: [
        { entryId: 'plugin-one', moduleName: 'plugin-one', enabled: true, fiberPhase: 'active', meta: { title: { en: 'Plugin One' } } },
        { entryId: 'plugin-two', moduleName: 'plugin-two', enabled: false, fiberPhase: 'notRunning', meta: { title: { en: 'Plugin Two' } } },
      ],
    }),
    getHealthSnapshot: async () => ({
      ok: true,
      value: { pluginCount: 2, enabledCount: 1, findings: [{ id: 'f1', code: 'tool.duplicate-name', severity: 'error', affectedEntryIds: ['plugin-two'], remediationEntryIds: [], evidence: { name: 'read_file' } }] },
    }),
    getConfigProvenance: async () => ({ ok: true, value: [{ fieldPath: ['label'], effective: { layer: 'profile', identity: 'web' }, shadowed: [] }] }),
    setPluginEnabled: async (entryId, enabled) => {
      enabledWrites.push([entryId, enabled])
      return { ok: true, value: { application: 'applied' } }
    },
  }
  const list = async () => ({
    ok: true,
    value: {
      toolRegistrations: [{ name: 'read_file', scope: 'global', owner: { moduleName: 'fs-plugin', entryId: 'fs' } }],
      mcpClients: [{ serverName: 'chrome', state: 'connected', owner: { moduleName: 'mcp-plugin', entryId: 'mcp' }, toolNames: ['take_screenshot', 'navigate'] }],
    },
  })

  const plugin = bundle.factory(name => name === 'react' ? runtime.React : undefined)
  let registered
  const ctx = {
    locale: { register() {}, bind() { return t } },
    remote: { pluginInventory: { list }, pluginManager: manager },
    get(name) {
      if (name === 'configForms') return forms
      if (name === 'sessions') return sessions
      for (const namespace of options.skillNamespaces ?? ['skills']) {
        if (name === `remote.${namespace}`) return skills
      }
      return undefined
    },
    effect(run) { run() },
    slots: {
      inject(_name, register) { register() },
      register(definition, component) { registered = { definition, component }; return () => {} },
    },
  }
  plugin.apply(ctx)
  assert.equal(registered.definition.name, 'settings.plugins.tab')

  const props = { ...registered.definition.inject(), t }
  const root = element(registered.component, props)
  let tree = runtime.render(root)
  // Node has no window.localStorage, so every page starts on the plugins view.
  assert.equal(find(tree, node => node.props?.role === 'tab' && node.props['aria-selected'] === 'true')[0]?.props.id, 'wj-tab-plugins')

  const settle = async () => {
    for (let round = 0; round < 40; round++) {
      await new Promise(resolve => setTimeout(resolve, 0))
      if (!runtime.dirty) break
      tree = runtime.render(root)
    }
  }
  const tabs = () => find(tree, node => node.props?.role === 'tab')
  const panelById = id => find(tree, node => node.props?.role === 'tabpanel' && node.props.id === id)[0]
  return {
    plugin,
    definition: registered.definition,
    skillsCalls,
    enabledWrites,
    settle,
    get tree() { return tree },
    tabs,
    panelById,
    text: () => textOf(tree),
    clickTab: async id => {
      tabs().find(tab => tab.props.id === id).props.onClick()
      tree = runtime.render(root)
      await settle()
    },
    search: value => {
      find(tree, node => node.props?.type === 'search')[0].props.onChange({ target: { value } })
      tree = runtime.render(root)
    },
    openSession: id => {
      sessionsById[id] = { id, cwd: 'E:/home', retainedBy: { mainView: 1 } }
      for (const listener of sessionListeners) listener()
    },
  }
}

test('the management page switches between plugin, configuration, skill and MCP views', async () => {
  const page = createPage({ sessionsById: { 'sess-1': { id: 'sess-1', cwd: 'E:/home', retainedBy: { mainView: 1 } } } })
  await page.settle()

  // client.js is evaluated in a separate VM context, so its arrays have a different prototype.
  assert.deepEqual(Array.from(page.plugin.inject), ['slots', 'locale', 'remote', 'remote.pluginInventory', 'remote.pluginManager', 'configForms'])
  assert.equal(typeof page.definition.inject().loadSkills, 'function')
  assert.equal(typeof page.definition.inject().readSessionId, 'function')
  assert.equal(typeof page.definition.inject().watchSessions, 'function')

  assert.deepEqual(page.tabs().map(tab => tab.props.id), ['wj-tab-plugins', 'wj-tab-config', 'wj-tab-skill', 'wj-tab-mcp'])
  assert.deepEqual(page.tabs().map(tab => tab.props['aria-selected']), ['true', 'false', 'false', 'false'])
  assert.equal(page.panelById('wj-panel-config'), undefined)
  assert.ok(page.text().includes('Plugin One'))
  assert.ok(page.text().includes('tool.duplicate-name'))
  assert.equal(find(page.tree, node => node.type === 'button' && textOf(node) === 'disable').length, 1)

  await page.clickTab('wj-tab-config')
  assert.equal(page.panelById('wj-panel-config').props.hidden, false)
  assert.equal(page.panelById('wj-panel-plugins').props.hidden, true)
  assert.ok(textOf(page.panelById('wj-panel-config')).includes('profile'))
  // The config view omits a secret object and all of its descendants.
  const configText = textOf(page.panelById('wj-panel-config'))
  assert.ok(configText.includes('label'))
  assert.ok(!configText.includes('credentials'))
  assert.ok(!configText.includes('token'))

  await page.clickTab('wj-tab-skill')
  assert.deepEqual(page.skillsCalls, ['sess-1'])
  assert.ok(page.text().includes('/office-xlsx'))
  assert.ok(textOf(page.panelById('wj-panel-skill')).includes('skillUserOnly'))
  assert.ok(textOf(page.panelById('wj-panel-skill')).includes('E:/skills/office-xlsx/SKILL.md'))

  await page.clickTab('wj-tab-mcp')
  const mcp = textOf(page.panelById('wj-panel-mcp'))
  assert.ok(mcp.includes('chrome') && mcp.includes('take_screenshot'))
  assert.ok(mcp.includes('read_file') && mcp.includes('fs-plugin'))
  assert.equal(find(page.tree, node => node.props?.role === 'tabpanel').length, 4)

  page.search('office')
  await page.settle()
  assert.ok(textOf(page.panelById('wj-panel-mcp')).includes('noMatches'))

  await page.clickTab('wj-tab-plugins')
  assert.ok(!textOf(page.panelById('wj-panel-plugins')).includes('Plugin One'))
  page.search('')
  await page.settle()
  find(page.tree, node => node.type === 'button' && textOf(node) === 'disable')[0].props.onClick()
  await page.settle()
  assert.deepEqual(page.enabledWrites, [['plugin-one', false]])
  assert.ok(page.text().includes('changeApplied'))
})

test('opening a session loads the skill catalog automatically', async () => {
  const page = createPage({ sessionsById: {} })
  await page.settle()
  await page.clickTab('wj-tab-skill')
  assert.ok(page.text().includes('skillNoSession'))
  assert.deepEqual(page.skillsCalls, [])

  page.openSession('sess-2')
  await page.settle()
  assert.deepEqual(page.skillsCalls, ['sess-2'])
  assert.ok(page.text().includes('/office-xlsx'))
})

test('a skills namespace with a different name is discovered', async () => {
  const page = createPage({
    sessionsById: { 'sess-3': { id: 'sess-3', cwd: 'E:/home', retainedBy: { mainView: 1 } } },
    skillNamespaces: ['skillCatalog'],
  })
  await page.settle()
  await page.clickTab('wj-tab-skill')
  assert.deepEqual(page.skillsCalls, ['sess-3'])
  assert.ok(page.text().includes('/office-xlsx'))
})

test('a transient catalog failure recovers from the view', async () => {
  const page = createPage({
    sessionsById: { 'sess-4': { id: 'sess-4', cwd: 'E:/home', retainedBy: { mainView: 1 } } },
    skillFailures: 1,
  })
  await page.settle()
  await page.clickTab('wj-tab-skill')
  assert.ok(page.text().includes('skillError'))
  const retry = find(page.tree, node => node.type === 'button' && textOf(node) === 'retry')[0]
  assert.ok(retry, 'the failure should offer an inline retry')
  retry.props.onClick()
  await page.settle()
  assert.deepEqual(page.skillsCalls, ['sess-4', 'sess-4'])
  assert.ok(page.text().includes('/office-xlsx'))
})
