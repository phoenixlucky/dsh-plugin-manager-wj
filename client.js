// SPDX-License-Identifier: MIT
window.__ModuleLoader__.load({
  id: 'dsh-plugin-manager-wj',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'settings.pluginManagerWj'
    const TAB_ORDER = ['plugins', 'config', 'skill', 'mcp']
    const TAB_KEY = 'dsh-plugin-manager-wj/tab'

    function unwrap(result, name) {
      if (!result || result.ok !== true) throw new Error(`${name}: ${result?.error?.message ?? 'unavailable'}`)
      return result.value
    }

    function atPath(value, path) {
      return path.reduce((current, key) => current == null ? undefined : current[key], value)
    }

    function hasPath(value, path) {
      if (path.length === 0) return value !== undefined
      const parent = atPath(value, path.slice(0, -1))
      return parent != null && Object.prototype.hasOwnProperty.call(parent, path[path.length - 1])
    }

    function isPathPrefix(prefix, path) {
      return prefix.length <= path.length && prefix.every((part, index) => part === path[index])
    }

    function schemaFields(envelope) {
      const refs = envelope?.refs
      const root = refs?.[envelope?.uid]
      if (!root || root.type !== 'object' || !root.dict) return []
      const fields = []
      const visit = (nodeId, path) => {
        const node = refs?.[nodeId]
        if (!node || node.meta?.role === 'secret') return
        if (node.type === 'object' && node.dict) {
          for (const [key, child] of Object.entries(node.dict)) visit(child, [...path, key])
          return
        }
        const options = node.type === 'union'
          ? (node.list ?? []).map(id => refs?.[id]).filter(item => item?.type === 'const').map(item => item.value)
          : []
        if (['string', 'number', 'boolean'].includes(node.type) || options.length > 0) {
          fields.push({ path, node, options })
        }
      }
      for (const [key, child] of Object.entries(root.dict)) visit(child, [key])
      return fields
    }

    function sourceText(source, t) {
      return source ? `${t(source.layer)} · ${source.identity}` : t('sourceUnknown')
    }

    const SEVERITY_KEY = { error: 'severityError', warning: 'severityWarning', info: 'severityInfo' }

    function readStoredTab() {
      try {
        const stored = window.localStorage?.getItem(TAB_KEY)
        return TAB_ORDER.includes(stored) ? stored : 'plugins'
      } catch (_error) {
        return 'plugins'
      }
    }

    function storeTab(id) {
      try { window.localStorage?.setItem(TAB_KEY, id) } catch (_error) { /* private mode: selection stays in memory */ }
    }

    const styles = {
      root: { display: 'grid', gap: 16, maxWidth: 1080, color: 'CanvasText' },
      page: { display: 'grid', gap: 16 },
      header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
      eyebrow: { margin: '0 0 5px', color: 'GrayText', fontSize: 12, fontWeight: 650, letterSpacing: '.07em', textTransform: 'uppercase' },
      title: { margin: 0, fontSize: 23, lineHeight: 1.25, fontWeight: 680 },
      description: { margin: '7px 0 0', color: 'GrayText', fontSize: 14, lineHeight: 1.55, maxWidth: 680 },
      stats: { display: 'flex', gap: 8, flexWrap: 'wrap' },
      stat: { display: 'grid', gap: 2, minWidth: 85, padding: '10px 13px', border: '1px solid color-mix(in srgb, CanvasText 12%, Canvas)', borderRadius: 11, background: 'ButtonFace' },
      statValue: { fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
      statLabel: { fontSize: 11, color: 'GrayText' },
      toolbar: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: 12, border: '1px solid color-mix(in srgb, CanvasText 12%, Canvas)', borderRadius: 13, background: 'ButtonFace' },
      search: { flex: '1 1 240px', minWidth: 0, height: 38, padding: '0 12px', border: '1px solid color-mix(in srgb, CanvasText 17%, Canvas)', borderRadius: 9, background: 'Canvas', color: 'CanvasText', font: 'inherit' },
      button: { minHeight: 36, padding: '7px 13px', border: '1px solid color-mix(in srgb, CanvasText 18%, Canvas)', borderRadius: 9, background: 'Canvas', color: 'CanvasText', font: 'inherit', fontWeight: 600, cursor: 'pointer' },
      primary: { borderColor: 'color-mix(in srgb, Highlight 45%, Canvas)', background: 'Highlight', color: 'HighlightText' },
      tabs: { display: 'flex', gap: 4, flexWrap: 'wrap', padding: 4, border: '1px solid color-mix(in srgb, CanvasText 12%, Canvas)', borderRadius: 13, background: 'ButtonFace' },
      tab: { display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 34, padding: '6px 13px', border: '1px solid transparent', borderRadius: 9, background: 'transparent', color: 'GrayText', font: 'inherit', fontSize: 13, fontWeight: 620, cursor: 'pointer' },
      tabActive: { borderColor: 'color-mix(in srgb, CanvasText 16%, Canvas)', background: 'Canvas', color: 'CanvasText' },
      tabCount: { minWidth: 20, padding: '0 6px', borderRadius: 999, background: 'color-mix(in srgb, CanvasText 8%, Canvas)', color: 'GrayText', fontSize: 11, fontWeight: 650, lineHeight: '18px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' },
      section: { overflow: 'hidden', border: '1px solid color-mix(in srgb, CanvasText 12%, Canvas)', borderRadius: 13, background: 'Canvas' },
      sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px', borderBottom: '1px solid color-mix(in srgb, CanvasText 10%, Canvas)', background: 'ButtonFace' },
      sectionTitle: { margin: 0, fontSize: 15, fontWeight: 670 },
      count: { color: 'GrayText', fontSize: 12, fontVariantNumeric: 'tabular-nums' },
      list: { margin: 0, padding: 0, listStyle: 'none' },
      row: { display: 'grid', gap: 10, padding: '14px 16px', borderBottom: '1px solid color-mix(in srgb, CanvasText 9%, Canvas)' },
      rowHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' },
      rowTitle: { margin: 0, fontSize: 14, fontWeight: 650, overflowWrap: 'anywhere' },
      meta: { display: 'flex', gap: '5px 14px', flexWrap: 'wrap', color: 'GrayText', fontSize: 12, lineHeight: 1.5 },
      badge: { display: 'inline-flex', alignItems: 'center', minHeight: 22, padding: '1px 9px', border: '1px solid color-mix(in srgb, CanvasText 14%, Canvas)', borderRadius: 999, fontSize: 11, fontWeight: 600 },
      warning: { borderColor: 'color-mix(in srgb, #d18a00 35%, Canvas)', background: 'color-mix(in srgb, #d18a00 9%, Canvas)' },
      error: { borderColor: 'color-mix(in srgb, #c43d3d 35%, Canvas)', background: 'color-mix(in srgb, #c43d3d 9%, Canvas)' },
      message: { margin: 0, padding: '16px', color: 'GrayText', fontSize: 13, lineHeight: 1.55 },
      detail: { marginTop: 4, padding: '13px 14px', borderRadius: 10, background: 'color-mix(in srgb, CanvasText 4%, Canvas)' },
      field: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid color-mix(in srgb, CanvasText 8%, Canvas)' },
      input: { boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: 34, padding: '6px 9px', border: '1px solid color-mix(in srgb, CanvasText 16%, Canvas)', borderRadius: 8, background: 'Canvas', color: 'CanvasText', font: 'inherit' },
      muted: { color: 'GrayText', fontSize: 11, lineHeight: 1.4 },
      skillName: { margin: 0, fontSize: 14, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', overflowWrap: 'anywhere' },
      body: { margin: 0, fontSize: 13, lineHeight: 1.55, color: 'CanvasText' },
      path: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', overflowWrap: 'anywhere' },
    }

    function FieldEditor({ field, view, form, provenance, t }) {
      const pathKey = field.path.join('.')
      const current = atPath(view.value, field.path)
      const [draft, setDraft] = React.useState(current == null ? '' : String(current))
      const [dirty, setDirty] = React.useState(false)
      const [notice, setNotice] = React.useState('')
      React.useEffect(() => {
        if (!dirty) setDraft(current == null ? '' : String(current))
      }, [view.revision, current, dirty])

      const save = async () => {
        let value = draft
        if (field.node.type === 'boolean') value = draft === 'true'
        if (field.node.type === 'number') {
          value = Number(draft)
          if (!draft.trim() || !Number.isFinite(value)) {
            setNotice(t('invalidNumber'))
            return
          }
        }
        if (field.options.length) value = field.options.find(option => String(option) === draft) ?? draft
        try {
          const accepted = await form.mutate([{ op: 'set', path: field.path, value }], view.revision)
          if (accepted) {
            setDirty(false)
            setNotice(t('saved'))
          } else setNotice(t('revisionConflict'))
        } catch (_error) { setNotice(t('saveFailed')) }
      }
      const reset = async () => {
        try {
          const accepted = await form.mutate([{ op: 'unset', path: field.path }], view.revision)
          setNotice(accepted ? t('saved') : t('revisionConflict'))
          if (accepted) setDirty(false)
        } catch (_error) { setNotice(t('saveFailed')) }
      }
      let input
      if (field.node.type === 'boolean') {
        input = h('select', { value: draft, onChange: event => { setDraft(event.target.value); setDirty(true) }, style: styles.input, 'aria-label': pathKey },
          h('option', { value: 'true' }, t('enabled')),
          h('option', { value: 'false' }, t('disabled')))
      } else if (field.options.length) {
        input = h('select', { value: draft, onChange: event => { setDraft(event.target.value); setDirty(true) }, style: styles.input, 'aria-label': pathKey },
          field.options.map(option => h('option', { key: String(option), value: String(option) }, String(option))))
      } else {
        input = h('input', {
          type: field.node.type === 'number' ? 'number' : 'text', value: draft, style: styles.input,
          'aria-label': pathKey, onChange: event => { setDraft(event.target.value); setDirty(true) },
        })
      }
      const overridden = hasPath(view.user, field.path)
      return h('div', { key: pathKey, style: styles.field },
        h('div', null,
          h('div', { style: { fontSize: 12, fontWeight: 600, overflowWrap: 'anywhere' } }, pathKey),
          h('div', { style: styles.muted }, `${t('source')}: ${sourceText(provenance?.effective, t)}`),
          provenance?.shadowed?.length ? h('div', { style: styles.muted }, `${t('shadowed')}: ${provenance.shadowed.map(source => sourceText(source, t)).join(', ')}`) : null),
        input,
        h('div', { style: { display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' } },
          h('button', { type: 'button', style: styles.button, disabled: !dirty || !view.writable, onClick: () => { void save() } }, t('save')),
          overridden ? h('button', { type: 'button', style: styles.button, disabled: !view.writable, onClick: () => { void reset() } }, t('reset')) : null,
          notice ? h('span', { role: 'status', style: styles.muted }, notice) : null))
    }

    function ConfigSection({ view, forms, provenance, t }) {
      const form = forms.get(view.ns)
      const [version, setVersion] = React.useState(0)
      React.useEffect(() => form.subscribe(() => setVersion(value => value + 1)), [form])
      const state = form.getSnapshot()
      const fields = schemaFields(view.schema).filter(field => !view.secrets?.some(secret =>
        isPathPrefix(field.path, secret.path) || isPathPrefix(secret.path, field.path)))
      return h('details', { style: styles.detail, key: view.ns, 'data-revision': version },
        h('summary', { style: { cursor: 'pointer', fontWeight: 650, fontSize: 13 } }, view.ns),
        state.status === 'loading' ? h('p', { style: styles.message }, t('loadingForm')) : null,
        state.status === 'unavailable' ? h('p', { style: styles.message }, t('formUnavailable')) : null,
        fields.length === 0 ? h('p', { style: styles.message }, t('noSchemaFields')) : null,
        fields.map(field => h(FieldEditor, {
          key: field.path.join('.'), field, view: { ...view, value: state.value ?? view.value, revision: state.revision ?? view.revision, writable: state.writable },
          form, provenance: provenance?.get(view.ns)?.get(field.path.join('.')), t,
        })),
        view.secrets?.length ? h('p', { style: styles.muted }, t('secretsHidden', { count: String(view.secrets.length) })) : null)
    }

    function Section({ id, title, count, empty, children }) {
      const body = children ?? (empty === undefined || empty === null ? null : typeof empty === 'string' ? h('p', { style: styles.message }, empty) : empty)
      return h('section', { key: id, style: styles.section, 'aria-labelledby': `${id}-heading` },
        h('div', { style: styles.sectionHead },
          h('h2', { id: `${id}-heading`, style: styles.sectionTitle }, title),
          count === undefined ? null : h('span', { style: styles.count }, count)),
        body)
    }

    function TabBar({ tabs, active, onSelect, label }) {
      return h('div', { role: 'tablist', 'aria-label': label, style: styles.tabs },
        tabs.map(item => h('button', {
          key: item.id,
          type: 'button',
          role: 'tab',
          id: `wj-tab-${item.id}`,
          'aria-selected': String(item.id === active),
          'aria-controls': `wj-panel-${item.id}`,
          tabIndex: item.id === active ? 0 : -1,
          style: { ...styles.tab, ...(item.id === active ? styles.tabActive : {}) },
          onClick: () => onSelect(item.id),
          onKeyDown: event => {
            const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'Home' ? -tabs.length : event.key === 'End' ? tabs.length : 0
            if (!step) return
            event.preventDefault()
            const index = tabs.findIndex(entry => entry.id === active)
            const next = tabs[(index + step + tabs.length) % tabs.length]
            onSelect(next.id)
            try { event.currentTarget.ownerDocument?.getElementById(`wj-tab-${next.id}`)?.focus() } catch (_error) { /* focus stays put when the document is unavailable */ }
          },
        }, h('span', null, item.label), item.count === undefined ? null : h('span', { style: styles.tabCount }, String(item.count)))))
    }

    function PluginsPanel({ pluginRows, findings, plugins, query, busy, preview, onToggle, onPreview, onApplyPreview, onCancelPreview, t }) {
      const name = row => row.meta?.title?.en ?? row.meta?.title?.zh ?? row.moduleName
      const severity = value => t(SEVERITY_KEY[value] ?? 'severityInfo')
      return h('div', { style: styles.page },
        h('p', { style: styles.description }, t('pluginsIntro')),
        preview ? h('section', { style: { ...styles.section, padding: 16 }, 'aria-label': t('repairPreview') },
          h('h2', { style: styles.sectionTitle }, t('repairPreview')),
          h('p', { style: styles.meta }, `${t('target')}: ${plugins.find(row => row.entryId === preview.targetEntryId)?.moduleName ?? preview.targetEntryId}`),
          h('p', { style: styles.meta }, `${t('effect')}: ${t('disablePlugin')}`),
          h('p', { style: styles.meta }, `${t('risk')}: ${t(preview.risk)} · ${t(preview.reversible ? 'reversible' : 'notReversible')}`),
          h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            h('button', { type: 'button', style: { ...styles.button, ...styles.primary }, disabled: busy === preview.previewId, onClick: () => { void onApplyPreview() } }, t(preview.requiresConfirmation ? 'confirmRepair' : 'applyRepair')),
            h('button', { type: 'button', style: styles.button, onClick: onCancelPreview }, t('cancel')))) : null,
        h(Section, { id: 'findings', title: t('findingsTitle'), count: `${findings.length} ${t('items')}`, empty: t(query ? 'noMatches' : 'noRows') },
          findings.length ? h('ul', { style: styles.list }, findings.map(finding => {
            const severe = finding.severity === 'error'
            const affected = finding.affectedEntryIds.map(id => plugins.find(plugin => plugin.entryId === id)?.moduleName ?? id).join(', ')
            return h('li', { key: finding.id, style: styles.row },
              h('div', { style: styles.rowHead },
                h('div', null,
                  h('h3', { style: styles.rowTitle }, t(finding.code)),
                  h('div', { style: styles.meta }, h('span', null, `${t('severity')}: ${severity(finding.severity)}`), affected ? h('span', null, `${t('affected')}: ${affected}`) : null)),
                h('span', { style: { ...styles.badge, ...(severe ? styles.error : styles.warning) } }, severity(finding.severity))),
              finding.evidence?.name || finding.evidence?.serverName || finding.evidence?.packageName
                ? h('div', { style: styles.meta }, `${t('evidence')}: ${finding.evidence.name ?? finding.evidence.serverName ?? finding.evidence.packageName}`)
                : null,
              finding.remediationEntryIds.map(id => {
                const target = plugins.find(plugin => plugin.entryId === id)
                if (!target) return null
                return h('button', { key: id, type: 'button', style: styles.button, disabled: busy === finding.id, onClick: () => { void onPreview(finding, id) } }, t('previewRepair', { name: target.moduleName }))
              }))
          })) : null),
        h(Section, { id: 'plugins', title: t('pluginsTitle'), count: `${pluginRows.length} ${t('items')}`, empty: t(query ? 'noMatches' : 'noRows') },
          pluginRows.length ? h('ul', { style: styles.list }, pluginRows.map(row => h('li', { key: row.entryId, style: styles.row },
            h('div', { style: styles.rowHead },
              h('div', null,
                h('h3', { style: styles.rowTitle }, name(row)),
                h('div', { style: styles.meta }, h('span', null, row.entryId), h('span', null, t(row.fiberPhase ?? 'notRunning')), row.readOnlyReason ? h('span', null, t(row.readOnlyReason)) : null)),
              h('button', {
                type: 'button', style: { ...styles.button, ...(row.enabled ? styles.primary : {}) },
                'aria-pressed': String(row.enabled), disabled: busy === row.entryId || row.readOnlyReason !== undefined,
                onClick: () => { void onToggle(row) },
              }, t(row.enabled ? 'disable' : 'enable'))),
            row.diagnostic ? h('p', { style: styles.meta }, t('activationFailed')) : null))) : null))
    }

    function ConfigPanel({ settings, settingsReady, plugins, forms, provenance, t }) {
      const namespaces = settings?.namespaces ?? []
      return h('div', { style: styles.page },
        h('p', { style: styles.description }, t('configIntro')),
        h(Section, {
          id: 'configuration', title: t('configurationTitle'),
          count: `${namespaces.length} ${t('items')}`,
          empty: settingsReady ? t('configEmpty') : t('configUnavailable'),
        }, namespaces.length ? h('ul', { style: styles.list }, namespaces.map(view => h('li', { key: view.ns, style: styles.row },
          h('div', { style: styles.rowTitle }, plugins.find(row => row.entryId === view.ns)?.meta?.title?.en ?? view.ns),
          h(ConfigSection, { view, forms, provenance, t })))) : null))
    }

    function SkillPanel({ skills, needle, onRetry, t }) {
      const items = skills?.kind === 'ready' ? skills.items : []
      const matches = values => !needle || values.filter(Boolean).some(value => String(value).toLocaleLowerCase().includes(needle))
      const rows = items.filter(skill => matches([skill.name, skill.description, skill.whenToUse, skill.path]))
      const copy = skills?.kind === 'unsupported' ? t('skillUnsupported')
        : skills?.kind === 'noSession' ? t('skillNoSession')
        : skills?.kind === 'error' ? t('skillError')
        : skills?.kind === 'loading' ? t('loadingSkills')
        : needle ? t('noMatches') : t('skillEmpty')
      const retryable = skills?.kind === 'error' || skills?.kind === 'noSession'
      const empty = h('div', { style: { display: 'grid', gap: 10, justifyItems: 'start' } },
        h('p', { style: styles.message }, copy),
        retryable ? h('button', { type: 'button', style: styles.button, onClick: () => { if (onRetry) onRetry() } }, t('retry')) : null)
      const skillRow = skill => h('li', { key: `${skill.name}:${skill.path ?? ''}`, style: styles.row },
        h('div', { style: styles.rowHead },
          h('div', { style: { display: 'grid', gap: 5 } },
            h('h3', { style: styles.skillName }, `/${skill.name}`),
            skill.description ? h('p', { style: styles.body }, skill.description) : null,
            h('div', { style: styles.meta },
              skill.whenToUse ? h('span', null, `${t('skillWhenToUse')}: ${skill.whenToUse}`) : null,
              skill.path ? h('span', { style: styles.path }, `${t('skillPath')}: ${skill.path}`) : null)),
          h('span', { style: { ...styles.badge, ...(skill.modelInvocable ? {} : styles.warning) } },
            t(skill.modelInvocable ? 'skillModelInvocable' : 'skillUserOnly'))))
      return h('div', { style: styles.page },
        h('p', { style: styles.description }, t('skillIntro')),
        h(Section, { id: 'skills', title: t('skillsTitle'), count: `${rows.length} ${t('items')}`, empty },
          rows.length ? h('ul', { style: styles.list }, rows.map(skillRow)) : null))
    }

    function McpPanel({ inventory, mcpRows, toolRows, needle, t }) {
      const owner = row => row.owner ? `${row.owner.moduleName} (${row.owner.entryId})` : '—'
      return h('div', { style: styles.page },
        h('p', { style: styles.description }, t('mcpIntro')),
        h(Section, { id: 'mcp', title: t('mcp'), count: `${mcpRows.length} ${t('items')}`, empty: t(needle ? 'noMatches' : 'noRows') },
          mcpRows.length ? h('ul', { style: styles.list }, mcpRows.map(row => h('li', { key: `${row.serverName}:${row.owner?.entryId ?? ''}`, style: styles.row },
            h('div', { style: styles.rowHead },
              h('h3', { style: styles.rowTitle }, row.serverName),
              h('span', { style: { ...styles.badge, ...(row.state === 'connected' ? {} : styles.warning) } }, t(row.state))),
            h('div', { style: styles.meta }, `${t('owner')}: ${owner(row)}`),
            row.toolNames?.length ? h('div', { style: styles.meta }, `${t('toolNames')}: ${row.toolNames.join(', ')}`) : null))) : null),
        h(Section, { id: 'tools', title: t('tools'), count: `${toolRows.length} ${t('items')}`, empty: t(needle ? 'noMatches' : 'noRows') },
          toolRows.length ? h('ul', { style: styles.list }, toolRows.map(row => h('li', { key: `${row.name}:${row.owner?.entryId ?? ''}`, style: styles.row },
            h('h3', { style: styles.rowTitle }, row.name),
            h('div', { style: styles.meta }, `${t('owner')}: ${owner(row)} · ${t(row.scope)}`)))) : null),
        inventory ? null : h('p', { style: styles.message }, t('inventoryUnavailable')))
    }

    function ManagerPage({ list, manager, forms, loadSkills, readSessionId, watchSessions, t }) {
      const initialTab = readStoredTab()
      const [tab, setTab] = React.useState(initialTab)
      const [visited, setVisited] = React.useState([initialTab])
      const [state, setState] = React.useState({ kind: 'loading' })
      const [query, setQuery] = React.useState('')
      const [revision, setRevision] = React.useState(0)
      const [busy, setBusy] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [preview, setPreview] = React.useState(null)
      const [sessionId, setSessionId] = React.useState(() => typeof readSessionId === 'function' ? readSessionId() : undefined)
      const [skills, setSkills] = React.useState({ kind: 'loading' })
      const [skillsRevision, setSkillsRevision] = React.useState(0)

      // The catalog follows the active session: opening one (or switching) reloads it without a
      // manual refresh, which is what a Host that requires a live session for `skills/list` needs.
      React.useEffect(() => {
        if (typeof readSessionId !== 'function') return undefined
        const sync = () => {
          try { setSessionId(readSessionId()) } catch (_error) { /* keep the last known session */ }
        }
        sync()
        const off = typeof watchSessions === 'function' ? watchSessions(sync) : undefined
        return typeof off === 'function' ? off : undefined
      }, [readSessionId, watchSessions])

      React.useEffect(() => {
        let live = true
        if (!sessionId) {
          setSkills({ kind: 'noSession' })
          return () => { live = false }
        }
        if (typeof loadSkills !== 'function') {
          setSkills({ kind: 'unsupported' })
          return () => { live = false }
        }
        setSkills({ kind: 'loading' })
        Promise.resolve()
          .then(() => loadSkills(sessionId))
          .then(result => { if (live) setSkills(result ?? { kind: 'error' }) })
          .catch(() => { if (live) setSkills({ kind: 'error' }) })
        return () => { live = false }
      }, [loadSkills, sessionId, skillsRevision])

      React.useEffect(() => {
        let live = true
        Promise.resolve().then(async () => {
          const [inventoryResult, pluginResult, healthResult, settingsResult] = await Promise.allSettled([
            list(),
            manager?.listPlugins ? manager.listPlugins() : Promise.reject(new Error('unavailable')),
            manager?.getHealthSnapshot ? manager.getHealthSnapshot() : Promise.reject(new Error('unavailable')),
            forms?.describe ? forms.describe().ensure().then(() => forms.describe().getSnapshot()) : Promise.reject(new Error('unavailable')),
          ])
          if (inventoryResult.status !== 'fulfilled') throw inventoryResult.reason
          const inventory = inventoryResult.value
          const plugins = pluginResult.status === 'fulfilled' ? unwrap(pluginResult.value, 'pluginManager.listPlugins') : []
          const health = healthResult.status === 'fulfilled' ? unwrap(healthResult.value, 'pluginManager.getHealthSnapshot') : undefined
          const settings = settingsResult.status === 'fulfilled' ? settingsResult.value.view : undefined
          const provenance = new Map()
          if (settings && manager?.getConfigProvenance) {
            await Promise.all(settings.namespaces.map(async view => {
              const hidden = new Set((view.secrets ?? []).map(secret => secret.path.join('.')))
              const fields = schemaFields(view.schema).map(field => field.path).filter(path => !hidden.has(path.join('.')))
              if (!fields.length) return
              try {
                const result = unwrap(await manager.getConfigProvenance(view.ns, fields), 'pluginManager.getConfigProvenance')
                provenance.set(view.ns, new Map(result.map(item => [item.fieldPath.join('.'), item])))
              } catch (_unavailable) {
                provenance.set(view.ns, new Map())
              }
            }))
          }
          if (live) setState({ kind: 'ready', snapshot: { inventory, plugins, health, settings, provenance } })
        }).catch(() => {
          if (live) setState(previous => ({ kind: 'error', snapshot: previous.snapshot }))
        })
        return () => { live = false }
      }, [list, manager, forms, revision])

      const refresh = () => {
        setState(current => ({ kind: 'loading', snapshot: current.snapshot }))
        setRevision(value => value + 1)
        setSkillsRevision(value => value + 1)
      }

      const select = id => {
        setTab(id)
        setVisited(previous => previous.includes(id) ? previous : [...previous, id])
        storeTab(id)
      }

      const applyNotice = result => {
        setNotice(result.application === 'applied' ? t('changeApplied')
          : result.application === 'restart-required' ? t('restartRequired')
          : result.application === 'overridden' ? t('changeOverridden')
          : t('changeFailed'))
      }

      const toggle = async row => {
        setBusy(row.entryId)
        setNotice('')
        try {
          applyNotice(unwrap(await manager.setPluginEnabled(row.entryId, !row.enabled), 'pluginManager.setPluginEnabled'))
          refresh()
        } catch (_error) {
          setNotice(t('changeFailed'))
        } finally {
          setBusy('')
        }
      }

      const makePreview = async (finding, targetEntryId) => {
        setBusy(finding.id)
        setPreview(null)
        try {
          const next = unwrap(await manager.previewRemediation({ findingId: finding.id, targetEntryId }), 'pluginManager.previewRemediation')
          if (next.requiresConfirmation) setPreview(next)
          else {
            applyNotice(unwrap(await manager.applyRemediation(next.previewId, false), 'pluginManager.applyRemediation'))
            refresh()
          }
        } catch (_error) {
          setNotice(t('previewOrRepairFailed'))
        } finally {
          setBusy('')
        }
      }

      const applyPreview = async () => {
        if (!preview) return
        setBusy(preview.previewId)
        try {
          applyNotice(unwrap(await manager.applyRemediation(preview.previewId, preview.requiresConfirmation), 'pluginManager.applyRemediation'))
          setPreview(null)
          refresh()
        } catch (_error) {
          setNotice(t('stalePreview'))
          setPreview(null)
          refresh()
        } finally {
          setBusy('')
        }
      }

      const current = state.snapshot
      const inventory = current?.inventory
      const plugins = current?.plugins ?? []
      const health = current?.health
      const settings = current?.settings
      const needle = query.trim().toLocaleLowerCase()
      const matches = values => !needle || values.filter(Boolean).some(value => String(value).toLocaleLowerCase().includes(needle))
      const pluginRows = plugins.filter(row => matches([row.moduleName, row.entryId, row.meta?.title, row.meta?.description]))
      const findings = (health?.findings ?? []).filter(row => matches([row.id, row.code, row.evidence?.name, row.evidence?.serverName, row.evidence?.packageName]))
      const toolRows = (inventory?.toolRegistrations ?? []).filter(row => matches([row.name, row.owner?.moduleName, row.owner?.entryId]))
      const mcpRows = (inventory?.mcpClients ?? []).filter(row => matches([row.serverName, row.state, row.owner?.moduleName, ...(row.toolNames ?? [])]))

      const tabs = [
        { id: 'plugins', label: t('tabs.plugins'), count: plugins.length },
        { id: 'config', label: t('tabs.config'), count: settings?.namespaces?.length },
        { id: 'skill', label: t('tabs.skill'), count: skills?.kind === 'ready' ? skills.items.length : undefined },
        { id: 'mcp', label: t('tabs.mcp'), count: inventory?.mcpClients?.length },
      ]

      const panel = (id, children) => visited.includes(id) ? h('div', {
        key: id,
        role: 'tabpanel',
        id: `wj-panel-${id}`,
        'aria-labelledby': `wj-tab-${id}`,
        hidden: id !== tab,
        style: id === tab ? styles.page : { display: 'none' },
      }, children) : null

      const stats = [
        [health?.pluginCount ?? plugins.length, 'plugins'],
        [health?.enabledCount ?? plugins.filter(row => row.enabled).length, 'enabled'],
        [health ? health.findings.length : '—', 'findings'],
        [skills?.kind === 'ready' ? skills.items.length : '—', 'skills'],
        [inventory?.mcpClients?.length ?? '—', 'mcpStat'],
      ]
      const showStats = state.kind === 'ready' && current !== undefined

      return h('div', { style: styles.root, 'aria-busy': state.kind === 'loading' },
        h('header', { style: styles.header },
          h('div', null,
            h('p', { style: styles.eyebrow }, t('eyebrow')),
            h('h1', { style: styles.title }, t('heading')),
            h('p', { style: styles.description }, t('description'))),
          showStats ? h('div', { style: styles.stats, 'aria-label': t('summary') },
            stats.map(([value, label]) => h('div', { key: label, style: styles.stat },
              h('span', { style: styles.statValue }, String(value)),
              h('span', { style: styles.statLabel }, t(label))))) : null),
        h('div', { style: styles.toolbar },
          h('input', { type: 'search', value: query, 'aria-label': t('search'), placeholder: t('search'), onChange: event => setQuery(event.target.value), style: styles.search }),
          h('button', { type: 'button', onClick: refresh, style: styles.button, disabled: state.kind === 'loading' }, state.kind === 'loading' ? t('loadingShort') : t('refresh'))),
        h(TabBar, { tabs, active: tab, onSelect: select, label: t('viewsLabel') }),
        state.kind === 'loading' && !inventory ? h('p', { role: 'status', style: styles.message }, t('loading')) : null,
        state.kind === 'error' ? h('div', { role: 'alert', style: styles.section },
          h('p', { style: styles.message }, t('error')),
          h('button', { type: 'button', style: styles.button, onClick: refresh }, t('retry'))) : null,
        notice ? h('p', { role: 'status', style: styles.message }, notice) : null,
        !health && state.kind === 'ready' ? h('p', { role: 'status', style: styles.message }, t('diagnosticsUnavailable')) : null,
        panel('plugins', h(PluginsPanel, {
          pluginRows, findings, plugins, query: needle, busy, preview,
          onToggle: toggle, onPreview: makePreview, onApplyPreview: applyPreview, onCancelPreview: () => { setPreview(null) }, t,
        })),
        panel('config', h(ConfigPanel, { settings, settingsReady: settings !== undefined, plugins, forms, provenance: current?.provenance, t })),
        panel('skill', h(SkillPanel, { skills, needle, onRetry: refresh, t })),
        panel('mcp', h(McpPanel, { inventory, mcpRows, toolRows, needle, t })))
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.pluginInventory', 'remote.pluginManager', 'configForms'],
      apply(ctx) {
        const zh = {
          tab: '插件管理', search: '搜索当前视图的插件、配置、Skill 或 MCP', refresh: '刷新', loading: '正在读取 Host 状态…', loadingShort: '读取中…',
          eyebrow: '插件健康与管理', heading: '插件管理', description: '查看插件状态与冲突，追踪配置来源，浏览 Skill 目录与 MCP 客户端，并通过受控操作修复问题。', summary: '当前状态', items: '项',
          viewsLabel: '管理视图', 'tabs.plugins': '插件', 'tabs.config': '配置', 'tabs.skill': 'Skill', 'tabs.mcp': 'MCP',
          pluginsIntro: '实时插件清单、健康诊断与启停操作。只列出当前 Profile 可寻址的插件。',
          configIntro: '按 Host schema 编辑非密钥配置，并查看每个字段的有效来源与被覆盖层。',
          skillIntro: '当前会话可用的 Skill 目录，按会话工作目录解析，并随会话切换自动刷新；模型可调用与仅用户可调用的条目分开标记。',
          mcpIntro: '已组合的 MCP 客户端连接状态与工具注册归属。',
          error: '无法读取运行时清单。', retry: '重试', noRows: '暂无记录。', noMatches: '没有匹配的记录。', diagnosticsUnavailable: '此 Harness Host 尚未提供诊断接口；当前显示可用的插件和注册清单。',
          inventoryUnavailable: '此 Host 未提供运行时清单接口，工具与 MCP 信息不可用。',
          findingsTitle: '健康诊断', pluginsTitle: '插件', configurationTitle: '配置管理', plugins: '插件', enabled: '已启用', findings: '发现项', severity: '严重程度', affected: '相关插件', evidence: '证据',
          configEmpty: 'Host 未暴露可编辑的配置命名空间。', configUnavailable: '此 Host 未提供设置表单接口，配置视图不可用。',
          skillsTitle: 'Skill 目录', skillEmpty: '当前会话没有可用的 Skill。', skillUnsupported: '此 Host 未提供 skills 接口，Skill 目录不可用。', skillNoSession: '尚无可用会话。打开或切换会话后，这里会自动加载，无需刷新。', skillError: '无法读取 Skill 目录。', loadingSkills: '正在读取 Skill 目录…',
          skillModelInvocable: '模型可调用', skillUserOnly: '仅用户可调用', skillWhenToUse: '适用场景', skillPath: '指令文件',
          mcpStat: 'MCP', skills: 'Skill',
          'plugin.activation-failed': '插件启动失败', 'tool.duplicate-name': '工具名称重复', 'mcp.connection-failed': 'MCP 连接异常', 'mcp.duplicate-name': 'MCP 名称重复',
          'bundle.compatibility-rejected': '组合包版本不兼容', 'bundle.dependency-invalid': '所选依赖无效', severityError: '错误', severityWarning: '警告', severityInfo: '提示', warning: '警告', info: '提示',
          source: '配置来源', shadowed: '被覆盖来源', sourceUnknown: '未知（Host 未提供来源）', bundle: '组合包', profile: 'Profile', home: 'Home', invocation: '本次启动',
          save: '保存', reset: '恢复继承值', saved: '已保存', revisionConflict: '配置已被其他操作修改；草稿仍保留，请刷新后重试。', saveFailed: '保存失败，草稿已保留。', invalidNumber: '请输入有效数字。', loadingForm: '正在载入表单…', formUnavailable: '此配置表单当前不可用。', noSchemaFields: '没有可编辑的 schema 字段。', secretsHidden: '密钥字段已隐藏（{count} 项）。',
          previewRepair: '诊断并修复 {name}', repairPreview: '修复预览', target: '目标', effect: '影响', disablePlugin: '关闭插件', risk: '风险', low: '低', high: '高', reversible: '可撤销', notReversible: '不可撤销', applyRepair: '执行修复', confirmRepair: '确认并执行', cancel: '取消', previewOrRepairFailed: '无法预览或执行此修复。', stalePreview: '修复预览已过期或状态已变化，请重新加载后再试。',
          changeApplied: '设置已保存并应用。', restartRequired: '设置已保存；重启后生效。', changeOverridden: '设置已保存，但被更高优先级配置覆盖。', changeFailed: 'Host 未能应用此更改。',
          enable: '启用', disable: '停用', disabled: '已停用', enabledTag: '已启用', disabledTag: '已停用', active: '运行中', failed: '失败', loadingPhase: '加载中', pending: '等待中', unloading: '卸载中', notRunning: '未运行',
          'management-required': '管理服务受保护', unaddressable: '此条目无法通过当前 Profile 修改', activationFailed: '插件未能完成启动。', owner: '所属插件', tools: '工具注册', mcp: 'MCP 客户端', toolNames: '工具名称', global: '全局', scoped: '作用域', starting: '启动中', connected: '已连接', reconnecting: '正在重连', stopped: '已停止',
        }
        const en = {
          tab: 'Plugin management', search: 'Search the current view for plugins, settings, skills or MCP', refresh: 'Refresh', loading: 'Reading Host state…', loadingShort: 'Loading…',
          eyebrow: 'PLUGIN HEALTH AND MANAGEMENT', heading: 'Plugin management', description: 'Review plugin status and conflicts, trace configuration sources, browse the skill catalog and MCP clients, and repair issues through bounded actions.', summary: 'Current status', items: 'items',
          viewsLabel: 'Management views', 'tabs.plugins': 'Plugins', 'tabs.config': 'Configuration', 'tabs.skill': 'Skills', 'tabs.mcp': 'MCP',
          pluginsIntro: 'Live plugin inventory, health findings and enable/disable actions. Only plugins addressable by the active profile are listed.',
          configIntro: 'Edit non-secret settings through the Host schema and see each field’s effective source and shadowed layers.',
          skillIntro: 'Skills available to the current session, resolved from its working directory and reloaded automatically when the session changes; model-invocable and user-only entries are marked separately.',
          mcpIntro: 'Composed MCP client connections and the owners of registered tools.',
          error: 'The runtime inventory could not be read.', retry: 'Retry', noRows: 'No records.', noMatches: 'No matching records.', diagnosticsUnavailable: 'This Harness Host does not expose diagnostics yet. Available plugin and registration inventories are still shown.',
          inventoryUnavailable: 'This Host does not expose the runtime inventory; tool and MCP details are unavailable.',
          findingsTitle: 'Health findings', pluginsTitle: 'Plugins', configurationTitle: 'Configuration', plugins: 'plugins', enabled: 'enabled', findings: 'findings', severity: 'Severity', affected: 'Affected plugins', evidence: 'Evidence',
          configEmpty: 'The Host exposes no editable configuration namespaces.', configUnavailable: 'This Host does not expose settings forms; configuration is unavailable.',
          skillsTitle: 'Skill catalog', skillEmpty: 'The current session has no available skills.', skillUnsupported: 'This Host does not expose the skills interface; the catalog is unavailable.', skillNoSession: 'No session yet. Open or switch a session and this view loads automatically — no refresh needed.', skillError: 'The skill catalog could not be read.', loadingSkills: 'Reading the skill catalog…',
          skillModelInvocable: 'Model-invocable', skillUserOnly: 'User-only', skillWhenToUse: 'When to use', skillPath: 'Instruction file',
          mcpStat: 'MCP', skills: 'skills',
          'plugin.activation-failed': 'Plugin activation failed', 'tool.duplicate-name': 'Duplicate tool name', 'mcp.connection-failed': 'MCP connection issue', 'mcp.duplicate-name': 'Duplicate MCP name',
          'bundle.compatibility-rejected': 'Bundle version is incompatible', 'bundle.dependency-invalid': 'Selected dependency is invalid', severityError: 'Error', severityWarning: 'Warning', severityInfo: 'Info', warning: 'Warning', info: 'Info',
          source: 'Configuration source', shadowed: 'Shadowed sources', sourceUnknown: 'Unknown (Host did not provide a source)', bundle: 'Bundle', profile: 'Profile', home: 'Home', invocation: 'This launch',
          save: 'Save', reset: 'Reset to inherited value', saved: 'Saved', revisionConflict: 'Configuration changed elsewhere. Your draft is kept; refresh before retrying.', saveFailed: 'Save failed. Your draft is kept.', invalidNumber: 'Enter a valid number.', loadingForm: 'Loading form…', formUnavailable: 'This configuration form is unavailable.', noSchemaFields: 'No editable schema fields.', secretsHidden: '{count} secret fields are hidden.',
          previewRepair: 'Diagnose and repair {name}', repairPreview: 'Repair preview', target: 'Target', effect: 'Effect', disablePlugin: 'Disable plugin', risk: 'Risk', low: 'Low', high: 'High', reversible: 'Reversible', notReversible: 'Not reversible', applyRepair: 'Apply repair', confirmRepair: 'Confirm and apply', cancel: 'Cancel', previewOrRepairFailed: 'Could not preview or apply this repair.', stalePreview: 'The preview expired or state changed. Reload and preview the repair again.',
          changeApplied: 'The change was saved and applied.', restartRequired: 'The change was saved and will apply after restart.', changeOverridden: 'The change was saved but overridden by a higher-priority configuration.', changeFailed: 'The Host could not apply this change.',
          enable: 'Enable', disable: 'Disable', disabled: 'Disabled', enabledTag: 'Enabled', disabledTag: 'Disabled', active: 'Active', failed: 'Failed', loadingPhase: 'Loading', pending: 'Pending', unloading: 'Unloading', notRunning: 'Not running',
          'management-required': 'Management service is protected', unaddressable: 'This entry cannot be changed by the current profile', activationFailed: 'The plugin did not finish starting.', owner: 'Owner', tools: 'Tool registrations', mcp: 'MCP clients', toolNames: 'Tool names', global: 'Global', scoped: 'Scoped', starting: 'Starting', connected: 'Connected', reconnecting: 'Reconnecting', stopped: 'Stopped',
        }
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plugin-manager-wj: dictionaries')
        const t = ctx.locale.bind(NS)
        const list = async () => unwrap(await ctx.remote.pluginInventory.list(), 'pluginInventory.list')
        const manager = ctx.remote.pluginManager
        const forms = ctx.get('configForms')

        // The skill catalog is session-scoped (`skills/list`) and optional. Both services are read
        // through `ctx.get` rather than `inject`: a Client plugin that lists an optional service in
        // `inject` stays pending on a Host without it, which would take the whole tab down. Names are
        // probed instead of hardcoded so a differently named skills namespace needs no code change.
        const service = name => {
          try { return ctx.get(name) } catch (_error) { return undefined }
        }
        const namespace = name => {
          const direct = service(`remote.${name}`)
          if (direct) return direct
          try { return ctx.get('remote')?.[name] } catch (_error) { return undefined }
        }
        const SKILL_NAMESPACE_NAMES = ['skills', 'skill', 'skillCatalog']
        const skillsRemote = () => {
          for (const name of SKILL_NAMESPACE_NAMES) {
            const candidate = namespace(name)
            if (candidate && typeof candidate.list === 'function') return candidate
          }
          let registered = []
          try { registered = Object.keys(ctx.get('remote') ?? {}) } catch (_error) { registered = [] }
          for (const name of registered.filter(entry => /skill/i.test(entry))) {
            const candidate = namespace(name)
            if (candidate && typeof candidate.list === 'function') return candidate
          }
          return undefined
        }
        const activeSessionId = () => {
          try {
            const rows = Object.values(service('sessions')?.list?.getSnapshot?.()?.byId ?? {})
            const retained = rows.filter(row => (row?.retainedBy?.mainView ?? 0) > 0)
            const chosen = retained.find(row => row?.cwd) ?? retained[0] ?? rows.find(row => row?.cwd) ?? rows[0]
            return chosen?.id
          } catch (_error) {
            return undefined
          }
        }
        const watchSessions = listener => {
          const store = service('sessions')?.list
          if (!store || typeof store.subscribe !== 'function') return undefined
          try { return store.subscribe(listener) } catch (_error) { return undefined }
        }
        const loadSkills = async sessionId => {
          const remote = skillsRemote()
          if (!remote) return { kind: 'unsupported' }
          const id = sessionId ?? activeSessionId()
          if (!id) return { kind: 'noSession' }
          try {
            const value = unwrap(await remote.list({ sessionId: id }), 'skills/list')
            return { kind: 'ready', items: Array.isArray(value?.skills) ? value.skills : [] }
          } catch (_error) {
            return { kind: 'error' }
          }
        }

        ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
          name: 'settings.plugins.tab', id: 'wj-registration-inventory', order: 20,
          label: () => t('tab'), locale: NS,
          inject: () => ({ list, manager, forms, loadSkills, readSessionId: activeSessionId, watchSessions }),
        }, ManagerPage))
      },
    }
  },
})
