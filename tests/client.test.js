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
    useRef(initial) {
      const store = hookStore
      const index = store.index++
      if (!store.refs[index]) store.refs[index] = { current: initial }
      return store.refs[index]
    },
  }

  const storeFor = path => {
    let store = stores.get(path)
    if (!store) {
      store = { path, cells: [], refs: [], index: 0 }
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
 * options.bareHost        – no remotes and no settings forms, i.e. a Host that mounts neither
 */
function createPage(options = {}) {
  let bundle
  const toolCalls = []
  // The Host half serves the registry on `/api/wj/tool-inventory`; this stub plays that route so the
  // page can be driven without a Host.
  const fetch = async (url, init) => {
    toolCalls.push({ url, init })
    // A real route answers over the network, so its promise settles after React has already flushed
    // the loading render and every effect pass that follows it. `toolDelayMs` reproduces that order.
    if (options.toolDelayMs) await new Promise(resolve => setTimeout(resolve, options.toolDelayMs))
    if (options.toolRoute === 'missing') return { ok: false, status: 404 }
    if (options.toolRoute === 'offline') throw new Error('offline')
    return { ok: true, status: 200, json: async () => ({ tools: options.tools ?? [] }) }
  }
  runInNewContext(source, { window: { __ModuleLoader__: { load(next) { bundle = next } } }, fetch })
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
  // The official Host shaped this surface twice: `pluginInventory.list()` now projects the Loader
  // (`entries`, `managementAvailable`), and `pluginManager` only manages profile files. Neither
  // carries a tool registry, which is why the page reads its own `/api` route for that.
  const manager = {
    getConfigProvenance: async () => ({ ok: true, value: [{ fieldPath: ['label'], effective: { layer: 'profile', identity: 'web' }, shadowed: [] }] }),
    setPluginEnabled: async (entryId, enabled) => {
      enabledWrites.push([entryId, enabled])
      return { ok: true, value: { changed: true, application: 'applied', stage: 'enable', target: entryId, enabled } }
    },
  }
  const entries = options.entries ?? [
    { entryId: 'plugin-one', moduleName: 'plugin-one', enabled: true, fiberPhase: 'active', meta: { title: { en: 'Plugin One' } } },
    { entryId: 'plugin-two', moduleName: 'plugin-two', enabled: false, fiberPhase: 'failed', diagnostic: 'boom: missing service', meta: { title: { en: 'Plugin Two' } } },
  ]
  const list = async () => ({
    ok: true,
    value: options.legacy
      // A Host that answers with the older snapshot still fills the plugin view.
      ? {
        toolRegistrations: [{ name: 'read_file', scope: 'global', owner: { moduleName: 'fs-plugin', entryId: 'fs' } }],
        mcpClients: [{ serverName: 'chrome', state: 'connected', owner: { moduleName: 'mcp-plugin', entryId: 'mcp' }, toolNames: ['take_screenshot', 'navigate'] }],
      }
      : { entries, managementAvailable: options.managementAvailable !== false },
  })

  const plugin = bundle.factory(name => name === 'react' ? runtime.React : undefined)
  let registered
  // Cordis exposes a service both as `ctx.remote` and as `ctx.get('remote')`; each remote namespace
  // is also its own `remote.<name>` service, which is what the client probes first. `mcpClientStatus`
  // is deliberately absent: MCP server state belongs to the Host's MCP settings bundle, and this
  // page must not read it or render a competing server list.
  const remotes = { pluginInventory: { list }, pluginManager: manager }
  const ctx = {
    locale: {
      register() {},
      bind() { return t },
      ...(options.resolveText === undefined ? {} : { resolveText: options.resolveText }),
    },
    remote: options.bareHost ? undefined : remotes,
    get(name) {
      if (options.bareHost) return undefined
      if (name === 'remote') return remotes
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
  assert.equal(registered.definition.name, 'plugins.tab')

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
    toolCalls,
    settle,
    get tree() { return tree },
    tabs,
    panelById,
    text: () => textOf(tree),
    waitFor: async (predicate, rounds = 100) => {
      for (let round = 0; round < rounds; round++) {
        if (predicate()) return true
        await new Promise(resolve => setTimeout(resolve, 5))
        if (runtime.dirty) tree = runtime.render(root)
      }
      return predicate()
    },
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

test('the management page switches between plugin, configuration, skill and tool views', async () => {
  const page = createPage({
    sessionsById: { 'sess-1': { id: 'sess-1', cwd: 'E:/home', retainedBy: { mainView: 1 } } },
    tools: [
      { name: 'read_file', scope: 'global', description: 'Read a file', owner: { kind: 'package', moduleName: 'fs-plugin', entryId: 'fs', inferred: true } },
      { name: 'mcp__chrome__take_screenshot', scope: 'agent', agentId: 'sess-1', owner: { kind: 'mcp', serverName: 'chrome' } },
    ],
  })
  await page.settle()

  // client.js is evaluated in a separate VM context, so its arrays have a different prototype.
  // Only core services are hard-injected; remotes and settings forms stay optional so a Host that
  // never mounts one still gets the tab instead of a permanently pending plugin.
  assert.deepEqual(Array.from(page.plugin.inject), ['slots', 'locale'])
  assert.equal(typeof page.definition.inject().loadSkills, 'function')
  assert.equal(typeof page.definition.inject().readSessionId, 'function')
  assert.equal(typeof page.definition.inject().watchSessions, 'function')

  assert.deepEqual(page.tabs().map(tab => tab.props.id), ['wj-tab-plugins', 'wj-tab-findings', 'wj-tab-config', 'wj-tab-skill', 'wj-tab-tools'])
  assert.deepEqual(page.tabs().map(tab => tab.props['aria-selected']), ['true', 'false', 'false', 'false', 'false'])
  assert.equal(page.panelById('wj-panel-config'), undefined)
  assert.ok(page.text().includes('Plugin One'))
  assert.ok(!page.text().includes('diagnosticsUnavailable'), 'a Host that projects the Loader needs no fallback notice')
  assert.equal(find(page.tree, node => node.type === 'button' && textOf(node) === 'disable').length, 1)

  // Findings are their own view: the failed fiber and its diagnostic live there, not at the top of
  // the plugin list, and the tab carries the same count as the summary stat.
  const findingsTab = page.tabs().find(tab => tab.props.id === 'wj-tab-findings')
  assert.ok(textOf(findingsTab).includes('1'), 'the findings tab shows the finding count')
  await page.clickTab('wj-tab-findings')
  assert.ok(textOf(page.panelById('wj-panel-findings')).includes('plugin.activation-failed'))
  assert.ok(textOf(page.panelById('wj-panel-findings')).includes('boom: missing service'))
  assert.ok(!textOf(page.panelById('wj-panel-plugins')).includes('plugin.activation-failed'), 'the plugin list no longer repeats findings')

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

  // The registry is session-wide Host state, so it is read when the page mounts: the count is in
  // the summary and the tab before the Tools view is ever opened.
  assert.equal(page.toolCalls.length, 1, 'the registry route is read once when the page mounts')
  assert.equal(page.toolCalls[0].url, '/api/wj/tool-inventory')
  assert.equal(page.toolCalls[0].init?.credentials, 'same-origin')
  const toolsTab = page.tabs().find(tab => tab.props.id === 'wj-tab-tools')
  assert.ok(textOf(toolsTab).includes('2'), 'the tools tab carries its count before the first visit')

  await page.clickTab('wj-tab-tools')
  assert.equal(page.toolCalls.length, 1, 'opening the view reads nothing a second time')
  const tools = textOf(page.panelById('wj-panel-tools'))
  assert.ok(tools.includes('read_file') && tools.includes('fs-plugin'), 'tool ownership should render')
  assert.ok(tools.includes('ownerInferred'), 'a package-scan attribution must be labelled as inferred')
  assert.ok(tools.includes('mcp__chrome__take_screenshot') && tools.includes('chrome'), 'MCP tools are tools, owned by their server')
  assert.ok(tools.includes('sess-1'), 'an agent-scoped registration shows its scope')
  assert.equal(find(page.tree, node => node.props?.role === 'tabpanel').length, 5)

  page.search('office')
  await page.settle()
  assert.ok(textOf(page.panelById('wj-panel-tools')).includes('noMatches'))

  await page.clickTab('wj-tab-plugins')
  assert.ok(!textOf(page.panelById('wj-panel-plugins')).includes('Plugin One'))
  page.search('')
  await page.settle()
  find(page.tree, node => node.type === 'button' && textOf(node) === 'disable')[0].props.onClick()
  await page.settle()
  assert.deepEqual(page.enabledWrites, [['plugin-one', false]])
  assert.ok(page.text().includes('changeApplied'))
})

test('plugin rows carry a localized introduction instead of a bare module name', async () => {
  // `PluginLocalizedMeta` titles and descriptions are `LocalizedText`: a plain string or a map with
  // an English fallback. Reading only `.en`/`.zh` used to leave the technical module name on every
  // row and dropped the introduction entirely, which is exactly what a person needs to tell
  // `ui-directory-picker-native` apart from any other plugin.
  const page = createPage({
    sessionsById: {},
    resolveText: value => typeof value === 'string' ? value : (value.zh ?? value.en),
    entries: [
      {
        entryId: 'picker',
        moduleName: 'ui-directory-picker-native',
        enabled: true,
        fiberPhase: 'active',
        meta: {
          title: { en: 'Native directory picker', zh: '系统目录选择界面' },
          description: { en: 'Drives the OS directory chooser.', zh: '连接工作区选择入口与系统目录选择对话框。' },
        },
      },
      { entryId: 'include:timer', moduleName: 'timer', enabled: true, fiberPhase: 'active' },
      { entryId: 'bare', moduleName: 'bare-package', enabled: true, fiberPhase: 'active', meta: { title: 'Bare package' } },
    ],
  })
  await page.settle()

  const plugins = textOf(page.panelById('wj-panel-plugins'))
  assert.ok(plugins.includes('系统目录选择界面'), 'the current language wins over the English title')
  assert.ok(!plugins.includes('ui-directory-picker-native'), 'a localized title replaces the module name')
  assert.ok(plugins.includes('连接工作区选择入口与系统目录选择对话框。'), 'the introduction is rendered under the title')
  assert.ok(plugins.includes('Bare package'), 'a plain-string title resolves as-is')
  assert.ok(plugins.includes('pluginNoMeta'), 'a Loader-internal entry states that it has no package metadata')
  assert.ok(plugins.includes('pluginNoDescription'), 'a package that declares no introduction says so')

  page.search('系统目录')
  await page.settle()
  assert.ok(textOf(page.panelById('wj-panel-plugins')).includes('系统目录选择界面'), 'search matches the localized title')
  page.search('选择对话框')
  await page.settle()
  assert.ok(textOf(page.panelById('wj-panel-plugins')).includes('系统目录选择界面'), 'search matches the localized introduction')
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

test('the tab registers on a Host that mounts no optional services', async () => {
  // Hard-injecting remote.pluginInventory, remote.pluginManager or configForms left the plugin
  // pending on a Host that never mounts one, and a pending plugin registers no slot entry at all —
  // the settings page then showed no plugin views. With only core services injected, the entry
  // still registers and the page degrades to its retryable error state.
  const page = createPage({ sessionsById: {}, bareHost: true })
  await page.settle()

  assert.equal(page.definition.name, 'plugins.tab')
  assert.equal(page.definition.id, 'wj-registration-inventory')
  assert.ok(page.text().includes('error'), 'the page should report the unreadable inventory')
  assert.ok(find(page.tree, node => node.type === 'button' && textOf(node) === 'retry').length >= 1, 'the failure should offer a retry')
})

test('a healthy plugin set reports zero findings and says so in its own view', async () => {
  // "0 findings" is a real answer, not an empty list: the view explains what a finding is and why
  // none exists, instead of falling back to the generic "no records" message.
  const page = createPage({
    sessionsById: {},
    entries: [{ entryId: 'ok', moduleName: 'ok-plugin', enabled: true, fiberPhase: 'active', meta: { title: 'OK plugin' } }],
  })
  await page.settle()
  const findingsTab = page.tabs().find(tab => tab.props.id === 'wj-tab-findings')
  assert.ok(textOf(findingsTab).includes('0'), 'the findings tab reports the zero count')
  await page.clickTab('wj-tab-findings')
  const findings = textOf(page.panelById('wj-panel-findings'))
  assert.ok(findings.includes('findingsIntro'), 'the view explains what a finding is')
  assert.ok(findings.includes('findingsEmpty'), 'an empty result is explained rather than shown as no records')
})

test('tool rows come from the Host route and never from a second MCP surface', async () => {
  // @tinyforge/dsh-mcp-settings owns the MCP page: it registers `settings.section` id `mcp` and
  // reads `mcpClientStatus/list` itself. This tab keeps only the plugin-side diagnostic — which
  // plugin registered a tool — and reads no MCP client remote, so the two pages cannot drift apart.
  const page = createPage({
    sessionsById: {},
    tools: [{ name: 'read_file', scope: 'global', owner: { kind: 'package', moduleName: 'fs-plugin', entryId: 'fs', inferred: true } }],
  })
  await page.settle()

  assert.equal(page.definition.inject().listMcpStatus, undefined, 'the MCP status remote must not be read')
  await page.clickTab('wj-tab-tools')
  const tools = textOf(page.panelById('wj-panel-tools'))
  assert.ok(tools.includes('read_file'), 'tool registrations should still render')
  assert.ok(tools.includes('fs-plugin'), 'the owning plugin should render')
  assert.ok(tools.includes('global'), 'the tool scope should render')
})

test('a Host without the registry route explains itself instead of showing an empty list', async () => {
  const page = createPage({ sessionsById: {}, toolRoute: 'missing' })
  await page.settle()
  await page.clickTab('wj-tab-tools')

  const tools = textOf(page.panelById('wj-panel-tools'))
  assert.ok(tools.includes('toolInventoryUnavailable'), 'the missing route is named, not silently empty')
  assert.ok(find(page.tree, node => node.type === 'button' && textOf(node) === 'retry').length >= 1, 'the failure offers an inline retry')
})

test('an offline registry read is reported as a failure with a retry', async () => {
  const page = createPage({ sessionsById: {}, toolRoute: 'offline' })
  await page.settle()
  await page.clickTab('wj-tab-tools')

  assert.ok(textOf(page.panelById('wj-panel-tools')).includes('toolInventoryError'))
})

test('a registry read that answers after the loading render still lands', async () => {
  // The Host scans package sources before it answers, so the fetch settles long after React has
  // flushed the loading render and every effect pass that follows. An effect that depends on the
  // state it sets re-runs in that window, disposes its first run, and drops the answer; the view
  // then shows "正在读取工具注册清单…" forever. This is the order a real route produces, and the
  // test runtime's zero-delay fetch never produced it.
  const page = createPage({
    sessionsById: {},
    toolDelayMs: 25,
    tools: [{ name: 'read_file', scope: 'global', owner: { kind: 'package', moduleName: 'fs-plugin', entryId: 'fs', inferred: true } }],
  })
  await page.settle()
  await page.clickTab('wj-tab-tools')
  const arrived = await page.waitFor(() => textOf(page.panelById('wj-panel-tools') ?? { children: [] }).includes('read_file'))
  assert.equal(arrived, true, 'the late answer must be applied instead of leaving the view loading')
  assert.equal(page.toolCalls.length, 1, 'one visit reads the route once')
})

test('a legacy inventory snapshot still fills the plugin and tool views', async () => {
  // Older Hosts answered `pluginInventory.list()` with registrations of their own; the plugin view
  // keeps reading those rows so a downgrade or a plain older build is not rendered empty.
  const page = createPage({ sessionsById: {}, legacy: true })
  await page.settle()
  await page.clickTab('wj-tab-tools')

  const tools = textOf(page.panelById('wj-panel-tools'))
  assert.ok(tools.includes('read_file'), 'the legacy registration still renders')
  assert.ok(tools.includes('fs-plugin'), 'its owner still renders')
  assert.ok(!textOf(page.tree).includes('take_screenshot'), 'the legacy MCP client list stays unrendered')
})

test('a protected management service renders every control as read-only', async () => {
  const page = createPage({ sessionsById: {}, managementAvailable: false })
  await page.settle()

  const button = find(page.tree, node => node.type === 'button' && textOf(node) === 'disable')[0]
  assert.ok(button, 'the enabled plugin still renders its control')
  assert.equal(button.props.disabled, true, 'a Host that protects management disables the control')
  assert.ok(page.text().includes('management-required'))
})
