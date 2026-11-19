import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  TOOL_INVENTORY_PATH, apply, buildSnapshot, collectTools, declaredToolNames, mcpOwner, ownersOf, readPackageSources,
} from '../index.js'

/** One fake Cordis context with only the services a test needs. */
function createCtx({ schemas, agents, entries, packages, connection } = {}) {
  const effects = []
  const ctx = {
    get(name) {
      if (name === 'tools') return schemas === undefined ? undefined : { schemas }
      if (name === 'agents') return agents === undefined ? undefined : { list: () => agents }
      if (name === 'loader') return entries === undefined ? undefined : { entries: () => entries }
      if (name === 'pluginPackages') return packages
      if (name === 'connection') return connection
      return undefined
    },
    inject(_deps, callback) {
      // Cordis hands the callback a derived context whose injected services are own properties.
      const derived = Object.create(ctx)
      derived.connection = connection
      callback(derived)
    },
    effect(run, label) { effects.push({ label, dispose: run() ?? (() => {}) }) },
  }
  return { ctx, effects }
}

test('the MCP naming convention names the server that owns a tool', () => {
  assert.deepEqual(mcpOwner('mcp__wincu__windows_computer_use_health'), { kind: 'mcp', serverName: 'wincu' })
  assert.deepEqual(mcpOwner('mcp__mcp-chrome-super__chrome_tab_get'), { kind: 'mcp', serverName: 'mcp-chrome-super' })
  assert.equal(mcpOwner('read'), undefined)
  assert.equal(mcpOwner('mcp_short'), undefined)
})

test('a bundle declares tool names only where it registers tools', () => {
  const declared = declaredToolNames("ctx.tools.register({ name: 'read_file', description: 'x' })")
  assert.deepEqual([...declared], ['read_file'])
  // A bundle that registers nothing yields nothing, so unrelated `name:` literals stay out.
  assert.equal(declaredToolNames("const x = { name: 'read_file' }").size, 0)
  // Double quotes and dotted names are ordinary.
  assert.deepEqual([...declaredToolNames('defineTool({ name: "a.b_c" })')], ['a.b_c'])
})

test('tools are collected per scope, and a scoped shadow keeps both rows', () => {
  const scoped = { id: 'sess-1' }
  const { ctx } = createCtx({
    schemas: scope => scope === undefined
      ? [{ name: 'read' }, { name: 'write' }]
      : [{ name: 'read' }, { name: 'todo_write' }],
    agents: [scoped],
  })

  const rows = collectTools(ctx)
  assert.deepEqual(rows.map(row => [row.name, row.scope, row.agentId]), [
    ['read', 'global', undefined],
    ['read', 'agent', 'sess-1'],
    ['todo_write', 'agent', 'sess-1'],
    ['write', 'global', undefined],
  ])
})

test('ownership prefers MCP names and otherwise reads the declaring package', () => {
  const { ctx } = createCtx({
    entries: [{ id: 'fs', options: { name: '@scope/fs-tools' } }],
    packages: { packageOf: () => undefined },
  })
  const owners = ownersOf(ctx, ['read_file', 'mcp__chrome__navigate', 'unattributed'], {
    readFile: (path) => {
      if (path.endsWith('manifest.json')) return JSON.stringify({ main: 'index.js' })
      return "ctx.tools.register({ name: 'read_file' })"
    },
  })
  assert.deepEqual(owners.get('mcp__chrome__navigate'), { kind: 'mcp', serverName: 'chrome' })
  assert.equal(owners.get('read_file'), undefined, 'a package the Host cannot locate stays unattributed')
  assert.equal(owners.get('unattributed'), undefined)
})

test('a located package attributes its declared tools and marks the row inferred', () => {
  const root = mkdtempSync(join(tmpdir(), 'wj-host-'))
  mkdirSync(join(root, 'lib'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ main: 'lib/index.js' }))
  writeFileSync(join(root, 'lib', 'index.js'), "export const apply = ctx => ctx.tools.register({ name: 'read_file' })")

  const { ctx } = createCtx({
    entries: [{ id: 'fs', options: { name: '@scope/fs-tools' } }],
    packages: { packageOf: () => ({ manifestPath: join(root, 'package.json') }) },
  })
  const owners = ownersOf(ctx, ['read_file'], { readFile: readFileSync })
  assert.deepEqual(owners.get('read_file'), {
    kind: 'package', moduleName: '@scope/fs-tools', entryId: 'fs', inferred: true,
  })
})

test('the package scan stops at its file budget', () => {
  const { ctx } = createCtx({
    entries: [
      { id: 'a', options: { name: 'a' } },
      { id: 'b', options: { name: 'b' } },
    ],
    packages: { packageOf: () => ({ manifestPath: 'C:/pkg/package.json' }) },
  })
  const sources = readPackageSources(ctx, {
    maxFiles: 1,
    readFile: path => path.endsWith('package.json') ? JSON.stringify({ main: 'index.js' }) : 'defineTool({ name: "x" })',
  })
  assert.equal(sources.length, 1)
  assert.equal(sources[0].entryId, 'a')
})

test('a snapshot combines rows with the owner the Host could establish', () => {
  const { ctx } = createCtx({
    schemas: () => [{ name: 'read', description: 'Read a file' }, { name: 'mcp__wincu__list_windows' }],
    agents: [],
  })
  const snapshot = buildSnapshot(ctx)
  assert.equal(snapshot.version, 1)
  assert.ok(typeof snapshot.generatedAt === 'string')
  assert.deepEqual(snapshot.tools.map(row => [row.name, row.scope, row.owner?.kind]), [
    ['mcp__wincu__list_windows', 'global', 'mcp'],
    ['read', 'global', undefined],
  ])
})

test('the Host route answers one authenticated JSON snapshot on GET', async () => {
  const registered = []
  const { ctx, effects } = createCtx({
    schemas: () => [{ name: 'read' }],
    agents: [],
    connection: { fetch: { register: route => { registered.push(route); return async () => {} } } },
  })
  apply(ctx)

  assert.equal(effects.length, 1)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].path, TOOL_INVENTORY_PATH)
  assert.equal(TOOL_INVENTORY_PATH, '/api/wj/tool-inventory')
  assert.deepEqual(registered[0].methods, ['GET'])
  assert.equal(registered[0].requestBody, 'buffered')

  const response = await registered[0].fetch(new Request('http://host/api/wj/tool-inventory'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const body = await response.json()
  assert.deepEqual(body.tools.map(row => row.name), ['read'])
})

test('a Host without the shared channel keeps the plugin active', () => {
  const { ctx, effects } = createCtx({ schemas: () => [] })
  apply(ctx)
  assert.equal(effects.length, 0)
})
