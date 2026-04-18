'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ClipboardCheck, Plus, Check, X, Minus } from 'lucide-react'
import type { QcChecklist } from '@/types/database'

type QcItem = {
  id: string
  label: string
  passed: boolean
  notes?: string
  category?: string
  result?: 'pass' | 'fail' | 'na' | 'pending'
}

type QcChecklistFull = Omit<QcChecklist, 'items'> & {
  items: QcItem[]
}

type QcTemplate = {
  id: string
  key: string
  name: string
  kind: 'install' | 'field'
  items: Array<{ category: string; description: string }>
  item_count: number
}

interface Props {
  projectId: string
  onCountChange?: (total: number) => void
}

export function QcPanel({ projectId, onCountChange }: Props) {
  const [checklists, setChecklists] = useState<QcChecklistFull[]>([])
  const [templates, setTemplates] = useState<QcTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [picker, setPicker] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const [mutating, setMutating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [cRes, tRes] = await Promise.all([
      fetch(`/api/org/projects/${projectId}/qc`),
      fetch('/api/org/qc-templates'),
    ])
    if (cRes.ok) {
      const data: QcChecklistFull[] = await cRes.json()
      setChecklists(data)
      onCountChange?.(data.length)
    }
    if (tRes.ok) setTemplates(await tRes.json())
    setLoading(false)
  }, [projectId, onCountChange])

  useEffect(() => { load() }, [load])

  const spawnFromTemplate = async (tpl: QcTemplate) => {
    setMutating('spawn')
    const items = tpl.items.map((it, idx) => ({
      id: `itm_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      label: it.description,
      category: it.category,
      passed: false,
      result: 'pending' as const,
    }))
    const res = await fetch(`/api/org/projects/${projectId}/qc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'in_progress',
        area_name: tpl.name,
        items,
        corrective_actions: [],
      }),
    })
    if (res.ok) {
      const created: QcChecklistFull = await res.json()
      setChecklists((prev) => [created, ...prev])
      setActive(created.id)
      setPicker(false)
    }
    setMutating(null)
  }

  const setResult = async (checklist: QcChecklistFull, itemId: string, result: 'pass' | 'fail' | 'na') => {
    if (mutating) return
    setMutating(itemId)
    const items = checklist.items.map((it) =>
      it.id === itemId
        ? { ...it, result, passed: result === 'pass' }
        : it,
    )
    const res = await fetch(`/api/org/projects/${projectId}/qc?qc_id=${checklist.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (res.ok) {
      const updated: QcChecklistFull = await res.json()
      setChecklists((prev) => prev.map((c) => (c.id === checklist.id ? updated : c)))
    }
    setMutating(null)
  }

  const stats = useMemo(() => {
    return checklists.map((c) => {
      const total = c.items.length
      const pass = c.items.filter((i) => i.result === 'pass').length
      const fail = c.items.filter((i) => i.result === 'fail').length
      const na   = c.items.filter((i) => i.result === 'na').length
      const pending = total - pass - fail - na
      return { id: c.id, total, pass, fail, na, pending }
    })
  }, [checklists])

  if (loading) {
    return <div className="flex h-48 items-center justify-center text-sm text-neutral-400">Loading…</div>
  }

  const activeChecklist = checklists.find((c) => c.id === active)

  if (activeChecklist) {
    const stat = stats.find((s) => s.id === activeChecklist.id)!
    const byCategory = activeChecklist.items.reduce<Record<string, QcItem[]>>((acc, item) => {
      const cat = item.category || 'General'
      ;(acc[cat] ||= []).push(item)
      return acc
    }, {})

    return (
      <div className="pb-24">
        <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setActive(null)}
              className="text-xs font-semibold text-blue-600"
            >
              ← All checklists
            </button>
            <div className="flex gap-3 text-[11px] font-semibold">
              <span className="text-emerald-600">{stat.pass} pass</span>
              <span className="text-red-600">{stat.fail} fail</span>
              <span className="text-neutral-400">{stat.pending + stat.na} pend</span>
            </div>
          </div>
          <div className="mt-1.5 text-sm font-semibold text-neutral-900">{activeChecklist.area_name}</div>
        </div>

        <div className="space-y-4 p-4">
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat}>
              <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{cat}</div>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
                    <div className="text-sm leading-snug text-neutral-900">{item.label}</div>
                    <div className="mt-2.5 flex gap-1.5">
                      <ResultBtn
                        label="Pass"
                        active={item.result === 'pass'}
                        tone="pass"
                        icon={Check}
                        onClick={() => setResult(activeChecklist, item.id, 'pass')}
                      />
                      <ResultBtn
                        label="Fail"
                        active={item.result === 'fail'}
                        tone="fail"
                        icon={X}
                        onClick={() => setResult(activeChecklist, item.id, 'fail')}
                      />
                      <ResultBtn
                        label="N/A"
                        active={item.result === 'na'}
                        tone="na"
                        icon={Minus}
                        onClick={() => setResult(activeChecklist, item.id, 'na')}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24">
      {picker ? (
        <TemplatePicker
          templates={templates}
          onSelect={spawnFromTemplate}
          onCancel={() => setPicker(false)}
          busy={mutating === 'spawn'}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 py-4 text-sm font-semibold text-blue-700 active:bg-blue-100"
        >
          <Plus className="h-4 w-4" />
          Start QC from template
        </button>
      )}

      <div className="mt-4 space-y-2">
        {checklists.length === 0 && !picker && (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-10 text-center">
            <ClipboardCheck className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm text-neutral-500">No QC checklists yet</p>
          </div>
        )}
        {checklists.map((c) => {
          const s = stats.find((x) => x.id === c.id)!
          const pct = s.total === 0 ? 0 : Math.round(((s.pass + s.fail + s.na) / s.total) * 100)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              className="w-full rounded-xl border border-neutral-200 bg-white p-4 text-left active:bg-neutral-50"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm text-neutral-900">{c.area_name ?? 'Checklist'}</div>
                <StatusPill status={c.status} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-500">
                <span className="text-emerald-600 font-semibold">{s.pass} pass</span>
                {s.fail > 0 && <span className="text-red-600 font-semibold">{s.fail} fail</span>}
                <span>{s.total} items</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TemplatePicker({
  templates, onSelect, onCancel, busy,
}: {
  templates: QcTemplate[]
  onSelect: (t: QcTemplate) => void
  onCancel: () => void
  busy: boolean
}) {
  const [kind, setKind] = useState<'install' | 'field'>('install')
  const filtered = templates.filter((t) => t.kind === kind)
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div className="text-sm font-semibold">Choose a template</div>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-neutral-500">Cancel</button>
      </div>
      <div className="flex gap-1.5 p-3">
        <button
          type="button"
          onClick={() => setKind('install')}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${kind === 'install' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
        >
          Installation
        </button>
        <button
          type="button"
          onClick={() => setKind('field')}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${kind === 'field' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
        >
          Field
        </button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-neutral-400">No templates in this category</div>
        )}
        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            disabled={busy}
            className="flex w-full items-center justify-between border-t border-neutral-100 px-4 py-3 text-left active:bg-neutral-50 disabled:opacity-50"
          >
            <div>
              <div className="text-sm font-medium text-neutral-900">{t.name}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500">{t.item_count} items</div>
            </div>
            <Plus className="h-4 w-4 text-blue-600" />
          </button>
        ))}
      </div>
    </div>
  )
}

function ResultBtn({
  label, active, tone, icon: Icon, onClick,
}: {
  label: string
  active: boolean
  tone: 'pass' | 'fail' | 'na'
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  onClick: () => void
}) {
  const activeCls = {
    pass: 'border-emerald-500 bg-emerald-500 text-white',
    fail: 'border-red-500 bg-red-500 text-white',
    na:   'border-amber-400 bg-amber-400 text-white',
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold transition ${
        active ? activeCls : 'border-neutral-200 bg-white text-neutral-500'
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      {label}
    </button>
  )
}

function StatusPill({ status }: { status: QcChecklist['status'] }) {
  const cls = {
    draft:        'bg-neutral-100 text-neutral-600',
    in_progress:  'bg-blue-100 text-blue-700',
    submitted:    'bg-amber-100 text-amber-700',
    approved:     'bg-emerald-100 text-emerald-700',
    failed:       'bg-red-100 text-red-700',
  }[status] ?? 'bg-neutral-100 text-neutral-600'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
