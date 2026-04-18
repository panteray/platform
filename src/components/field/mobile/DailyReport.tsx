'use client'

import { useState, useEffect, useCallback } from 'react'
import { CloudSun, Users, Clock, ShieldAlert, FileText, Plus } from 'lucide-react'
import type { DailyReport as DailyReportType, User } from '@/types/database'

type ReportWithAuthor = DailyReportType & {
  author?: Pick<User, 'id' | 'first_name' | 'last_name'> | null
}

interface Props {
  projectId: string
  onCountChange?: (total: number) => void
}

export function DailyReport({ projectId, onCountChange }: Props) {
  const [reports, setReports] = useState<ReportWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState('')
  const [weather, setWeather] = useState('')
  const [crewCount, setCrewCount] = useState<string>('')
  const [hours, setHours] = useState<string>('')
  const [safety, setSafety] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/org/projects/${projectId}/daily-reports`)
    if (res.ok) {
      const data: ReportWithAuthor[] = await res.json()
      setReports(data)
      onCountChange?.(data.length)
    }
    setLoading(false)
  }, [projectId, onCountChange])

  useEffect(() => { load() }, [load])

  const reset = () => {
    setSummary(''); setWeather(''); setCrewCount(''); setHours(''); setSafety('')
  }

  const submit = async () => {
    if (!summary.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/org/projects/${projectId}/daily-reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        summary: summary.trim(),
        weather: weather.trim() || null,
        crew_count: crewCount ? Number(crewCount) : 0,
        hours_worked: hours ? Number(hours) : 0,
        safety_notes: safety.trim() || null,
      }),
    })
    if (res.ok) {
      setComposing(false)
      reset()
      await load()
    }
    setSubmitting(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const todaysReport = reports.find((r) => r.report_date === today)

  if (loading) {
    return <div className="flex h-48 items-center justify-center text-sm text-neutral-400">Loading…</div>
  }

  return (
    <div className="p-4 pb-24">
      {!composing && !todaysReport && (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 py-4 text-sm font-semibold text-blue-700 active:bg-blue-100"
        >
          <Plus className="h-4 w-4" />
          Submit today's progress report
        </button>
      )}

      {composing && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-neutral-900">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <button
              type="button"
              onClick={() => { setComposing(false); reset() }}
              className="text-xs font-medium text-neutral-500"
            >
              Cancel
            </button>
          </div>
          <Label icon={FileText}>Summary *</Label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="What got done today?"
            className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label icon={Users}>Crew</Label>
              <input
                type="number"
                inputMode="numeric"
                value={crewCount}
                onChange={(e) => setCrewCount(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <Label icon={Clock}>Hours</Label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-3">
            <Label icon={CloudSun}>Weather</Label>
            <input
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              placeholder="Clear, 72°F"
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="mt-3">
            <Label icon={ShieldAlert}>Safety notes</Label>
            <textarea
              value={safety}
              onChange={(e) => setSafety(e.target.value)}
              rows={2}
              placeholder="Any incidents, near-misses, or safety observations"
              className="mt-1 w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!summary.trim() || submitting}
            className="mt-4 w-full rounded-xl bg-neutral-900 py-3.5 text-sm font-semibold text-white active:bg-neutral-800 disabled:opacity-40"
          >
            {submitting ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      )}

      <div className={`space-y-3 ${composing ? 'mt-6' : !todaysReport ? 'mt-4' : ''}`}>
        {reports.length === 0 && !composing && (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-10 text-center">
            <p className="text-sm text-neutral-500">No reports yet</p>
          </div>
        )}
        {reports.map((r) => {
          const author = r.author ? `${r.author.first_name ?? ''} ${r.author.last_name ?? ''}`.trim() : '—'
          return (
            <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-neutral-900">
                  {new Date(r.report_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="text-[11px] text-neutral-400">{author}</div>
              </div>
              {r.summary && <p className="mt-2 text-sm text-neutral-700 whitespace-pre-wrap">{r.summary}</p>}
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-neutral-500">
                {r.crew_count > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{r.crew_count}</span>}
                {r.hours_worked > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.hours_worked}h</span>}
                {r.weather && <span className="inline-flex items-center gap-1"><CloudSun className="h-3 w-3" />{r.weather}</span>}
              </div>
              {r.safety_notes && (
                <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  <span className="font-semibold">Safety: </span>{r.safety_notes}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Label({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
      <Icon className="h-3 w-3" />
      {children}
    </label>
  )
}
