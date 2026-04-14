'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Calendar, Cloud, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { DailyReport } from '@/types/database'

interface Props { projectId: string }

export function ProjectDailyReportsTab({ projectId }: Props) {
  const [reports, setReports] = useState<(DailyReport & {
    author?: { first_name: string; last_name: string } | null
    daily_report_items?: Array<{ id: string; description: string; hours: number }> | null
  })[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({ summary: '', weather: '', crew_count: '', hours_worked: '', safety_notes: '' })

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/daily-reports`)
    if (res.ok) setReports(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    const res = await fetch(`/api/org/projects/${projectId}/daily-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: form.summary,
        weather: form.weather || null,
        crew_count: form.crew_count ? parseInt(form.crew_count) : 0,
        hours_worked: form.hours_worked ? parseFloat(form.hours_worked) : 0,
        safety_notes: form.safety_notes || null,
      }),
    })
    if (res.ok) {
      setShowCreate(false)
      setForm({ summary: '', weather: '', crew_count: '', hours_worked: '', safety_notes: '' })
      await load()
    }
  }

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Daily Reports</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" /> New Report
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <h4 className="text-[11px] font-semibold text-foreground">New Daily Report — {new Date().toLocaleDateString()}</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Weather</label>
              <input value={form.weather} onChange={e => setForm({ ...form, weather: e.target.value })} placeholder="Clear, 75°F" className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Crew Count</label>
              <input type="number" value={form.crew_count} onChange={e => setForm({ ...form, crew_count: e.target.value })} className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Hours Worked</label>
              <input type="number" step="0.5" value={form.hours_worked} onChange={e => setForm({ ...form, hours_worked: e.target.value })} className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Summary</label>
            <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} rows={3} placeholder="Work completed today..." className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary resize-none" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Safety Notes</label>
            <input value={form.safety_notes} onChange={e => setForm({ ...form, safety_notes: e.target.value })} placeholder="Any safety observations..." className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreate} className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90">Submit</button>
            <button onClick={() => setShowCreate(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Report List */}
      {reports.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Calendar className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs">No daily reports filed</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {reports.map(report => {
            const expanded = expandedId === report.id

            return (
              <div key={report.id} className="rounded-lg border border-border bg-card">
                <button
                  onClick={() => setExpandedId(expanded ? null : report.id)}
                  className="flex w-full items-center justify-between px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-foreground">
                      {new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      by {report.author ? `${report.author.first_name} ${report.author.last_name}` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    {report.weather && <span className="flex items-center gap-0.5"><Cloud className="h-2.5 w-2.5" />{report.weather}</span>}
                    {report.crew_count > 0 && <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{report.crew_count}</span>}
                    {report.hours_worked > 0 && <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{report.hours_worked}h</span>}
                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-border px-3 py-2.5 space-y-2">
                    {report.summary && (
                      <div>
                        <h5 className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Summary</h5>
                        <p className="text-xs text-foreground whitespace-pre-wrap">{report.summary}</p>
                      </div>
                    )}
                    {report.safety_notes && (
                      <div>
                        <h5 className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Safety</h5>
                        <p className="text-xs text-foreground">{report.safety_notes}</p>
                      </div>
                    )}
                    {report.daily_report_items && report.daily_report_items.length > 0 && (
                      <div>
                        <h5 className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Line Items</h5>
                        {report.daily_report_items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-foreground">{item.description}</span>
                            {item.hours > 0 && <span className="text-muted-foreground">{item.hours}h</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
