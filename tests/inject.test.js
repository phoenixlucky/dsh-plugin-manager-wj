import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('../client.js', import.meta.url)), 'utf8')

// The plugin's own inject list (6-space indent, inside the returned plugin object) — not the
// slot entry's `inject: () => ({...})` projection.
const pluginInject = /^ {6}inject: \[(.*)\],$/m.exec(source)

test('the plugin declares a single inject list', () => {
  assert.ok(pluginInject, 'client.js should declare the plugin inject array')
})

test('only core client services are hard-injected', () => {
  const entries = pluginInject[1].split(',').map(entry => entry.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  assert.deepEqual(entries, ['slots', 'locale'])
})

test('optional services are never hard-injected', () => {
  // A pending client plugin registers no slot entry, which empties the settings page instead of
  // degrading. Remotes and settings forms must stay optional.
  assert.doesNotMatch(pluginInject[1], /remote|configForms/)
  assert.match(source, /const namespace = name => \{/)
  assert.match(source, /const forms = service\('configForms'\)/)
})
