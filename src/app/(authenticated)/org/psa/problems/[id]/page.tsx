'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Clock, X, Plus, FileText } from 'lucide-react'
import type {
  PsaProblem, PsaProblemStatus, PsaFiveWhysEntry, PsaFishboneData,
  PsaProblemStatusLog, PsaRcaMethod,
} from '@/types/database'
import { PSA_PROBLEM_STATUS_TRANSITIONS } from '@/types/database'

type ProblemDetail = PsaProblem & {
  customer?: { id: string; name: string } | null
  assignee?: { id: string; first_name: string | null; last_name: string | null; email: string } | null
  linked_tickets: Array<{
    id: string
    ticket_id: string
    ticket?: { id: string; ticket_number: string; title: string; status: string; priority: string; created_at: string } | null
  }>
  status_log: (PsaProblemStatusLog & { changed_by_user?: { id: string; first_name: string | null; last_name: string | null } | null })[]
}

const STATUS_COLORS: Record<PsaProblemStatus, string> = {
  NEW:                   'bg-blue-100 text-blue-700',
  UNDER_INVESTIGATION:   'bg-amber-100 text-amber-700',
  ROOT_CAUSE_IDENTIFIED: 'bg-purple-100 text-purple-700',
  WORKAROUND_AVAILABLE:  'bg-cyan-100 text-cyan-700',
  RESOLVED:              'bg-emerald-100 text-emerald-700',
  CLOSED:                'bg-neutral-100 text-neutral-600',
}

const FISHBONE_CATEGORIES: Array<keyof PsaFishboneData> = [
  'people', 'process', 'equipment', 'environment', 'materials', 'measurement'
]

export default function ProblemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [problem, setProblem] = useState<ProblemDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/psa/problems/${id}`)
    if (res.ok) setProblem(await res.json())
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function patch(update: Record<string, unknown>) {
    const res = await fetch(`/api/org/psa/problems/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    if (res.ok) load()
    return res.ok
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-neutral-500">
        <Clock className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="p-6">
        <div className="text-red-600">Problem not found</div>
        <Link href="/org/psa/problems" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          ← Back to problems
        </Link>
      </div>
    )
  }

  const validTransitions = PSA_PROBLEM_STATUS_TRANSITIONS[problem.status] ?? []

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Link href="/org/psa/problems" className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to problems
      </Link>

      {/* Header */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="font-mono text-sm text-neutral-500">{problem.problem_number}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[problem.status]}`}>
                {problem.status}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-neutral-100 text-neutral-600">
                {problem.problem_type}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900">{problem.title}</h1>
            {problem.description && (
              <p className="mt-2 text-sm text-neutral-600 whitespace-pre-wrap">{problem.description}</p>
            )}
          </div>
        </div>

        {/* Transitions */}
        {validTransitions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <div className="text-xs font-medium text-neutral-500 mb-2">TRANSITION TO</div>
            <div className="flex flex-wrap gap-2">
              {validTransitions.map(s => (
                <button
                  key={s}
                  onClick={() => patch({ status: s })}
                  className={`px-3 py-1.5 rounded text-xs font-medium border border-neutral-200 hover:border-neutral-400 transition ${STATUS_COLORS[s]}`}
                >
                  → {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Linked tickets */}
      <Card title={`Linked Incidents (${problem.linked_tickets.length})`}>
        {problem.linked_tickets.length === 0 ? (
          <div className="text-xs text-neutral-400 py-3">No tickets linked.</div>
        ) : (
          <div className="space-y-1">
            {problem.linked_tickets.map(lt => (
              lt.ticket && (
                <Link
                  key={lt.id}
                  href={`/org/psa/tickets/${lt.ticket.id}`}
                  className="block p-2 rounded hover:bg-neutral-50 border border-transparent hover:border-neutral-200 text-sm"
                >
                  <span className="font-mono text-xs text-neutral-500 mr-2">{lt.ticket.ticket_number}</span>
                  <span className="font-medium">{lt.ticket.title}</span>
                  <span className="ml-2 text-xs text-neutral-400">{lt.ticket.status}</span>
                </Link>
              )
            ))}
          </div>
        )}
      </Card>

      {/* Root Cause Analysis */}
      <RcaEditor problem={problem} onSave={patch} />

      {/* Resolution fields */}
      <Card title="Root Cause + Fix">
        <div className="space-y-3">
          <TextField
            label="Root Cause"
            value={problem.root_cause ?? ''}
            onSave={v => patch({ root_cause: v })}
            multiline
          />
          <TextField
            label="Workaround"
            value={problem.workaround ?? ''}
            onSave={v => patch({ workaround: v })}
            multiline
          />
          <TextField
            label="Permanent Fix"
            value={problem.permanent_fix ?? ''}
            onSave={v => patch({ permanent_fix: v })}
            multiline
          />
        </div>
      </Card>

      {/* Activity */}
      <Card title="Activity">
        {problem.status_log.length === 0 ? (
          <div className="text-xs text-neutral-400 py-3">No activity.</div>
        ) : (
          <div className="space-y-2">
            {problem.status_log.map(e => (
              <div key={e.id} className="flex items-start gap-2 text-xs">
                <FileText className="w-3.5 h-3.5 text-neutral-400 mt-0.5" />
                <div className="flex-1">
                  <div>
                    <span className="text-neutral-500">{e.from_status ?? '—'} → </span>
                    <span className="font-medium">{e.to_status}</span>
                    {e.changed_by_user && (
                      <span className="text-neutral-500 ml-2">
                        by {`${e.changed_by_user.first_name ?? ''} ${e.changed_by_user.last_name ?? ''}`.trim()}
                      </span>
                    )}
                  </div>
                  {e.reason && <div className="text-neutral-600 mt-0.5">{e.reason}</div>}
                  <div className="text-neutral-400 mt-0.5">{new Date(e.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}

function TextField({ label, value, onSave, multiline }: {
  label: string; value: string; onSave: (v: string) => void; multiline?: boolean
}) {
  const [val, setVal] = useState(value)
  const [dirty, setDirty] = useState(false)

  useEffect(() => { setVal(value); setDirty(false) }, [value])

  return (
    <div>
      <label className="block text-[10px] font-medium text-neutral-500 uppercase mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={val}
          onChange={e => { setVal(e.target.value); setDirty(true) }}
          rows={3}
          className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
        />
      ) : (
        <input
          value={val}
          onChange={e => { setVal(e.target.value); setDirty(true) }}
          className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
        />
      )}
      {dirty && (
        <button
          onClick={() => { onSave(val); setDirty(false) }}
          className="mt-1 px-2.5 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
        >
          Save
        </button>
      )}
    </div>
  )
}

function RcaEditor({ problem, onSave }: {
  problem: ProblemDetail
  onSave: (update: Record<string, unknown>) => Promise<boolean>
}) {
  const [method, setMethod] = useState<PsaRcaMethod>(problem.rca_method ?? 'FIVE_WHYS')
  const [whys, setWhys] = useState<PsaFiveWhysEntry[]>(
    problem.rca_five_whys ?? [
      { q: 'Why?', a: '' }, { q: 'Why?', a: '' }, { q: 'Why?', a: '' }, { q: 'Why?', a: '' }, { q: 'Why?', a: '' }
    ]
  )
  const [fishbone, setFishbone] = useState<PsaFishboneData>(
    problem.rca_fishbone ?? { people: [], process: [], equipment: [], environment: [], materials: [], measurement: [] }
  )
  const [freeText, setFreeText] = useState(problem.rca_free_text ?? '')

  async function save() {
    const update: Record<string, unknown> = { rca_method: method }
    if (method === 'FIVE_WHYS') update.rca_five_whys = whys
    if (method === 'FISHBONE') update.rca_fishbone = fishbone
    if (method === 'FREE_TEXT') update.rca_free_text = freeText
    await onSave(update)
  }

  return (
    <Card title="Root Cause Analysis">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-neutral-500">Method:</span>
        {(['FIVE_WHYS', 'FISHBONE', 'FREE_TEXT'] as PsaRcaMethod[]).map(m => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`px-2.5 py-1 rounded text-xs ${method === m ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            {m.replace('_', ' ')}
          </button>
        ))}
      </div>

      {method === 'FIVE_WHYS' && (
        <div className="space-y-2">
          {whys.map((w, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-xs text-neutral-500 pt-2 w-6">#{i + 1}</span>
              <textarea
                value={w.a}
                onChange={e => {
                  const next = [...whys]
                  next[i] = { ...next[i], a: e.target.value }
                  setWhys(next)
                }}
                rows={2}
                placeholder={`Why ${i + 1}…`}
                className="flex-1 px-3 py-1.5 border border-neutral-300 rounded text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {method === 'FISHBONE' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {FISHBONE_CATEGORIES.map(cat => (
            <FishboneColumn
              key={cat}
              category={cat}
              items={fishbone[cat]}
              onChange={items => setFishbone({ ...fishbone, [cat]: items })}
            />
          ))}
        </div>
      )}

      {method === 'FREE_TEXT' && (
        <textarea
          value={freeText}
          onChange={e => setFreeText(e.target.value)}
          rows={8}
          placeholder="Describe the root cause analysis…"
          className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
        />
      )}

      <div className="mt-3 flex justify-end">
        <button onClick={save} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
          Save RCA
        </button>
      </div>
    </Card>
  )
}

function FishboneColumn({ category, items, onChange }: {
  category: string; items: string[]; onChange: (items: string[]) => void
}) {
  const [input, setInput] = useState('')
  return (
    <div className="border border-neutral-200 rounded p-2">
      <div className="text-[10px] font-semibold text-neutral-500 uppercase mb-2">{category}</div>
      <div className="space-y-1 mb-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs bg-neutral-50 rounded px-2 py-1">
            <span className="flex-1 truncate">{item}</span>
            <button
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-neutral-400 hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && input.trim()) {
              onChange([...items, input.trim()])
              setInput('')
            }
          }}
          placeholder="Add…"
          className="flex-1 px-2 py-1 border border-neutral-300 rounded text-xs"
        />
        <button
          onClick={() => {
            if (input.trim()) {
              onChange([...items, input.trim()])
              setInput('')
            }
          }}
          className="p-1 text-neutral-500 hover:text-neutral-900"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
