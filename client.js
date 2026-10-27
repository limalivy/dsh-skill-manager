window.__ModuleLoader__.load({
  id: '@limalivy/dsh-skill-manager',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    // Shared browser primitives (anchored panel placement, outside-pointer dismissal).
    // They are part of the shell's platform module table; the fallbacks keep this
    // bundle loadable if a release moves them.
    const primitives = (() => {
      try {
        return require('@deepseek-ai/dsh-client-ui-primitives')
      } catch {
        return {}
      }
    })()
    const useAnchoredPosition = primitives.useAnchoredPosition ?? (() => null)
    const useDismissOnOutsidePointer = primitives.useDismissOnOutsidePointer ?? (() => {})
    const createPortal = (() => {
      try {
        return require('react-dom').createPortal
      } catch {
        return undefined
      }
    })()

    const CHANNEL = '/skill-manager'
    const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

    const TEXT = {
      zh: {
        title: '技能管理',
        close: '关闭',
        newSkill: '新建技能',
        name: '名称',
        description: '触发说明',
        whenToUse: '何时使用',
        body: '正文',
        save: '保存',
        saved: '已保存',
        saving: '保存中…',
        delete: '删除',
        confirmDelete: '确认删除',
        cancel: '取消',
        create: '创建',
        creating: '创建中…',
        search: '搜索技能',
        all: '全部',
        user: '用户',
        project: '项目',
        empty: '还没有技能，点右上角新建',
        pick: '从左侧选择技能',
        location: '保存位置',
        modelOn: '模型可调用',
        userOn: '用户可调用',
        refresh: '刷新',
        tabSkills: '技能',
        tabRules: '规则',
        ruleMissing: '未创建',
        ruleHint: 'AGENTS.md 会在每次请求时作为规则注入，保存后下一次请求生效。',
        deleteRule: '删除规则文件',
        dockTitle: '技能',
        menuTitle: '本次对话用到的技能',
        turnSkills: '本轮技能',
        manage: '技能管理',
      },
      en: {
        title: 'Skill Manager',
        close: 'Close',
        newSkill: 'New skill',
        name: 'Name',
        description: 'Description',
        whenToUse: 'When to use',
        body: 'Body',
        save: 'Save',
        saved: 'Saved',
        saving: 'Saving…',
        delete: 'Delete',
        confirmDelete: 'Confirm delete',
        cancel: 'Cancel',
        create: 'Create',
        creating: 'Creating…',
        search: 'Search skills',
        all: 'All',
        user: 'User',
        project: 'Project',
        empty: 'No skills yet — create one',
        pick: 'Select a skill',
        location: 'Location',
        modelOn: 'Model invocable',
        userOn: 'User invocable',
        refresh: 'Refresh',
        tabSkills: 'Skills',
        tabRules: 'Rules',
        ruleMissing: 'not created',
        ruleHint: 'AGENTS.md is injected as instructions on every request; a save applies to the next request.',
        deleteRule: 'Delete rule file',
        dockTitle: 'Skills',
        menuTitle: 'Skills used in this conversation',
        turnSkills: 'Skills this turn',
        manage: 'Manage skills',
      },
    }

    const ROOTS = {
      'user-dsh': { zh: '用户 · ~/.dsh/skills', en: 'User · ~/.dsh/skills' },
      'user-agents': { zh: '用户 · ~/.agents/skills', en: 'User · ~/.agents/skills' },
      'project-dsh': { zh: '项目 · .dsh/skills', en: 'Project · .dsh/skills' },
      'project-agents': { zh: '项目 · .agents/skills', en: 'Project · .agents/skills' },
    }

    const CSS = `
.sm-dock { position:relative; display:inline-flex; flex:none; }
.sm-icon { box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center; padding:0;
  width:calc(22px + var(--dsh-content-font-delta-secondary,0px));
  height:calc(22px + var(--dsh-content-font-delta-secondary,0px));
  border:none; border-radius:var(--dsw-radius-sm); background:0 0; color:var(--dsw-alias-label-tertiary);
  font:inherit; font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);
  line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px)); cursor:pointer; flex:none; }
.sm-icon svg { width:14px; height:14px; flex:none; }
.sm-icon:hover, .sm-icon[aria-expanded="true"] { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-secondary); }
.sm-menu { z-index:1100; box-sizing:border-box; width:min(268px,100vw - 24px); padding:6px; border-radius:var(--dsw-radius-lg);
  background:var(--dsw-specific-menu); backdrop-filter:var(--dsw-menu-backdrop-filter);
  border:1px solid var(--dsw-alias-border-l1); box-shadow:var(--dsw-elevation-prominent);
  color:var(--dsw-alias-label-secondary); font-size:12px; line-height:20px; position:fixed; }
.sm-menu-head { padding:5px 8px 3px; font-size:11px; color:var(--dsw-alias-label-tertiary); }
.sm-menu-list { max-height:240px; overflow-y:auto; display:flex; flex-direction:column; }
.sm-menu-item { display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:7px;
  color:var(--dsw-alias-label-primary); }
.sm-menu-name { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sm-menu-count { flex:none; color:var(--dsw-alias-label-tertiary); font-variant-numeric:tabular-nums; font-size:11px; }
.sm-menu-sep { height:1px; margin:5px 6px; background:var(--dsw-alias-border-l1); }
.sm-menu-manage { display:flex; align-items:center; gap:8px; width:100%; padding:6px 8px; border-radius:7px;
  border:none; background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:12px;
  cursor:pointer; text-align:left; }
.sm-menu-manage:hover { background:var(--dsw-alias-interactive-bg-hover); }
.sm-menu-glyph { display:inline-flex; flex:none; color:var(--dsw-alias-label-tertiary); }
.sm-turn { display:inline-flex; align-items:center; flex:none; }
.sm-turn-trigger { box-sizing:border-box; display:inline-flex; align-items:center; gap:4px;
  height:calc(28px + var(--dsh-content-font-delta,0px)); padding:0 6px; border:none;
  border-radius:var(--dsw-radius-sm); background:0 0; color:var(--dsw-alias-label-tertiary);
  font:inherit; font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px); cursor:pointer; }
.sm-turn-trigger:hover, .sm-turn-trigger[aria-expanded="true"] { background:var(--dsw-alias-interactive-bg-hover);
  color:var(--dsw-alias-label-secondary); }
.sm-turn-trigger svg { width:calc(15px + var(--dsh-content-font-delta,0px)); height:calc(15px + var(--dsh-content-font-delta,0px)); flex:none; }
.sm-turn-count { font-variant-numeric:tabular-nums; }
.sm-backdrop { position:fixed; inset:0; z-index:80; display:flex; align-items:center; justify-content:center;
  padding:28px; background:rgba(0,0,0,.38); }
.sm-dialog { width:min(1040px,96vw); height:min(800px,92vh); display:flex; flex-direction:column; gap:10px;
  padding:16px 18px; border-radius:14px; border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); box-shadow:0 24px 64px rgba(0,0,0,.32); }
.sm-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.sm-head h3 { margin:0; font-size:15px; font-weight:600; }
.sm-head-actions { display:flex; gap:8px; align-items:center; }
.sm-close { border-radius:var(--dsw-radius-sm); cursor:pointer; width:28px; height:28px;
  color:var(--dsw-alias-label-primary); background:0 0; border:none; justify-content:center; align-items:center;
  padding:0; display:inline-flex; flex:none; }
.sm-close:hover { color:var(--dsw-alias-label-secondary); }
.sm-btn { height:28px; padding:0 10px; border-radius:7px; border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:12px;
  cursor:pointer; flex:none; white-space:nowrap; }
.sm-btn:disabled { opacity:.5; cursor:default; }
.sm-primary { border-color:transparent; background:var(--dsw-alias-brand-primary); color:#fff; }
.sm-btn[data-on="1"] { background:var(--dsw-alias-bg-layer-2); border-color:var(--dsw-alias-border-l2); font-weight:600; }
.sm-danger { color:var(--dsw-alias-state-error-primary); }
.sm-toolbar { display:flex; gap:8px; align-items:center; }
.sm-toolbar .sm-input { flex:1 1 auto; min-width:0; width:auto; }
.sm-input, .sm-area { box-sizing:border-box; width:100%; border:1px solid var(--dsw-alias-border-l1); border-radius:7px;
  background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; }
.sm-input { height:28px; padding:0 8px; }
.sm-area { padding:6px 8px; line-height:18px; resize:vertical; }
.sm-main { flex:1; min-height:0; display:flex; gap:12px; }
.sm-list { width:270px; flex:none; overflow-y:auto; display:flex; flex-direction:column; gap:2px; }
.sm-group { margin:8px 0 2px; font-size:10px; text-transform:uppercase; color:var(--dsw-alias-label-secondary); }
.sm-row { text-align:left; padding:6px 8px; border-radius:7px; border:1px solid transparent; background:transparent;
  color:inherit; font:inherit; cursor:pointer; }
.sm-row:hover { background:var(--dsw-alias-bg-layer-2); }
.sm-row[data-on="1"] { background:var(--dsw-alias-bg-layer-2); border-color:var(--dsw-alias-border-l2); }
.sm-row b { display:block; font-size:12px; font-weight:500; }
.sm-row i { display:block; font-style:normal; font-size:11px; color:var(--dsw-alias-label-secondary);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sm-detail { flex:1; min-width:0; overflow-y:auto; display:flex; flex-direction:column; gap:8px; }
.sm-label { font-size:11px; color:var(--dsw-alias-label-secondary); }
.sm-path { font-size:10px; color:var(--dsw-alias-label-secondary); font-family:ui-monospace, Menlo, monospace;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sm-code { min-height:220px; font-family:ui-monospace, Menlo, monospace; font-size:12px; line-height:18px; }
.sm-status { font-size:11px; color:var(--dsw-alias-label-secondary); min-height:14px; }
.sm-status[data-k="error"] { color:var(--dsw-alias-state-error-primary); }
.sm-status[data-k="ok"] { color:var(--dsw-alias-state-success-primary); }
.sm-foot { font-size:10px; color:var(--dsw-alias-label-secondary); word-break:break-all; }
.sm-check { display:flex; align-items:center; gap:6px; font-size:12px; }
.sm-check button { width:30px; height:17px; border-radius:9px; border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-2); position:relative; cursor:pointer; padding:0; }
.sm-check button::after { content:""; position:absolute; top:2px; left:2px; width:11px; height:11px; border-radius:50%;
  background:var(--dsw-alias-label-secondary); }
.sm-check button[aria-checked="true"] { background:var(--dsw-alias-brand-primary); border-color:transparent; }
.sm-check button[aria-checked="true"]::after { left:15px; background:#fff; }
.sm-form { position:fixed; inset:0; z-index:90; display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.42); }
.sm-card { width:min(440px,94vw); display:flex; flex-direction:column; gap:10px; padding:16px; border-radius:12px;
  background:var(--dsw-alias-bg-overlay); border:1px solid var(--dsw-alias-border-l1); }
.sm-card h4 { margin:0; font-size:14px; }
`

    function localeId(locale) {
      try {
        const snap = locale?.getSnapshot?.() ?? locale?.getLocale?.()
        if (typeof snap === 'string') return snap
        const id = snap?.active ?? snap?.id
        return typeof id === 'string' && id !== '' ? id : 'zh'
      } catch {
        return 'zh'
      }
    }

    /** Locale-bound text lookup for the dock and the turn footer. */
    function useText(ctx) {
      const locale = (() => {
        try {
          return ctx.get('locale')
        } catch {
          return undefined
        }
      })()
      const [lang, setLang] = useState(() => localeId(locale))
      useEffect(() => {
        if (!locale?.subscribe) return undefined
        const read = () => setLang(localeId(locale))
        read()
        return locale.subscribe(read)
      }, [locale])
      return (key) => (TEXT[lang === 'zh' ? 'zh' : 'en'][key] ?? key)
    }

    const RULE_LABELS = {
      'user-dsh': { zh: '全局 · ~/.dsh/AGENTS.md', en: 'Global · ~/.dsh/AGENTS.md' },
      'user-agents': { zh: '全局 · ~/.agents/AGENTS.md', en: 'Global · ~/.agents/AGENTS.md' },
      'project-root': { zh: '项目 · AGENTS.md', en: 'Project · AGENTS.md' },
      'project-local': { zh: '项目本地 · AGENTS.local.md', en: 'Project local · AGENTS.local.md' },
    }

    function ruleLabel(id, lang) {
      const entry = RULE_LABELS[id]
      return entry ? (lang === 'zh' ? entry.zh : entry.en) : id
    }

    function rootLabel(id, lang) {
      const entry = ROOTS[id]
      if (!entry) return id
      return lang === 'zh' ? entry.zh : entry.en
    }

    function shortPath(path) {
      return typeof path === 'string' ? path.replace(/^\/Users\/[^/]+/, '~') : ''
    }

    // -------------------------------------------------------------------------
    // Skill usage per conversation
    // -------------------------------------------------------------------------

    const EMPTY_USAGE = { names: [], byTurn: new Map(), byMessage: new Map(), total: 0 }

    /** Resolve the session the main conversation area currently renders. */
    function resolveSessionId(ctx) {
      try {
        const id = ctx.get('uiSession')?.adapter?.current?.getSnapshot?.()?.key
        if (typeof id === 'string' && id !== '') return id
      } catch {
        // Fall through to the next source.
      }
      try {
        const id = ctx.get('uiWorkspace')?.mainReference?.sessionId
        if (typeof id === 'string' && id !== '') return id
      } catch {
        // Fall through to the next source.
      }
      try {
        const byId = ctx.get('sessions')?.list?.getSnapshot?.()?.byId ?? {}
        for (const entry of Object.values(byId)) {
          if ((entry?.retainedBy?.mainView ?? 0) > 0) return entry.id
        }
      } catch {
        // Fall through to no session.
      }
      return undefined
    }

    /** Session events currently resident in the client event window. */
    function sessionEntries(ctx, sessionId) {
      try {
        const entries = ctx.get('sessions')?.binding?.(sessionId)?.eventSource?.getSnapshot?.()?.entries
        return Array.isArray(entries) ? entries : []
      } catch {
        return []
      }
    }

    /**
     * Fold durable session events into per-turn and per-conversation skill usage.
     * Two representations carry a used skill: the `skill` tool call (model-invoked)
     * and a `skill-invocation` user message (a `/name` gesture). A `skill-catalog`
     * message lists availability, not usage, so it is ignored.
     *
     * The client event window stores `{ event, ... }` records, so every read
     * unwraps `entry.event`; a bare event stays readable for direct callers.
     */
    function collectUsage(entries) {
      const events = []
      for (const entry of entries) {
        const event = entry?.event ?? entry
        if (event !== undefined && event !== null) events.push(event)
      }
      const byTurn = new Map()
      const byMessage = new Map()
      const order = []
      const counts = new Map()
      const starts = []
      for (const event of events) {
        if (event.type === 'turn/start' && typeof event.data?.turn === 'number') {
          starts.push({ turn: event.data.turn, seq: typeof event.seq === 'number' ? event.seq : 0 })
        }
      }
      const turnAt = (seq) => {
        let found
        for (const item of starts) {
          if (item.seq <= (typeof seq === 'number' ? seq : 0)) found = item.turn
          else break
        }
        return found
      }
      const record = (name, turn) => {
        if (typeof name !== 'string' || name === '') return
        if (typeof turn === 'number') {
          const list = byTurn.get(turn)
          if (list === undefined) byTurn.set(turn, [name])
          else if (!list.includes(name)) list.push(name)
        }
        if (!counts.has(name)) order.push(name)
        counts.set(name, (counts.get(name) ?? 0) + 1)
      }
      for (const event of events) {
        if (event.type === 'assistant/message') {
          const id = event.data?.message?.id
          if (typeof id === 'string' && typeof event.data?.turn === 'number') byMessage.set(id, event.data.turn)
        } else if (event.type === 'tool/call' && event.data?.name === 'skill') {
          let name
          try {
            name = JSON.parse(event.data.arguments ?? '{}')?.name
          } catch {
            name = undefined
          }
          record(name, event.data?.turn)
        } else if (event.type === 'user/message' && event.data?.source?.kind === 'skill-invocation') {
          record(event.data.source.name, turnAt(event.seq))
        }
      }
      return {
        names: order.map((name) => ({ name, uses: counts.get(name) ?? 1 })),
        byTurn,
        byMessage,
        total: order.length,
      }
    }

    /** Poll the resident event window; changed events replace the folded usage. */
    function useSkillUsage(ctx) {
      const [usage, setUsage] = useState(EMPTY_USAGE)
      useEffect(() => {
        let alive = true
        let signature = ''
        const read = () => {
          if (!alive) return
          const sessionId = resolveSessionId(ctx)
          const entries = sessionId === undefined ? [] : sessionEntries(ctx, sessionId)
          const last = entries[entries.length - 1]
          const tail = last === undefined ? 0 : last.event?.seq ?? last.seq ?? 0
          const next = `${sessionId ?? ''}:${entries.length}:${tail}`
          if (next === signature) return
          signature = next
          setUsage(collectUsage(entries))
        }
        read()
        const timer = setInterval(read, 800)
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [ctx])
      return usage
    }

    const DOCK_ICON = h(
      'svg',
      {
        viewBox: '0 0 16 16',
        width: 15,
        height: 15,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      },
      h('path', { d: 'M6.1 2.1 7.3 5.2 10.4 6.4 7.3 7.6 6.1 10.7 4.9 7.6 1.8 6.4 4.9 5.2Z' }),
      h('path', { d: 'M12.2 9.2 12.8 10.7 14.3 11.3 12.8 11.9 12.2 13.4 11.6 11.9 10.1 11.3 11.6 10.7Z' }),
    )

    const MANAGE_ICON = h(
      'svg',
      {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        'aria-hidden': true,
      },
      h('path', { d: 'M2.8 5h10.4M2.8 8h10.4M2.8 11h10.4' }),
      h('circle', { cx: 6, cy: 5, r: 1.4, fill: 'currentColor', stroke: 'none' }),
      h('circle', { cx: 10.2, cy: 8, r: 1.4, fill: 'currentColor', stroke: 'none' }),
      h('circle', { cx: 5.4, cy: 11, r: 1.4, fill: 'currentColor', stroke: 'none' }),
    )

    /** The shell's own close glyph, so the panel header matches Settings. */
    const CLOSE_ICON = typeof primitives.IconCloseOutlineRegular === 'function' ? primitives.IconCloseOutlineRegular : null

    /**
     * Composer-dock entry: one icon that opens a menu of the skills this
     * conversation used, with the panel launcher as the last row.
     */
    function SkillMenuDock({ ctx, pluginCtx }) {
      const bridge = pluginCtx ?? ctx
      const t = useText(bridge)

      const usage = useSkillUsage(bridge)
      const [open, setOpen] = useState(false)
      const [panelOpen, setPanelOpen] = useState(false)
      const rootRef = useRef(null)
      const menuRef = useRef(null)
      const position = useAnchoredPosition({ open, anchorRef: rootRef, panelRef: menuRef, side: 'top', gap: 8, margin: 12 })
      useDismissOnOutsidePointer(rootRef, open, setOpen, menuRef)

      useEffect(() => {
        if (!open) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
      }, [open])

      const items = usage.names
      const content = []
      if (items.length > 0) {
        content.push(h('div', { key: 'head', className: 'sm-menu-head' }, t('menuTitle')))
        content.push(
          h(
            'div',
            { key: 'list', className: 'sm-menu-list' },
            ...items.map((item) =>
              h(
                'div',
                { key: item.name, className: 'sm-menu-item' },
                h('span', { className: 'sm-menu-name', title: item.name }, item.name),
                item.uses > 1 ? h('span', { className: 'sm-menu-count' }, `×${item.uses}`) : null,
              ),
            ),
          ),
        )
        content.push(h('div', { key: 'sep', className: 'sm-menu-sep' }))
      }
      content.push(
        h(
          'button',
          {
            key: 'manage',
            type: 'button',
            className: 'sm-menu-manage',
            onClick: () => {
              setOpen(false)
              setPanelOpen(true)
            },
          },
          h('span', { className: 'sm-menu-glyph' }, MANAGE_ICON),
          t('manage'),
        ),
      )

      let menu = null
      if (open) {
        const node = h(
          'div',
          {
            ref: menuRef,
            className: 'sm-menu',
            role: 'dialog',
            'aria-label': t('menuTitle'),
            style: position ?? { position: 'absolute', bottom: 'calc(100% + 8px)', left: 0 },
          },
          ...content,
        )
        menu = createPortal === undefined ? node : createPortal(node, document.body)
      }

      const panel = panelOpen ? h(SkillManagerPanel, { ctx: bridge, onClose: () => setPanelOpen(false) }) : null

      return h(
        'div',
        { ref: rootRef, className: 'sm-dock' },
        h(
          'button',
          {
            type: 'button',
            className: 'sm-icon',
            title: t('dockTitle'),
            'aria-label': t('dockTitle'),
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            onClick: () => setOpen(!open),
          },
          DOCK_ICON,
        ),
        menu,
        h('style', null, CSS),
        panel === null ? null : createPortal === undefined ? panel : createPortal(panel, document.body),
      )
    }

    /**
     * Turn footer entry: one icon with this turn's skill count; clicking opens
     * the turn's skill names, so a turn with many skills costs one button width.
     */
    function TurnSkillBadges({ ctx, pluginCtx, messageId }) {
      const bridge = pluginCtx ?? ctx
      const t = useText(bridge)
      const usage = useSkillUsage(bridge)
      const rootRef = useRef(null)
      const menuRef = useRef(null)
      const [open, setOpen] = useState(false)
      const position = useAnchoredPosition({ open, anchorRef: rootRef, panelRef: menuRef, side: 'top', gap: 8, margin: 12 })
      useDismissOnOutsidePointer(rootRef, open, setOpen, menuRef)

      useEffect(() => {
        if (!open) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
      }, [open])

      const turn = typeof messageId === 'string' ? usage.byMessage.get(messageId) : undefined
      const names = typeof turn === 'number' ? usage.byTurn.get(turn) : undefined
      if (names === undefined || names.length === 0) return null

      let menu = null
      if (open) {
        const node = h(
          'div',
          {
            ref: menuRef,
            className: 'sm-menu',
            role: 'dialog',
            'aria-label': t('turnSkills'),
            style: position ?? { position: 'absolute', bottom: 'calc(100% + 8px)', left: 0 },
          },
          h('div', { className: 'sm-menu-head' }, t('turnSkills')),
          h(
            'div',
            { className: 'sm-menu-list' },
            ...names.map((name) => h('div', { key: name, className: 'sm-menu-item' }, h('span', { className: 'sm-menu-name' }, name))),
          ),
        )
        menu = createPortal === undefined ? node : createPortal(node, document.body)
      }

      return h(
        'span',
        { ref: rootRef, className: 'sm-turn' },
        h(
          'button',
          {
            type: 'button',
            className: 'sm-turn-trigger',
            title: names.join(', '),
            'aria-label': `${t('turnSkills')}: ${names.join(', ')}`,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            onClick: () => setOpen(!open),
          },
          DOCK_ICON,
          h('span', { className: 'sm-turn-count' }, String(names.length)),
        ),
        menu,
      )
    }

    function SkillManagerPanel({ ctx, onClose }) {
      const locale = (() => {
        try {
          return ctx.get('locale')
        } catch {
          return undefined
        }
      })()
      const [lang, setLang] = useState(() => localeId(locale))
      useEffect(() => {
        if (!locale?.subscribe) return undefined
        const read = () => setLang(localeId(locale))
        read()
        return locale.subscribe(read)
      }, [locale])
      const t = (key) => (TEXT[lang === 'zh' ? 'zh' : 'en'][key] ?? key)

      const [open] = useState(true)
      const [data, setData] = useState(null)
      const [selected, setSelected] = useState(null)
      const [draft, setDraft] = useState(null)
      const [query, setQuery] = useState('')
      const [scope, setScope] = useState('all')
      const [busy, setBusy] = useState(false)
      const [status, setStatus] = useState('')
      const [statusKind, setStatusKind] = useState('idle')
      const [armed, setArmed] = useState(false)
      const [creating, setCreating] = useState(false)
      const [form, setForm] = useState({ name: '', description: '', rootId: 'user-dsh' })
      const [formError, setFormError] = useState('')
      const [tab, setTab] = useState('skills')
      const [rules, setRules] = useState(null)
      const [rule, setRule] = useState(null)
      const [ruleText, setRuleText] = useState('')
      const [ruleStatus, setRuleStatus] = useState('')
      const [ruleKind, setRuleKind] = useState('idle')
      const [ruleArmed, setRuleArmed] = useState(false)

      const call = useCallback(async (endpoint, payload) => {
        const response = await fetch(`${CHANNEL}/${endpoint}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload ?? {}),
        })
        const body = await response.json().catch(() => null)
        if (body && body.ok === true) return body.value
        throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
      }, [])

      const applySkill = (skill) => {
        setSelected(skill)
        setDraft({
          description: skill.description ?? '',
          whenToUse: skill.whenToUse ?? '',
          modelInvocable: skill.modelInvocable !== false,
          userInvocable: skill.userInvocable !== false,
          body: skill.body ?? '',
        })
        setArmed(false)
      }

      const openSkill = useCallback(
        async (path) => {
          const result = await call('read', { path })
          if (result?.skill) applySkill(result.skill)
        },
        [call],
      )

      const load = useCallback(async () => {
        const next = await call('list')
        setData(next)
        return next
      }, [call])

      useEffect(() => {
        if (!open) return
        let cancelled = false
        ;(async () => {
          try {
            setBusy(true)
            const next = await load()
            if (cancelled) return
            if (next.skills[0]) await openSkill(next.skills[0].path)
          } catch (error) {
            if (!cancelled) {
              setStatus(String(error?.message ?? error))
              setStatusKind('error')
            }
          } finally {
            if (!cancelled) setBusy(false)
          }
        })()
        return () => {
          cancelled = true
        }
      }, [open, load, openSkill])

      useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
          if (event.key !== 'Escape') return
          if (creating) setCreating(false)
          else onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [open, creating])

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return (data?.skills ?? []).filter((skill) => {
          if (scope !== 'all' && skill.scope !== scope) return false
          if (!needle) return true
          return skill.name.toLowerCase().includes(needle) || String(skill.description ?? '').toLowerCase().includes(needle)
        })
      }, [data, query, scope])

      const refresh = async () => {
        try {
          setBusy(true)
          const next = await call('list')
          setData(next)
          const path = selected?.path
          const stillThere = path ? next.skills.find((skill) => skill.path === path) : undefined
          if (stillThere) await openSkill(stillThere.path)
          else if (next.skills[0]) await openSkill(next.skills[0].path)
          setStatus('')
          setStatusKind('idle')
        } catch (error) {
          setStatus(String(error?.message ?? error))
          setStatusKind('error')
        } finally {
          setBusy(false)
        }
      }

      const save = async () => {
        if (!selected || !draft) return
        try {
          setBusy(true)
          const result = await call('save', { path: selected.path, ...draft })
          if (result?.skill) applySkill(result.skill)
          await load()
          setStatus(t('saved'))
          setStatusKind('ok')
        } catch (error) {
          setStatus(String(error?.message ?? error))
          setStatusKind('error')
        } finally {
          setBusy(false)
        }
      }

      const remove = async () => {
        if (!selected) return
        if (!armed) {
          setArmed(true)
          setStatus(t('confirmDelete'))
          setStatusKind('idle')
          return
        }
        try {
          setBusy(true)
          await call('remove', { path: selected.path })
          setSelected(null)
          setDraft(null)
          setArmed(false)
          const next = await load()
          if (next.skills[0]) await openSkill(next.skills[0].path)
          setStatus('')
        } catch (error) {
          setStatus(String(error?.message ?? error))
          setStatusKind('error')
        } finally {
          setBusy(false)
        }
      }

      const submit = async () => {
        const name = form.name.trim()
        if (!NAME_PATTERN.test(name)) {
          setFormError('名称需为 kebab-case（小写字母/数字/连字符）')
          return
        }
        if (!form.description.trim()) {
          setFormError('请填写触发说明')
          return
        }
        try {
          setBusy(true)
          setFormError('')
          const result = await call('create', {
            rootId: form.rootId,
            name,
            description: form.description.trim(),
            body: `# ${name}\n\n${form.description.trim()}\n\n## Instructions\n\n`,
          })
          setCreating(false)
          setForm({ name: '', description: '', rootId: 'user-dsh' })
          await load()
          if (result?.skill?.path) await openSkill(result.skill.path)
          setStatus(t('saved'))
          setStatusKind('ok')
        } catch (error) {
          setFormError(String(error?.message ?? error))
        } finally {
          setBusy(false)
        }
      }

      const openRule = useCallback(
        async (target) => {
          try {
            setBusy(true)
            setRuleArmed(false)
            setRuleStatus('')
            setRuleKind('idle')
            const result = await call('rules-read', { path: target.path })
            setRule(result.rule ?? target)
            setRuleText(result.content ?? '')
          } catch (error) {
            setRuleStatus(String(error?.message ?? error))
            setRuleKind('error')
          } finally {
            setBusy(false)
          }
        },
        [call],
      )

      const loadRules = useCallback(async () => {
        const result = await call('rules-list')
        setRules(result.rules ?? [])
        return result.rules ?? []
      }, [call])

      useEffect(() => {
        if (!open || tab !== 'rules' || rules !== null) return undefined
        let cancelled = false
        ;(async () => {
          try {
            setBusy(true)
            const list = await loadRules()
            if (cancelled) return
            const first = list.find((entry) => entry.exists) ?? list[0]
            if (first) await openRule(first)
          } catch (error) {
            if (!cancelled) {
              setRuleStatus(String(error?.message ?? error))
              setRuleKind('error')
            }
          } finally {
            if (!cancelled) setBusy(false)
          }
        })()
        return () => {
          cancelled = true
        }
      }, [open, tab, rules, loadRules, openRule])

      const saveRuleFile = useCallback(async () => {
        if (!rule) return
        try {
          setBusy(true)
          const result = await call('rules-save', { path: rule.path, content: ruleText })
          if (result?.rule) setRule(result.rule)
          await loadRules()
          setRuleStatus(`${t('saved')} · ${result?.rule?.bytes ?? ruleText.length} B · ${new Date().toLocaleTimeString()}`)
          setRuleKind('ok')
        } catch (error) {
          setRuleStatus(String(error?.message ?? error))
          setRuleKind('error')
        } finally {
          setBusy(false)
        }
      }, [rule, ruleText, call, loadRules, t])

      const deleteRuleFile = useCallback(async () => {
        if (!rule) return
        if (!ruleArmed) {
          setRuleArmed(true)
          setRuleStatus(t('confirmDelete'))
          setRuleKind('idle')
          return
        }
        try {
          setBusy(true)
          const result = await call('rules-remove', { path: rule.path })
          if (result?.rule) setRule(result.rule)
          setRuleArmed(false)
          setRuleText('')
          await loadRules()
          setRuleStatus('')
          setRuleKind('idle')
        } catch (error) {
          setRuleStatus(String(error?.message ?? error))
          setRuleKind('error')
        } finally {
          setBusy(false)
        }
      }, [rule, ruleArmed, call, loadRules, t])

      // Host sorts skills by name, so roots interleave. Sorting by root first keeps
      // one group per root: grouping consecutive runs alone would repeat the header
      // (and its React key) before every row.
      const rootIndex = new Map((data?.roots ?? []).map((root, index) => [root.id, index]))
      const rootRank = (id) => rootIndex.get(id) ?? rootIndex.size
      const groups = []
      for (const skill of [...filtered].sort((a, b) => rootRank(a.rootId) - rootRank(b.rootId))) {
        const last = groups[groups.length - 1]
        if (last && last.rootId === skill.rootId) last.items.push(skill)
        else groups.push({ rootId: skill.rootId, label: rootLabel(skill.rootId, lang), items: [skill] })
      }

      const skillsPanel = [
          h('div', { className: 'sm-toolbar' },
            h('input', { className: 'sm-input', placeholder: t('search'), value: query, onChange: (e) => setQuery(e.target.value) }),
            h('button', { type: 'button', className: 'sm-btn', 'data-on': scope === 'all' ? '1' : '0', onClick: () => setScope('all') }, t('all')),
            h('button', { type: 'button', className: 'sm-btn', 'data-on': scope === 'user' ? '1' : '0', onClick: () => setScope('user') }, t('user')),
            h('button', { type: 'button', className: 'sm-btn', 'data-on': scope === 'project' ? '1' : '0', onClick: () => setScope('project') }, t('project')),
          ),
          h('div', { className: 'sm-main' },
            h('div', { className: 'sm-list' },
              groups.length === 0 ? h('span', { className: 'sm-status' }, t('empty')) : null,
              ...groups.flatMap((group) => [
                h('div', { key: `g-${group.rootId}`, className: 'sm-group' }, group.label),
                ...group.items.map((skill) =>
                  h('button', {
                    key: skill.path,
                    type: 'button',
                    className: 'sm-row',
                    'data-on': selected?.path === skill.path ? '1' : '0',
                    onClick: () => openSkill(skill.path).catch((error) => { setStatus(String(error.message)); setStatusKind('error') }),
                  },
                    h('b', null, skill.name + (skill.valid ? '' : ' ⚠')),
                    h('i', null, skill.description || '—'),
                  ),
                ),
              ]),
            ),
            selected && draft
              ? h('div', { className: 'sm-detail' },
                  h('div', null, h('div', { className: 'sm-path', title: selected.path }, shortPath(selected.path))),
                  h('label', { className: 'sm-label' }, t('description')),
                  h('textarea', { className: 'sm-area', rows: 3, value: draft.description, onChange: (e) => setDraft({ ...draft, description: e.target.value }) }),
                  h('label', { className: 'sm-label' }, t('whenToUse')),
                  h('input', { className: 'sm-input', value: draft.whenToUse, onChange: (e) => setDraft({ ...draft, whenToUse: e.target.value }) }),
                  h('div', { className: 'sm-check' },
                    h('button', { type: 'button', role: 'switch', 'aria-checked': draft.modelInvocable ? 'true' : 'false', onClick: () => setDraft({ ...draft, modelInvocable: !draft.modelInvocable }) }),
                    h('span', null, t('modelOn')),
                  ),
                  h('div', { className: 'sm-check' },
                    h('button', { type: 'button', role: 'switch', 'aria-checked': draft.userInvocable ? 'true' : 'false', onClick: () => setDraft({ ...draft, userInvocable: !draft.userInvocable }) }),
                    h('span', null, t('userOn')),
                  ),
                  h('label', { className: 'sm-label' }, t('body')),
                  h('textarea', { className: 'sm-area sm-code', value: draft.body, spellCheck: false, onChange: (e) => setDraft({ ...draft, body: e.target.value }) }),
                  h('div', null,
                    h('button', { type: 'button', className: 'sm-btn sm-danger', disabled: busy, onClick: remove }, armed ? t('confirmDelete') : t('delete')),
                    ' ',
                    h('button', { type: 'button', className: 'sm-btn sm-primary', disabled: busy, onClick: save }, busy ? t('saving') : t('save')),
                  ),
                  h('div', { className: 'sm-status', 'data-k': statusKind }, status),
                )
              : h('div', { className: 'sm-detail' }, h('span', { className: 'sm-status' }, t('pick'))),
          ),
      ]
      const rulesPanel = [
        h('div', { className: 'sm-main' },
          h('div', { className: 'sm-list' },
            (rules ?? []).length === 0 ? h('span', { className: 'sm-status' }, '') : null,
            ...(rules ?? []).map((entry) =>
              h('button', {
                key: entry.id,
                type: 'button',
                className: 'sm-row',
                'data-on': rule?.path === entry.path ? '1' : '0',
                onClick: () => openRule(entry),
              },
                h('b', null, ruleLabel(entry.id, lang) + (entry.exists ? '' : ` · ${t('ruleMissing')}`)),
                h('i', null, entry.exists ? `${entry.bytes} B` : shortPath(entry.path)),
              ),
            ),
          ),
          rule
            ? h('div', { className: 'sm-detail' },
                h('div', { className: 'sm-path', title: rule.path }, shortPath(rule.path)),
                h('div', { className: 'sm-status' }, t('ruleHint')),
                h('textarea', {
                  className: 'sm-area sm-code',
                  value: ruleText,
                  spellCheck: false,
                  placeholder: '# 规则\n\n- ...',
                  onChange: (event) => setRuleText(event.target.value),
                }),
                h('div', null,
                  h('button', { type: 'button', className: 'sm-btn sm-primary', disabled: busy, onClick: saveRuleFile },
                    busy ? t('saving') : t('save')),
                  ' ',
                  h('button', { type: 'button', className: 'sm-btn sm-danger', disabled: busy, onClick: deleteRuleFile },
                    ruleArmed ? t('confirmDelete') : t('deleteRule')),
                ),
                h('div', { className: 'sm-status', 'data-k': ruleKind }, ruleStatus),
              )
            : h('div', { className: 'sm-detail' }, h('span', { className: 'sm-status' }, t('pick'))),
        ),
      ]
      const panel = tab === 'skills' ? skillsPanel : rulesPanel

      return h(
        'div',
        { className: 'sm-backdrop', onMouseDown: (event) => event.target === event.currentTarget && onClose() },
        h('style', null, CSS),
        h(
          'div',
          { className: 'sm-dialog', role: 'dialog', 'aria-modal': 'true' },
          h(
            'div',
            { className: 'sm-head' },
            h('h3', null, t('title')),
            h('div', { className: 'sm-head-actions' },
              h('button', { type: 'button', className: 'sm-btn', disabled: busy, onClick: refresh }, t('refresh')),
              h('button', { type: 'button', className: 'sm-btn sm-primary', onClick: () => setCreating(true) }, `＋ ${t('newSkill')}`),
              h(
                'button',
                { type: 'button', className: 'sm-close', title: t('close'), 'aria-label': t('close'), onClick: () => onClose() },
                CLOSE_ICON === null ? '×' : h(CLOSE_ICON, { size: 14 }),
              ),
            ),
          ),
          h('div', { className: 'sm-toolbar' },
            h('button', { type: 'button', className: 'sm-btn', 'data-on': tab === 'skills' ? '1' : '0', onClick: () => setTab('skills') }, t('tabSkills')),
            h('button', { type: 'button', className: 'sm-btn', 'data-on': tab === 'rules' ? '1' : '0', onClick: () => setTab('rules') }, t('tabRules')),
          ),
          ...panel,
          h('div', { className: 'sm-foot' },
            (data?.roots ?? []).map((root) => h('span', { key: root.id }, `${shortPath(root.path)}  `)),
          ),
        ),
        creating
          ? h('div', { className: 'sm-form', onMouseDown: (event) => event.target === event.currentTarget && setCreating(false) },
              h('div', { className: 'sm-card' },
                h('h4', null, t('newSkill')),
                h('label', { className: 'sm-label' }, t('name')),
                h('input', { className: 'sm-input', placeholder: 'my-skill', value: form.name, onChange: (e) => { setForm({ ...form, name: e.target.value }); setFormError('') } }),
                h('label', { className: 'sm-label' }, t('description')),
                h('textarea', { className: 'sm-area', rows: 3, value: form.description, onChange: (e) => { setForm({ ...form, description: e.target.value }); setFormError('') } }),
                h('label', { className: 'sm-label' }, t('location')),
                h('select', { className: 'sm-input', value: form.rootId, onChange: (e) => setForm({ ...form, rootId: e.target.value }) },
                  ...(data?.roots ?? []).map((root) => h('option', { key: root.id, value: root.id }, rootLabel(root.id, lang)))),
                formError ? h('div', { className: 'sm-status', 'data-k': 'error' }, formError) : null,
                h('div', { className: 'sm-head-actions' },
                  h('button', { type: 'button', className: 'sm-btn', onClick: () => setCreating(false) }, t('cancel')),
                  h('button', { type: 'button', className: 'sm-btn sm-primary', disabled: busy, onClick: submit }, busy ? t('creating') : t('create')),
                ),
              ))
          : null,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            { name: 'conversation.composer.dock', id: 'dsh-skill-manager', order: 6, inject: () => ({ pluginCtx: ctx }) },
            SkillMenuDock,
          ),
        )
        ctx.slots.inject('conversation.chat.assistant-actions', () =>
          ctx.slots.register(
            { name: 'conversation.chat.assistant-actions', id: 'dsh-skill-manager-turn', order: 6, inject: () => ({ pluginCtx: ctx }) },
            TurnSkillBadges,
          ),
        )
      },
    }
  },
})
