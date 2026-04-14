'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Plus, Search, Clock } from 'lucide-react'
import type { PsaKedbEntry } from '@/types/database'

export default function KedbPage() {
  const [entries, setEntries] = useState<PsaKedbEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', symptoms: '', workaround: '', category: '' })

  const load = async () => {
    setLoading(true)
    const url = q ? `/api/org/psa/kedb?q=${encodeURIComponent(q)}` : '/api/org/psa/kedb'
    const res = await fetch(url)
    if (res.ok) setEntries(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function create() {
    if (!form.title.trim() || !form.symptoms.trim()) return
    const res = await fetch('/api/org/psa/kedb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ title: '', symptoms: '', workaround: '', category: '' })
      setCreating(false)
      load()
    }
  }

  function daysUntilExpiry(expiresAt: string): number {
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-500" /> Known Error Database
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Workarounds and fixes for known issues. Auto-expire after 6 months.</p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New KE
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search title or symptoms…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded text-sm"
          />
        </div>
        <button onClick={load} className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 rounded text-sm">Search</button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <input
            type="text"
            placeholder="Title (what breaks?)"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
          />
          <textarea
            placeholder="Symptoms — observable behavior"
            value={form.symptoms}
            onChange={e => setForm({ ...form, symptoms: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
          />
          <textarea
            placeholder="Workaround (optional)"
            value={form.workaround}
            onChange={e => setForm({ ...form, workaround: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder="Category (optional)"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
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
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">No known errors yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">KE #</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Title</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Category</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Matches</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Expires</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Audience</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const daysLeft = daysUntilExpiry(e.expires_at)
                const expiryTone = daysLeft < 0 ? 'text-red-600' : daysLeft < 30 ? 'text-amber-600' : 'text-neutral-500'
                return (
                  <tr key={e.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link href={`/org/psa/kedb/${e.id}`} className="text-blue-600 hover:underline">
                        {e.kedb_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-medium">{e.title}</td>
                    <td className="px-3 py-2 text-xs text-neutral-600">{e.category ?? '—'}</td>
                    <td className="px-3 py-2 text-xs font-mono">{e.match_count}</td>
                    <td className={`px-3 py-2 text-xs font-mono ${expiryTone}`}>
                      {daysLeft < 0 ? 'EXPIRED' : `${daysLeft}d`}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-600 uppercase">{e.audience}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
