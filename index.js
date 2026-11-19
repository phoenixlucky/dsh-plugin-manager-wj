// SPDX-License-Identifier: MIT
/**
 * Host half: serve the runtime tool registry the Web Client cannot read directly.
 *
 * The Client half lives in `client.js` and runs in the browser. It can only read the Host through
 * Remote namespaces, and the official Host exposes no tool registry there: `ctx.tools` is a Host
 * service, and a third-party package cannot add a Remote namespace (the Client's `ctx.remote`
 * table is a compiled allowlist). A plain authenticated Fetch route on the shared `/api` channel
 * is the supported way for a package to hand its own Host-side data to its own Client half.
 *
 * Ownership is the one fact no Host service records: `ctx.tools` keeps definitions keyed by name
 * and discards the registering context. The route therefore reports `owner.kind === 'mcp'` for
 * MCP tool names (their names carry the server) and falls back to a package-source scan, which is
 * marked `inferred` so the page never presents a guess as a Host fact.
 */
import { readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

/** Absolute path below the shared `/api` channel. */
export const TOOL_INVENTORY_PATH = '/api/wj/tool-inventory'

/** Do not read a single package bundle larger than this; a minified bundle above it is not scanned. */
const FILE_LIMIT_BYTES = 4 * 1024 * 1024

/** Total bytes the source scan may read for one snapshot. */
const TOTAL_LIMIT_BYTES = 64 * 1024 * 1024

/** Total package files the source scan may open for one snapshot. */
const FILE_BUDGET = 240

/** How long one computed snapshot is reused; the page refreshes on demand, not per keystroke. */
const CACHE_TTL_MS = 30_000

/** Keys in a package bundle that make a tool-name literal worth scanning for. */
const REGISTRATION_MARKERS = /tools\s*\.\s*register|defineTool|registerTool/

const TOOL_NAME_LITERAL = /\bname\s*:\s*(['"])([A-Za-z0-9_$.:-]{1,120})\1/g

/**
 * Serve tool registrations over one authenticated GET route.
 * @param ctx - Host context; `connection` is requested optionally so a Host without the shared
 *   channel keeps the plugin active and the page degrades to its own explanation.
 */
export function apply(ctx) {
  let cache

  const snapshot = async () => {
    const now = Date.now()
    if (cache !== undefined && now - cache.at < CACHE_TTL_MS) return cache.value
    const value = buildSnapshot(ctx)
    cache = { at: now, value }
    return value
  }

  // A Host that mounts no shared channel, or a route the channel refuses, must not fail this
  // plugin's activation: the page already explains a missing route on its own.
  try {
    ctx.inject(['connection'], injected => {
      if (typeof injected.connection?.fetch?.register !== 'function') return
      injected.effect(() => {
        try {
          const dispose = injected.connection.fetch.register({
            path: TOOL_INVENTORY_PATH,
            methods: ['GET'],
            requestBody: 'buffered',
            fetch: async () => jsonResponse(await snapshot()),
          })
          return () => { void Promise.resolve(dispose).catch(() => {}) }
        } catch (error) {
          warn(injected, 'tool inventory route registration failed', error)
          return undefined
        }
      }, 'plugin-manager-wj: tool inventory route')
    })
  } catch (error) {
    warn(ctx, 'tool inventory route unavailable', error)
  }
}

/**
 * Build one snapshot of the live registry.
 * @param ctx - Host context.
 * @param options - test seams: `readFile`, `maxFiles`, `maxBytes`.
 * @returns Tool rows with scope and best-effort owner, plus the scan limit that applied.
 */
export function buildSnapshot(ctx, options = {}) {
  const rows = collectTools(ctx)
  const owners = ownersOf(ctx, rows.map(row => row.name), options)
  const tools = rows.map(row => {
    const owner = owners.get(row.name)
    return owner === undefined ? row : { ...row, owner }
  })
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    tools,
  }
}

/**
 * Read every Tool schema visible to this Host, globally and in each live Agent scope.
 * @param ctx - Host context with the `tools` service.
 * @returns Rows in name order; a scoped registration that shadows a global one keeps both rows.
 */
export function collectTools(ctx) {
  const tools = optional(ctx, 'tools')
  const rows = []
  const seen = new Set()
  const add = (schema, scope, agentId) => {
    const toolName = schema?.name
    if (typeof toolName !== 'string' || toolName.length === 0) return
    const key = `${scope}:${agentId ?? ''}:${toolName}`
    if (seen.has(key)) return
    seen.add(key)
    const base = { name: toolName, scope, ...(agentId === undefined ? {} : { agentId }) }
    const description = typeof schema?.description === 'string' ? schema.description : undefined
    rows.push(description === undefined ? base : { ...base, description })
  }

  for (const schema of schemasOf(tools, undefined)) add(schema, 'global')

  for (const agent of listAgents(ctx)) {
    const agentId = agentIdentity(agent)
    if (agentId === undefined) continue
    for (const schema of schemasOf(tools, agent)) add(schema, 'agent', agentId)
  }

  return rows.sort((left, right) => left.name.localeCompare(right.name))
}

/**
 * Attribute each tool name to a provider where the Host makes that knowable.
 * @param ctx - Host context.
 * @param names - Live tool names.
 * @param options - test seams for the package-source scan.
 * @returns Name to owner map; absent names stay unattributed rather than guessed.
 */
export function ownersOf(ctx, names, options = {}) {
  const owners = new Map()
  for (const toolName of names) {
    const mcp = mcpOwner(toolName)
    if (mcp !== undefined) owners.set(toolName, mcp)
  }
  const pending = names.filter(toolName => !owners.has(toolName))
  if (pending.length === 0) return owners

  for (const source of readPackageSources(ctx, options)) {
    const declared = declaredToolNames(source.text)
    if (declared.size === 0) continue
    for (const toolName of pending) {
      if (owners.has(toolName)) continue
      if (!declared.has(toolName)) continue
      owners.set(toolName, {
        kind: 'package',
        moduleName: source.moduleName,
        ...(source.entryId === undefined ? {} : { entryId: source.entryId }),
        inferred: true,
      })
    }
  }
  return owners
}

/**
 * Recognize the MCP naming convention `mcp__<server>__<tool>`.
 * @param toolName - Public tool name.
 * @returns The MCP server owner, or undefined for a non-MCP name.
 */
export function mcpOwner(toolName) {
  const match = /^mcp__(.+?)__[A-Za-z0-9_]/.exec(toolName)
  return match === null ? undefined : { kind: 'mcp', serverName: match[1] }
}

/**
 * Collect every `name: '…'` literal from a bundle that registers tools.
 * @param text - Package bundle source.
 * @returns Declared names; empty when the bundle registers no tools at all.
 */
export function declaredToolNames(text) {
  const names = new Set()
  if (typeof text !== 'string' || !REGISTRATION_MARKERS.test(text)) return names
  TOOL_NAME_LITERAL.lastIndex = 0
  let match
  while ((match = TOOL_NAME_LITERAL.exec(text)) !== null) names.add(match[2])
  return names
}

/**
 * Read the entrypoint bundle of each loaded plugin package, within a fixed budget.
 * @param ctx - Host context with `loader` and the optional `pluginPackages` service.
 * @param options - test seams: `readFile`, `maxFiles`, `maxBytes`.
 * @returns Entry id, module name and bundle text for every readable package.
 */
export function readPackageSources(ctx, options = {}) {
  const loader = optional(ctx, 'loader')
  const packages = optional(ctx, 'pluginPackages')
  const entries = typeof loader?.entries === 'function' ? loader.entries() : []
  const readFile = options.readFile ?? readFileSync
  const statFile = options.statFile ?? statSync
  const maxFiles = options.maxFiles ?? FILE_BUDGET
  const maxBytes = options.maxBytes ?? TOTAL_LIMIT_BYTES

  const sources = []
  let files = 0
  let bytes = 0

  for (const entry of entries) {
    if (files >= maxFiles || bytes >= maxBytes) break
    const moduleName = entry?.options?.name
    if (typeof moduleName !== 'string' || moduleName.length === 0) continue
    const base = entry?.parent?.tree?.ctx?.baseUrl
    let manifestPath
    try {
      manifestPath = packages?.packageOf?.(moduleName, base)?.manifestPath
    } catch (_error) {
      manifestPath = undefined
    }
    if (typeof manifestPath !== 'string') continue
    try {
      const manifest = JSON.parse(readFile(manifestPath, 'utf8'))
      const main = typeof manifest?.main === 'string' && manifest.main.length > 0 ? manifest.main : 'index.js'
      const file = isAbsolute(main) ? main : join(dirname(manifestPath), main)
      // A bundle above the limit is discarded after the read anyway; some plugin entry bundles are
      // tens of megabytes, and reading one only to drop it blocks the Host for no result.
      const size = statFile(file)?.size
      if (typeof size === 'number' && size > FILE_LIMIT_BYTES) continue
      const text = readFile(file, 'utf8')
      if (typeof text !== 'string' || text.length === 0 || text.length > FILE_LIMIT_BYTES) continue
      files += 1
      bytes += text.length
      sources.push({ entryId: entry.id, moduleName, text })
    } catch (_error) {
      // A package with an unreadable manifest or missing entrypoint simply cannot be scanned.
    }
  }

  return sources
}

/** Read the Tool schemas for one scope; a Host without the service yields none. */
function schemasOf(tools, scope) {
  if (typeof tools?.schemas !== 'function') return []
  try {
    const schemas = tools.schemas(scope)
    return Array.isArray(schemas) ? schemas : []
  } catch (_error) {
    return []
  }
}

/** Read the live Agents; a Host without the service yields none. */
function listAgents(ctx) {
  const agents = optional(ctx, 'agents')
  if (typeof agents?.list !== 'function') return []
  try {
    const rows = agents.list()
    return Array.isArray(rows) ? rows : []
  } catch (_error) {
    return []
  }
}

/** The stable identity of one live Agent, however that Agent object spells it. */
function agentIdentity(agent) {
  const candidates = [agent?.id, agent?.session?.id, agent?.sessionId]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return undefined
}

/** Read one optional Cordis service without turning a missing service into an activation failure. */
function optional(ctx, serviceName) {
  try {
    return ctx.get(serviceName)
  } catch (_error) {
    return undefined
  }
}

/** Log through the Host logger when it is available; diagnostics never throw. */
function warn(ctx, message, error) {
  try {
    ctx.logger?.warn?.(`plugin-manager-wj: ${message}`, error)
  } catch (_error) {
    // A Host without a logger keeps the failure silent rather than failing activation.
  }
}

/** One JSON response for the shared Fetch channel. */
function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
