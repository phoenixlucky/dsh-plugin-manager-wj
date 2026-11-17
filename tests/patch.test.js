import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const patchPath = fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))
const text = readFileSync(patchPath, 'utf8')

// YAML reserves these characters at the start of a plain scalar. `@tinyforge/...`
// is therefore unparseable unless quoted, which is exactly what DSH rejected.
const RESERVED = ['@', '`', '*', '&', '!', '%', '#', '|', '>', '{', '[', ',', '?', ':']

const lines = text.split(/\r?\n/)
const entries = []
lines.forEach((line, index) => {
  const match = /^(\s*)([A-Za-z0-9_-]+):(\s*)(.*)$/.exec(line)
  if (match && match[4].trim() !== '') entries.push({ line: index + 1, key: match[2], value: match[4].trim() })
})

test('patch file declares the bundle entry', () => {
  assert.ok(entries.length > 0, 'cordis.patch.yml should contain at least one mapping entry')
  assert.ok(entries.some(entry => entry.key === 'name'), 'patch should set a plugin name')
})

test('no plain scalar starts with a YAML reserved indicator', () => {
  const offenders = entries.filter(entry => RESERVED.includes(entry.value[0]))
  assert.deepEqual(
    offenders.map(entry => `line ${entry.line}: ${entry.key}: ${entry.value}`),
    [],
    'quote values that begin with a reserved YAML indicator',
  )
})

test('insert list entries are indented under the insert key', () => {
  const insertLine = lines.findIndex(line => /^\s*-\s*insert:\s*$/.test(line))
  assert.notEqual(insertLine, -1, 'patch should start with a "- insert:" block')
  assert.ok(lines[insertLine + 1] && /^\s{4}-\s+\S/.test(lines[insertLine + 1]), 'insert items must be indented deeper than "insert:"')
})
