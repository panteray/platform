'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'

interface StatusReport {
  id: string
  report_date: string
  overall_status: string
  summary: string | null
  accomplishments: string | null
  next_steps: string | null
  blockers: string | null
  snapshot: {
    open_risks?: number
    open_issues?: number
    open_actions?: number
    total_install_items?: number
    installed_count?: number
    deviation_count?: number
    install_progress_pct?: number
    milestones_total?: number
    milestones_completed?: number
    open_change_orders?: number
  }
  author?: { first_name: string; last_name: string } | null
  created_at: string
}

interface Props { projectId: string }

const STATUS_CONFIG: Record<string, { color: string; icon: typeof TrendingUp; label: string }> = {
  on_track: { color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp, label: 'On Track' },
  at_risk: { color: 'bg-amber-100 text-amber-700', icon: AlertCircle, label: 'At Risk' },
  behind: { color: 'bg-orange-100 text-orange-700', icon: TrendingDown, label: 'Behind' },
  critical: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Critical' },
}

export function ProjectStatusReportsTab({ projectId }: Props) {
  const [reports, setReports] = useState<StatusReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form
  const [overallStatus, setOverallStatus] = useState('on_track')
  const [summary, setSummary] = useState('')
  const [accomplishments, setAccomplishments] = useState('')
  const [nextSteps, setNextSteps] = useState('')
  const [blockers, setBlockers] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/status-reports`)
    if (res.ok) setReports(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    setCreating(true)
    const res = await fetch(`/api/org/projects/${projectId}/status-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overall_status: overallStatus,
        summary: summary.trim() || null,
        accomplishments: accomplishments.trim() || null,
        next_steps: nextSteps.trim() || null,
        blockers: blockers.trim() || null,
      }),
    })
    if (res.ok) {
      await load()
      setShowForm(false)
      setSummary('')
      setAccomplishments('')
      setNextSteps('')
      setBlockers('')
    }
    setCreating(false)
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Status Reports</h3>
          <p className="text-xs text-muted-foreground">{reports.length} reports generated</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Generate Report
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold">New Status Report</h4>
          <p className="text-[10px] text-muted-foreground">
            Project snapshot (RAID counts, install progress, milestones) will be auto-captured.
          </p>

          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Overall Status</label>
            <div className="flex gap-1.5">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setOverallStatus(key)}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors ${
                    overallStatus === key ? cfg.color : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Summary</label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="High-level project status summary..."
              rows={2}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Accomplishments</label>
              <textarea
                value={accomplishments}
                onChange={e => setAccomplishments(e.target.value)}
                placeholder="What was completed this period..."
                rows={3}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Next Steps</label>
              <textarea
                value={nextSteps}
                onChange={e => setNextSteps(e.target.value)}
                placeholder="Planned work for next period..."
                rows={3}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Blockers</label>
            <textarea
              value={blockers}
              onChange={e => setBlockers(e.target.value)}
              placeholder="Anything blocking progress..."
              rows={2}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {creating ? 'Generating...' : 'Generate Report'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty */}
      {reports.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <FileText className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm">No status reports</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Generate reports with auto-captured project snapshots</p>
        </div>
      )}

      {/* Report List */}
      {reports.map(r => {
        const expanded = expandedId === r.id
        const cfg = STATUS_CONFIG[r.overall_status] ?? STATUS_CONFIG.on_track
        const snap = r.snapshot

        return (
          <div key={r.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpandedId(expanded ? null : r.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
            >
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {new Date(r.report_date).toLocaleDateString()}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                {r.summary && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.summary}</p>}
              </div>
              {r.author && (
                <span className="text-[10px] text-muted-foreground">
                  {r.author.first_name} {r.author.last_name}
                </span>
              )}
            </button>

            {expanded && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                {/* Snapshot Cards */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded border border-border bg-background p-2 text-center">
                    <p className="text-lg font-bold text-foreground">{snap?.install_progress_pct ?? 0}%</p>
                    <p className="text-[9px] text-muted-foreground">Install</p>
                  </div>
                  <div className="rounded border border-border bg-background p-2 text-center">
                    <p className="text-lg font-bold text-red-600">{snap?.open_risks ?? 0}</p>
                    <p className="text-[9px] text-muted-foreground">Open Risks</p>
                  </div>
                  <div className="rounded border border-border bg-background p-2 text-center">
                    <p className="text-lg font-bold text-amber-600">{snap?.open_issues ?? 0}</p>
                    <p className="text-[9px] text-muted-foreground">Open Issues</p>
                  </div>
                  <div className="rounded border border-border bg-background p-2 text-center">
                    <p className="text-lg font-bold text-foreground">
                      {snap?.milestones_completed ?? 0}/{snap?.milestones_total ?? 0}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Milestones</p>
                  </div>
                </div>

                {/* Report Content */}
                {r.accomplishments && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Accomplishments</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{r.accomplishments}</p>
                  </div>
                )}
                {r.next_steps && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Next Steps</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{r.next_steps}</p>
                  </div>
                )}
                {r.blockers && (
                  <div>
                    <p className="text-[10px] font-semibold text-amber-600 mb-0.5">Blockers</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{r.blockers}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
