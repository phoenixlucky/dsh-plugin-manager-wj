import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { test } from 'node:test'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const zh = JSON.parse(readFileSync(new URL('../locale/zh.json', import.meta.url), 'utf8'))
const en = JSON.parse(readFileSync(new URL('../locale/en.json', import.meta.url), 'utf8'))

test('the marketplace entry names the plugin and recommends the MCP settings bundle', () => {
  // The installed-plugin list shows `metaOf()` output: the locale `meta` block, not the client
  // dictionaries. A package without `meta.description` renders a title with no introduction.
  for (const [language, meta] of [['zh', zh.meta], ['en', en.meta]]) {
    assert.equal(typeof meta?.title, 'string', `${language} metadata carries a title`)
    assert.equal(typeof meta?.description, 'string', `${language} metadata carries an introduction`)
    assert.ok(meta.description.includes('@tinyforge/dsh-mcp-settings'), `${language} introduction points at the MCP settings bundle`)
  }
})

test('the package ships an icon the Host can read without loading the plugin', () => {
  assert.equal(packageJson.icon, 'icon.webp')
  const icon = new URL('../icon.webp', import.meta.url)
  const bytes = statSync(icon).size
  assert.ok(bytes > 0 && bytes <= 256 * 1024, 'a display icon must stay under 256 KiB')
  const head = readFileSync(icon).subarray(0, 12)
  assert.equal(head.subarray(0, 4).toString('ascii'), 'RIFF', 'the declared icon is a RIFF container')
  assert.equal(head.subarray(8, 12).toString('ascii'), 'WEBP', 'the declared icon is WebP')
  assert.ok(packageJson.files.includes('icon.webp'), 'npm pack must include the icon')
  // The Host resolves both through package exports; without them the file is not readable.
  assert.equal(packageJson.exports['./icon'], './icon.webp')
  assert.equal(packageJson.exports['./package.json'], './package.json')
})
