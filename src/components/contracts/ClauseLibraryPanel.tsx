'use client'

import { useEffect, useState } from 'react'
import type { ContractClause } from '@/types/database'

interface Props {
  onPick?: (clause: ContractClause) => void
  pickable?: boolean
}

export default function ClauseLibraryPanel({ onPick, pickable = false }: Props) {
  const [clauses, setClauses] = useState<ContractClause[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ContractClause | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', body_md: '' })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/org/contracts/clauses')
    if (res.ok) setClauses(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!form.name || !form.body_md) return
    const url = editing ? `/api/org/contracts/clauses/${editing.id}` : '/api/org/contracts/clauses'
    const method = editing ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setEditing(null)
      setShowNew(false)
      setForm({ name: '', category: '', body_md: '' })
      load()
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this clause?')) return
    await fetch(`/api/org/contracts/clauses/${id}`, { method: 'DELETE' })
    load()
  }

  function startEdit(c: ContractClause) {
    setEditing(c)
    setShowNew(true)
    setForm({ name: c.name, category: c.category ?? '', body_md: c.body_md })
  }

  function cancel() {
    setEditing(null)
    setShowNew(false)
    setForm({ name: '', category: '', body_md: '' })
  }

  const byCategory = clauses.reduce<Record<string, ContractClause[]>>((acc, c) => {
    const k = c.category ?? 'Uncategorized'
    ;(acc[k] ||= []).push(c)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Clause Library</h2>
        {!showNew && (
          <button
            onClick={() => setShowNew(true)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            + New Clause
          </button>
        )}
      </div>

      {showNew && (
        <div className="rounded border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Category (e.g. Liability, Termination)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder="Clause body (markdown)"
            value={form.body_md}
            onChange={(e) => setForm({ ...form, body_md: e.target.value })}
            rows={6}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
          />
          <div className="flex gap-2">
            <button onClick={save} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
              {editing ? 'Save Changes' : 'Create'}
            </button>
            <button onClick={cancel} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading clauses...</div>
      ) : clauses.length === 0 ? (
        <div className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No clauses yet. Create your first reusable clause.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat}>
              <div className="mb-2 text-xs font-semibold uppercase text-slate-500">{cat}</div>
              <div className="space-y-2">
                {list.map((c) => (
                  <div key={c.id} className="rounded border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">{c.name}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-slate-600 whitespace-pre-wrap">
                          {c.body_md}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {pickable && (
                          <button
                            onClick={() => onPick?.(c)}
                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
                          >
                            Insert
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(c)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => remove(c.id)}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
