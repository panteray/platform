'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Plus, Clock, Lightbulb } from 'lucide-react'
import type { PsaProblem, PsaProblemStatus, PsaProblemSuggestion } from '@/types/database'

type ProblemRow = PsaProblem & {
  customer?: { id: string; name: string } | null
  assignee?: { id: string; first_name: string | null; last_name: string | null; email: string } | null
}

type SuggestionRow = PsaProblemSuggestion & {
  customer?: { id: string; name: string } | null
}

const STATUS_COLORS: Record<PsaProblemStatus, string> = {
  NEW:                   'bg-blue-100 text-blue-700',
  UNDER_INVESTIGATION:   'bg-amber-100 text-amber-700',
  ROOT_CAUSE_IDENTIFIED: 'bg-purple-100 text-purple-700',
  WORKAROUND_AVAILABLE:  'bg-cyan-100 text-cyan-700',
  RESOLVED:              'bg-emerald-100 text-emerald-700',
  CLOSED:                'bg-neutral-100 text-neutral-600',
}

const STATUS_LABELS: Record<PsaProblemStatus, string> = {
  NEW:                   'New',
  UNDER_INVESTIGATION:   'Investigating',
  ROOT_CAUSE_IDENTIFIED: 'Root Cause ID',
  WORKAROUND_AVAILABLE:  'Workaround',
  RESOLVED:              'Resolved',
  CLOSED:                'Closed',
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState<ProblemRow[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const load = async () => {
    setLoading(true)
    const [pRes, sRes] = await Promise.all([
      fetch('/api/org/psa/problems'),
      fetch('/api/org/psa/problem-suggestions'),
    ])
    if (pRes.ok) setProblems(await pRes.json())
    if (sRes.ok) setSuggestions(await sRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!newTitle.trim()) return
    const res = await fetch('/api/org/psa/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, description: newDesc || null }),
    })
    if (res.ok) {
      setNewTitle(''); setNewDesc(''); setCreating(false)
      load()
    }
  }

  async function acceptSuggestion(s: SuggestionRow) {
    // Create a problem from the suggestion + accept
    const res = await fetch('/api/org/psa/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Recurring: ${s.category}`,
        description: `Auto-generated from ${s.incident_count} incidents in ${s.window_days} days`,
        problem_type: 'REACTIVE',
        customer_id: s.customer_id,
        category: s.category,
        linked_ticket_ids: s.sample_ticket_ids,
      }),
    })
    if (res.ok) {
      const problem = await res.json()
      await fetch('/api/org/psa/problem-suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, status: 'accepted', problem_id: problem.id }),
      })
      load()
    }
  }

  async function dismissSuggestion(id: string) {
    await fetch('/api/org/psa/problem-suggestions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'dismissed' }),
    })
    load()
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" /> Problem Management
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Track recurring issues, root causes, and permanent fixes.</p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Problem
        </button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wide">
              Recurrence Detected ({suggestions.length})
            </h3>
          </div>
          <div className="space-y-2">
            {suggestions.map(s => (
              <div key={s.id} className="bg-white rounded border border-amber-200 p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-900">
                    {s.customer?.name ?? 'Unknown customer'} — {s.category}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {s.incident_count} incidents in {s.window_days} days
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptSuggestion(s)}
                    className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    Create Problem
                  </button>
                  <button
                    onClick={() => dismissSuggestion(s.id)}
                    className="px-2.5 py-1 text-neutral-600 hover:bg-neutral-100 rounded text-xs"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <input
            type="text"
            placeholder="Problem title"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
          />
          <textarea
            placeholder="Description (optional)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 rounded">Cancel</button>
            <button onClick={create} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Create</button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500">
            <Clock className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading…
          </div>
        ) : problems.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">No problems yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">PRB #</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Title</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Customer</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Assignee</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Opened</th>
              </tr>
            </thead>
            <tbody>
              {problems.map(p => (
                <tr key={p.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/org/psa/problems/${p.id}`} className="text-blue-600 hover:underline">
                      {p.problem_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-medium">{p.title}</td>
                  <td className="px-3 py-2">{p.customer?.name ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-600">{p.problem_type}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.assignee ? `${p.assignee.first_name ?? ''} ${p.assignee.last_name ?? ''}`.trim() || p.assignee.email : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{new Date(p.opened_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
