window.__ModuleLoader__.load({
  id: 'dsh-plugin-manager-wj',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'settings.pluginManagerWj'

    function InventoryTab({ list, t }) {
      const [state, setState] = React.useState({ kind: 'loading' })
      const [query, setQuery] = React.useState('')
      const [revision, setRevision] = React.useState(0)

      React.useEffect(() => {
        let live = true
        Promise.resolve().then(list).then(snapshot => {
          if (live) setState({ kind: 'ready', snapshot })
        }, () => {
          if (live) setState(current => ({ kind: 'error', snapshot: current.snapshot }))
        })
        return () => { live = false }
      }, [list, revision])

      const refresh = () => {
        setState(current => ({ kind: 'loading', snapshot: current.snapshot }))
        setRevision(value => value + 1)
      }
      const snapshot = state.snapshot
      const supported = snapshot && Array.isArray(snapshot.toolRegistrations)
      const needle = query.trim().toLocaleLowerCase()
      const matches = values => !needle || values.filter(Boolean).some(value => String(value).toLocaleLowerCase().includes(needle))
      const tools = (snapshot?.toolRegistrations ?? []).filter(row => matches([row.name, row.owner?.moduleName, row.owner?.entryId]))
      const clients = (snapshot?.mcpClients ?? []).filter(row => matches([row.serverName, row.state, row.owner?.moduleName, ...(row.toolNames ?? [])]))

      const owner = row => row.owner ? `${row.owner.moduleName} (${row.owner.entryId})` : '—'
      const scope = row => t(row.scope)
      const rows = (title, items, render) => items.length ? h('section', { key: title, style: { marginTop: 20 } },
        h('h3', null, title), h('ul', { style: { paddingLeft: 20 } }, items.map(render))) : null

      return h('div', { style: { display: 'grid', gap: 12, maxWidth: 900 } },
        h('div', { style: { display: 'flex', gap: 8 } },
          h('input', { type: 'search', value: query, 'aria-label': t('search'), placeholder: t('search'), onChange: event => setQuery(event.target.value), style: { flex: 1 } }),
          h('button', { type: 'button', onClick: refresh }, t('refresh'))),
        state.kind === 'loading' && !snapshot ? h('p', { role: 'status' }, t('loading')) : null,
        state.kind === 'error' ? h('div', { role: 'alert' }, h('p', null, t('error')), h('button', { type: 'button', onClick: refresh }, t('retry'))) : null,
        supported ? h(React.Fragment, null,
          tools.length === 0 && clients.length === 0 ? h('p', null, t(needle ? 'noMatches' : 'empty')) : null,
          rows(t('tools'), tools, row => h('li', { key: `${row.name}:${row.scope}:${row.owner?.entryId ?? ''}` },
            h('strong', null, row.name), ` · ${t('owner')}: ${owner(row)} · ${t('scope')}: ${scope(row)} · ${t(row.conditional ? 'conditional' : 'unconditional')}`)),
          rows(t('mcp'), clients, row => h('li', { key: `${row.serverName}:${row.scope}:${row.owner?.entryId ?? ''}` },
            h('strong', null, row.serverName), ` · ${t('owner')}: ${owner(row)} · ${t('scope')}: ${scope(row)} · ${t('serverState')}: ${t(row.state)}`,
            row.toolNames?.length ? h('div', null, `${t('toolNames')}: ${row.toolNames.join(', ')}`) : null)))
          : snapshot ? h('p', { role: 'status' }, t('unsupported')) : null)
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.pluginInventory'],
      apply(ctx) {
        const zh = {
          tab: '注册清单', search: '搜索工具或 MCP Server', refresh: '刷新', loading: '正在读取运行时注册…',
          error: '无法读取注册清单。', retry: '重试', empty: '当前没有工具或 MCP 注册。',
          unsupported: '当前 Harness Host 未提供工具和 MCP 运行时清单，请升级 Harness 后再查看。',
          tools: '工具注册', mcp: 'MCP Server', owner: '所属插件', scope: '作用域', global: '全局', scoped: 'Agent 作用域',
          conditional: '条件启用', unconditional: '始终注册', serverState: '连接状态', toolNames: '工具名',
          noRows: '暂无记录。', noMatches: '没有匹配的记录。', starting: '启动中', connected: '已连接',
          reconnecting: '重连中', failed: '连接失败', stopped: '已停止',
        }
        const en = {
          tab: 'Registration inventory', search: 'Search tools or MCP servers', refresh: 'Refresh', loading: 'Reading runtime registrations…',
          error: 'The registration inventory could not be read.', retry: 'Retry', empty: 'There are no tool or MCP registrations yet.',
          unsupported: 'This Harness Host does not provide runtime tool and MCP inventory. Upgrade Harness to view it.',
          tools: 'Tool registrations', mcp: 'MCP servers', owner: 'Owning plugin', scope: 'Scope', global: 'Global', scoped: 'Agent scope',
          conditional: 'Conditional', unconditional: 'Always registered', serverState: 'Connection state', toolNames: 'Tool names',
          noRows: 'No records.', noMatches: 'No matching records.', starting: 'Starting', connected: 'Connected',
          reconnecting: 'Reconnecting', failed: 'Failed', stopped: 'Stopped',
        }
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plugin-manager-wj: dictionaries')
        const t = ctx.locale.bind(NS)
        const list = async () => {
          const result = await ctx.remote.pluginInventory.list()
          if (!result.ok) throw new Error(`pluginInventory.list failed: ${result.error.code}: ${result.error.message}`)
          return result.value
        }
        ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
          name: 'settings.plugins.tab', id: 'wj-registration-inventory', order: 20,
          label: () => t('tab'), locale: NS, inject: () => ({ list }),
        }, InventoryTab))
      },
    }
  },
})
