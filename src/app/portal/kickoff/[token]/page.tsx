'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Calendar, MapPin, Users, CheckCircle2, AlertCircle } from 'lucide-react'

interface KickoffInfo {
  org_name: string | null
  project_name: string | null
  project_number: string | null
  title: string
  meeting_type: string
  meeting_date: string
  location: string | null
  agenda: string | null
  attendees: { name: string; role: string }[]
  next_meeting_date: string | null
  acknowledged_at: string | null
  acknowledged_by_name: string | null
}

export default function KickoffPortalPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token

  const [info, setInfo] = useState<KickoffInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    ;(async () => {
      const res = await fetch(`/api/portal/kickoff/${token}`)
      if (!res.ok) {
        setError((await res.json()).error ?? 'Unable to load kickoff details')
        setLoading(false)
        return
      }
      setInfo(await res.json())
      setLoading(false)
    })()
  }, [token])

  async function acknowledge() {
    if (!name.trim() || !token) return
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/portal/kickoff/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const result = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(result.error ?? 'Failed to confirm'); return }
    setInfo((prev) => prev ? { ...prev, acknowledged_at: result.acknowledged_at, acknowledged_by_name: name.trim() } : prev)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <p className="text-sm text-neutral-500">Loading kickoff details...</p>
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <p className="text-sm text-neutral-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!info) return null

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="text-center">
          {info.org_name && <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{info.org_name}</p>}
          <h1 className="mt-1 text-2xl font-bold text-neutral-900">Project Kickoff Meeting</h1>
          {info.project_name && (
            <p className="text-sm text-neutral-500">
              {info.project_number ? `${info.project_number} — ` : ''}{info.project_name}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">{info.title}</h2>

          <div className="space-y-2 text-sm text-neutral-700">
            <p className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-neutral-400" />
              {new Date(info.meeting_date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
            {info.location && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-neutral-400" />
                {info.location}
              </p>
            )}
            {info.attendees.length > 0 && (
              <p className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <span>{info.attendees.map((a) => a.role ? `${a.name} (${a.role})` : a.name).filter(Boolean).join(', ')}</span>
              </p>
            )}
          </div>

          {info.agenda && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Agenda</p>
              <p className="whitespace-pre-wrap text-sm text-neutral-700">{info.agenda}</p>
            </div>
          )}

          {info.next_meeting_date && (
            <p className="text-xs text-neutral-500">
              Next meeting: {new Date(info.next_meeting_date).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          {info.acknowledged_at ? (
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm">
                Confirmed by {info.acknowledged_by_name} on {new Date(info.acknowledged_at).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-700">Please confirm you have reviewed the kickoff details above.</p>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2">
                <input
                  className="h-9 flex-1 rounded-md border border-neutral-300 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  onClick={acknowledge}
                  disabled={!name.trim() || submitting}
                  className="h-9 rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  {submitting ? 'Confirming...' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
