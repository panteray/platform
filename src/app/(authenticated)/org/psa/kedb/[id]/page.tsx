'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Clock, Archive } from 'lucide-react'
import type { PsaKedbEntry, PsaKedbAudience } from '@/types/database'

type KedbDetail = PsaKedbEntry & {
  problem?: { id: string; problem_number: string; title: string } | null
}

export default function KedbDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [entry, setEntry] = useState<KedbDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState({
    title: '', symptoms: '', root_cause: '', workaround: '', permanent_fix: '', category: '', audience: 'internal' as PsaKedbAudience,
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/psa/kedb/${id}`)
    if (res.ok) {
      const data: KedbDetail = await res.json()
      setEntry(data)
      setEdit({
        title: data.title,
        symptoms: data.symptoms,
        root_cause: data.root_cause ?? '',
        workaround: data.workaround ?? '',
        permanent_fix: data.permanent_fix ?? '',
        category: data.category ?? '',
        audience: data.audience,
      })
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    await fetch(`/api/org/psa/kedb/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: edit.title,
        symptoms: edit.symptoms,
        root_cause: edit.root_cause || null,
        workaround: edit.workaround || null,
        permanent_fix: edit.permanent_fix || null,
        category: edit.category || null,
        audience: edit.audience,
      }),
    })
    setSaving(false)
    load()
  }

  async function archive() {
    if (!confirm('Archive this known error?')) return
    await fetch(`/api/org/psa/kedb/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived_at: new Date().toISOString() }),
    })
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-neutral-500">
        <Clock className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="p-6">
        <div className="text-red-600">Known error not found</div>
        <Link href="/org/psa/kedb" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          ← Back to KEDB
        </Link>
      </div>
    )
  }

  const daysLeft = Math.ceil((new Date(entry.expires_at).getTime() - Date.now()) / 86400000)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Link href="/org/psa/kedb" className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to KEDB
      </Link>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <span className="font-mono text-sm text-neutral-500">{entry.kedb_number}</span>
            <span className="text-xs text-neutral-500">
              {entry.archived_at ? 'ARCHIVED' : daysLeft < 0 ? 'EXPIRED' : `Expires in ${daysLeft}d`}
            </span>
          </div>
          {!entry.archived_at && (
            <button
              onClick={archive}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100 rounded"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
          )}
        </div>

        {entry.problem && (
          <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
            Sourced from problem{' '}
            <Link href={`/org/psa/problems/${entry.problem.id}`} className="font-mono text-blue-600 hover:underline">
              {entry.problem.problem_number}
            </Link>
            {' — '}{entry.problem.title}
          </div>
        )}

        <div className="space-y-4">
          <Field label="Title">
            <input
              value={edit.title}
              onChange={e => setEdit({ ...edit, title: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
            />
          </Field>
          <Field label="Symptoms">
            <textarea
              value={edit.symptoms}
              onChange={e => setEdit({ ...edit, symptoms: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
            />
          </Field>
          <Field label="Root Cause">
            <textarea
              value={edit.root_cause}
              onChange={e => setEdit({ ...edit, root_cause: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
            />
          </Field>
          <Field label="Workaround">
            <textarea
              value={edit.workaround}
              onChange={e => setEdit({ ...edit, workaround: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
            />
          </Field>
          <Field label="Permanent Fix">
            <textarea
              value={edit.permanent_fix}
              onChange={e => setEdit({ ...edit, permanent_fix: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <input
                value={edit.category}
                onChange={e => setEdit({ ...edit, category: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
              />
            </Field>
            <Field label="Audience">
              <select
                value={edit.audience}
                onChange={e => setEdit({ ...edit, audience: e.target.value as PsaKedbAudience })}
                className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
              >
                <option value="internal">Internal</option>
                <option value="customer_portal">Customer Portal</option>
                <option value="both">Both</option>
              </select>
            </Field>
          </div>

          <div className="flex justify-end pt-3 border-t border-neutral-100">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-neutral-400 grid grid-cols-2 gap-2">
        <div>Matches: {entry.match_count}</div>
        <div>Last matched: {entry.last_matched_at ? new Date(entry.last_matched_at).toLocaleDateString() : '—'}</div>
        <div>Created: {new Date(entry.created_at).toLocaleDateString()}</div>
        <div>Expires: {new Date(entry.expires_at).toLocaleDateString()}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-neutral-500 uppercase mb-1">{label}</label>
      {children}
    </div>
  )
}
