import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const client = readFileSync(fileURLToPath(new URL('../client.js', import.meta.url)), 'utf8')
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'))

// dsh-client-modules attaches a package's browser half to its Loader row by the bare package
// name and rejects a bundle that registers any other id. A mismatch leaves the plugin without a
// fiber: no slot entry, and the settings section renders its empty message.
const registered = /__ModuleLoader__\.load\(\{[\s\S]*?\bid: ['"]([^'"]+)['"]/.exec(client)

test('the bundle registers a module id', () => {
  assert.ok(registered, 'client.js should call __ModuleLoader__.load with an id')
})

test('the module id is the bare package name', () => {
  assert.equal(registered[1], pkg.name)
})
