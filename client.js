window.__ModuleLoader__.load({
  id: '@limalivy/dsh-skill-manager',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useMemo, useState } = React
    const h = React.createElement

    const CHANNEL = '/skill-manager'
    const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

    const TEXT = {
      zh: {
        open: '技能管理',
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
      },
      en: {
        open: 'Skill Manager',
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
      },
    }

    const ROOTS = {
      'user-dsh': { zh: '用户 · ~/.dsh/skills', en: 'User · ~/.dsh/skills' },
      'user-agents': { zh: '用户 · ~/.agents/skills', en: 'User · ~/.agents/skills' },
      'project-dsh': { zh: '项目 · .dsh/skills', en: 'Project · .dsh/skills' },
      'project-agents': { zh: '项目 · .agents/skills', en: 'Project · .agents/skills' },
    }

    const CSS = `
.sm-bar { display:flex; align-items:center; gap:8px; padding:4px 2px; }
.sm-bar button { height:26px; padding:0 10px; border-radius:7px; border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; cursor:pointer;
  flex:none; white-space:nowrap; }
.sm-backdrop { position:fixed; inset:0; z-index:80; display:flex; align-items:center; justify-content:center;
  padding:28px; background:rgba(0,0,0,.38); }
.sm-dialog { width:min(1040px,96vw); height:min(800px,92vh); display:flex; flex-direction:column; gap:10px;
  padding:16px 18px; border-radius:14px; border:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); box-shadow:0 24px 64px rgba(0,0,0,.32); }
.sm-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.sm-head h3 { margin:0; font-size:15px; font-weight:600; }
.sm-head-actions { display:flex; gap:8px; }
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

    function SkillManager({ ctx }) {
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

      const [open, setOpen] = useState(false)
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
          else setOpen(false)
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

      if (!open) {
        return h(
          'div',
          { className: 'sm-bar' },
          h('button', { type: 'button', onClick: () => setOpen(true) }, `＋ ${t('open')}`),
          h('style', null, CSS),
        )
      }

      const groups = []
      for (const skill of filtered) {
        const label = rootLabel(skill.rootId, lang)
        const last = groups[groups.length - 1]
        if (last && last.label === label) last.items.push(skill)
        else groups.push({ label, items: [skill] })
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
                h('div', { key: `g-${group.label}`, className: 'sm-group' }, group.label),
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
        { className: 'sm-backdrop', onMouseDown: (event) => event.target === event.currentTarget && setOpen(false) },
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
              h('button', { type: 'button', className: 'sm-btn', onClick: () => setOpen(false) }, t('close')),
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
          ctx.slots.register({ name: 'conversation.composer.dock', id: 'dsh-skill-manager', order: 6 }, SkillManager),
        )
      },
    }
  },
})
