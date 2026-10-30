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
      const styles = {
        page: { display: 'grid', gap: 20, maxWidth: 1040, color: 'CanvasText' },
        header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
        eyebrow: { margin: '0 0 5px', color: 'GrayText', fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' },
        title: { margin: 0, fontSize: 22, lineHeight: 1.3, fontWeight: 650 },
        description: { margin: '6px 0 0', color: 'GrayText', fontSize: 14 },
        summary: { display: 'flex', gap: 8, flexWrap: 'wrap' },
        stat: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 11px', border: '1px solid color-mix(in srgb, CanvasText 14%, Canvas)', borderRadius: 9, background: 'ButtonFace', fontSize: 13 },
        toolbar: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: 12, border: '1px solid color-mix(in srgb, CanvasText 14%, Canvas)', borderRadius: 12, background: 'ButtonFace' },
        search: { flex: '1 1 240px', minWidth: 0, height: 38, padding: '0 12px', border: '1px solid color-mix(in srgb, CanvasText 18%, Canvas)', borderRadius: 8, background: 'Canvas', color: 'CanvasText', font: 'inherit' },
        button: { height: 38, padding: '0 14px', border: '1px solid color-mix(in srgb, CanvasText 20%, Canvas)', borderRadius: 8, background: 'Canvas', color: 'CanvasText', font: 'inherit', fontWeight: 600, cursor: 'pointer' },
        section: { overflow: 'hidden', border: '1px solid color-mix(in srgb, CanvasText 14%, Canvas)', borderRadius: 12, background: 'Canvas' },
        sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: '1px solid color-mix(in srgb, CanvasText 12%, Canvas)', background: 'ButtonFace' },
        sectionTitle: { margin: 0, fontSize: 15, fontWeight: 650 },
        count: { color: 'GrayText', fontSize: 13, fontVariantNumeric: 'tabular-nums' },
        list: { margin: 0, padding: 0, listStyle: 'none' },
        row: { display: 'grid', gap: 10, padding: '15px 16px', borderBottom: '1px solid color-mix(in srgb, CanvasText 10%, Canvas)' },
        rowTitle: { margin: 0, fontSize: 14, fontWeight: 650, overflowWrap: 'anywhere' },
        metadata: { display: 'flex', gap: '6px 14px', flexWrap: 'wrap', color: 'GrayText', fontSize: 13 },
        badge: { display: 'inline-flex', alignItems: 'center', minHeight: 22, padding: '1px 8px', border: '1px solid color-mix(in srgb, CanvasText 18%, Canvas)', borderRadius: 999, color: 'CanvasText', fontSize: 12, lineHeight: 1.4 },
        tools: { margin: 0, color: 'GrayText', fontSize: 13, lineHeight: 1.6, overflowWrap: 'anywhere' },
        message: { margin: 0, padding: '18px 16px', color: 'GrayText', fontSize: 14 },
      }
      const badge = (label, key) => h('span', { key, style: styles.badge }, label)
      const rows = (key, title, items, render) => h('section', { key, style: styles.section, 'aria-labelledby': `${key}-heading` },
        h('div', { style: styles.sectionHeader },
          h('h2', { id: `${key}-heading`, style: styles.sectionTitle }, title),
          h('span', { style: styles.count }, `${items.length} ${t('items')}`)),
        items.length ? h('ul', { style: styles.list }, items.map(render)) : h('p', { style: styles.message }, t(needle ? 'noMatches' : 'noRows')))

      return h('div', { style: styles.page },
        h('header', { style: styles.header },
          h('div', null,
            h('p', { style: styles.eyebrow }, t('eyebrow')),
            h('h1', { style: styles.title }, t('heading')),
            h('p', { style: styles.description }, t('description'))),
          supported ? h('div', { style: styles.summary, 'aria-label': t('summary') },
            h('span', { style: styles.stat }, `${t('tools')}: ${snapshot.toolRegistrations.length}`),
            h('span', { style: styles.stat }, `${t('mcp')}: ${(snapshot.mcpClients ?? []).length}`)) : null),
        h('div', { style: styles.toolbar },
          h('input', { type: 'search', value: query, 'aria-label': t('search'), placeholder: t('search'), onChange: event => setQuery(event.target.value), style: styles.search }),
          h('button', { type: 'button', onClick: refresh, style: styles.button }, state.kind === 'loading' ? t('loadingShort') : t('refresh'))),
        state.kind === 'loading' && !snapshot ? h('p', { role: 'status', style: styles.message }, t('loading')) : null,
        state.kind === 'error' ? h('div', { role: 'alert', style: { ...styles.section, padding: 16 } },
          h('p', { style: { ...styles.message, padding: '0 0 12px' } }, t('error')),
          h('button', { type: 'button', onClick: refresh, style: styles.button }, t('retry'))) : null,
        supported ? h(React.Fragment, null,
          rows('tools', t('tools'), tools, row => h('li', { key: `${row.name}:${row.scope}:${row.owner?.entryId ?? ''}`, style: styles.row },
            h('h3', { style: styles.rowTitle }, row.name),
            h('div', { style: styles.metadata },
              h('span', null, `${t('owner')}: ${owner(row)}`),
              h('span', null, `${t('scope')}: ${scope(row)}`),
              badge(t(row.conditional ? 'conditional' : 'unconditional'), 'condition')))),
          rows('mcp', t('mcp'), clients, row => h('li', { key: `${row.serverName}:${row.scope}:${row.owner?.entryId ?? ''}`, style: styles.row },
            h('h3', { style: styles.rowTitle }, row.serverName),
            h('div', { style: styles.metadata },
              h('span', null, `${t('owner')}: ${owner(row)}`),
              h('span', null, `${t('scope')}: ${scope(row)}`),
              h('span', null, `${t('serverState')}:`), badge(t(row.state), 'state')),
            row.toolNames?.length ? h('p', { style: styles.tools }, `${t('toolNames')}: ${row.toolNames.join(', ')}`) : null)))
          : snapshot ? h('p', { role: 'status', style: styles.message }, t('unsupported')) : null)
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.pluginInventory'],
      apply(ctx) {
        const zh = {
          tab: '注册清单', search: '搜索工具或 MCP Server', refresh: '刷新', loading: '正在读取运行时注册…',
          eyebrow: '只读管理面板', heading: '运行时注册清单', description: '查看当前已注册的工具、MCP Server 和所属插件。', summary: '注册数量', items: '项', loadingShort: '读取中…',
          error: '无法读取注册清单。', retry: '重试', empty: '当前没有工具或 MCP 注册。',
          unsupported: '当前 Harness Host 未提供工具和 MCP 运行时清单，请升级 Harness 后再查看。',
          tools: '工具注册', mcp: 'MCP Server', owner: '所属插件', scope: '作用域', global: '全局', scoped: 'Agent 作用域',
          conditional: '条件启用', unconditional: '始终注册', serverState: '连接状态', toolNames: '工具名',
          noRows: '暂无记录。', noMatches: '没有匹配的记录。', starting: '启动中', connected: '已连接',
          reconnecting: '重连中', failed: '连接失败', stopped: '已停止',
        }
        const en = {
          tab: 'Registration inventory', search: 'Search tools or MCP servers', refresh: 'Refresh', loading: 'Reading runtime registrations…',
          eyebrow: 'READ ONLY INVENTORY', heading: 'Runtime registrations', description: 'Review registered tools, MCP servers, and their owning plugins.', summary: 'Registration counts', items: 'items', loadingShort: 'Loading…',
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
