'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Users, AlertCircle, ArrowRight, Link as LinkIcon, DollarSign, Copy, Check } from 'lucide-react'
import type { SubAssignment, SubAssignmentStatus, Subcontractor } from '@/types/database'

interface Props { projectId: string }

const STATUSES: SubAssignmentStatus[] = [
  'rfp_sent', 'quoted', 'quote_review', 'quote_accepted',
  'po_issued', 'po_acknowledged', 'mobilizing', 'on_site',
  'in_progress', 'blocked', 'daily_report_pending', 'qc_pending',
  'punch_list', 'punch_complete', 'invoice_pending', 'invoice_received',
  'subcontractor_complete',
]

const STATUS_LABEL: Record<SubAssignmentStatus, string> = {
  rfp_sent: 'RFP Sent', quoted: 'Quoted', quote_review: 'Quote Review',
  quote_accepted: 'Quote Accepted', po_issued: 'PO Issued', po_acknowledged: 'PO Acknowledged',
  mobilizing: 'Mobilizing', on_site: 'On Site', in_progress: 'In Progress',
  blocked: 'Blocked', daily_report_pending: 'Daily Report Pending', qc_pending: 'QC Pending',
  punch_list: 'Punch List', punch_complete: 'Punch Complete', invoice_pending: 'Invoice Pending',
  invoice_received: 'Invoice Received', subcontractor_complete: 'Complete',
}

const STATUS_COLOR: Record<string, string> = {
  rfp_sent: 'bg-blue-100 text-blue-700',
  quoted: 'bg-indigo-100 text-indigo-700',
  quote_review: 'bg-violet-100 text-violet-700',
  quote_accepted: 'bg-purple-100 text-purple-700',
  po_issued: 'bg-amber-100 text-amber-700',
  po_acknowledged: 'bg-amber-100 text-amber-700',
  mobilizing: 'bg-orange-100 text-orange-700',
  on_site: 'bg-cyan-100 text-cyan-700',
  in_progress: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-700',
  daily_report_pending: 'bg-yellow-100 text-yellow-700',
  qc_pending: 'bg-yellow-100 text-yellow-700',
  punch_list: 'bg-pink-100 text-pink-700',
  punch_complete: 'bg-teal-100 text-teal-700',
  invoice_pending: 'bg-sky-100 text-sky-700',
  invoice_received: 'bg-sky-100 text-sky-700',
  subcontractor_complete: 'bg-neutral-100 text-neutral-600',
}

const TRANSITIONS: Record<SubAssignmentStatus, SubAssignmentStatus[]> = {
  rfp_sent: ['quoted'],
  quoted: ['quote_review'],
  quote_review: ['quote_accepted', 'rfp_sent'],
  quote_accepted: ['po_issued'],
  po_issued: ['po_acknowledged'],
  po_acknowledged: ['mobilizing'],
  mobilizing: ['on_site'],
  on_site: ['in_progress'],
  in_progress: ['daily_report_pending', 'blocked', 'qc_pending'],
  blocked: ['in_progress'],
  daily_report_pending: ['in_progress', 'qc_pending'],
  qc_pending: ['punch_list', 'invoice_pending'],
  punch_list: ['punch_complete'],
  punch_complete: ['invoice_pending'],
  invoice_pending: ['invoice_received'],
  invoice_received: ['subcontractor_complete'],
  subcontractor_complete: [],
}

export function ProjectSubsTab({ projectId }: Props) {
  const [assignments, setAssignments] = useState<SubAssignment[]>([])
  const [subs, setSubs] = useState<Subcontractor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState<string | null>(null)

  // Form
  const [subId, setSubId] = useState('')
  const [scope, setScope] = useState('')
  const [poAmount, setPoAmount] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const [aRes, sRes] = await Promise.all([
      fetch(`/api/org/projects/${projectId}/sub-assignments`),
      fetch('/api/org/subcontractors'),
    ])
    if (aRes.ok) setAssignments(await aRes.json())
    if (sRes.ok) setSubs(await sRes.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!subId) return
    setCreating(true)
    const res = await fetch(`/api/org/projects/${projectId}/sub-assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sub_id: subId,
        scope: scope.trim() || null,
        po_amount: poAmount ? parseFloat(poAmount) : null,
        status: 'rfp_sent',
      }),
    })
    if (res.ok) {
      await load()
      setShowForm(false)
      setSubId(''); setScope(''); setPoAmount('')
    }
    setCreating(false)
  }

  const advance = async (a: SubAssignment, next: SubAssignmentStatus) => {
    const res = await fetch(`/api/org/projects/${projectId}/sub-assignments?assignment_id=${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) await load()
  }

  const generateToken = async (a: SubAssignment) => {
    const res = await fetch(`/api/org/projects/${projectId}/sub-portal-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub_id: a.sub_id, permissions: ['view', 'upload', 'invoice'] }),
    })
    if (res.ok) {
      const row = await res.json()
      const url = `${window.location.origin}/sub-portal/${row.token}`
      navigator.clipboard.writeText(url)
      setTokenCopied(a.id)
      setTimeout(() => setTokenCopied(null), 2000)
    }
  }

  const subName = (id: string) => subs.find(s => s.id === id)?.name ?? 'Unknown sub'

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  const totalPO = assignments.reduce((s, a) => s + (a.po_amount ?? 0), 0)
  const totalInvoiced = assignments.reduce((s, a) => s + (a.invoiced_amount ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Subcontractor Assignments</h3>
          <p className="text-xs text-muted-foreground">
            {assignments.length} active &middot; PO ${totalPO.toLocaleString()} &middot; Invoiced ${totalInvoiced.toLocaleString()}
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> Assign Sub
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold">Assign Subcontractor</h4>
          <select value={subId} onChange={e => setSubId(e.target.value)} className="w-full rounded border border-border bg-background px-2 py-2 text-xs outline-none focus:border-primary">
            <option value="">Select sub…</option>
            {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <textarea value={scope} onChange={e => setScope(e.target.value)} placeholder="Scope of work…" rows={2} className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none" />
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">PO Amount ($)</label>
            <input type="number" value={poAmount} onChange={e => setPoAmount(e.target.value)} placeholder="0.00" className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!subId || creating} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              {creating ? 'Creating…' : 'Create Assignment'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {assignments.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <Users className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm">No subcontractors assigned</p>
        </div>
      )}

      {assignments.map(a => {
        const expanded = expandedId === a.id
        const variance = (a.invoiced_amount ?? 0) - (a.po_amount ?? 0)
        const overPO = a.po_amount && a.invoiced_amount > a.po_amount
        const nextOptions = TRANSITIONS[a.status] ?? []

        return (
          <div key={a.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <button onClick={() => setExpandedId(expanded ? null : a.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{subName(a.sub_id)}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${STATUS_COLOR[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                  {overPO && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                      <AlertCircle className="h-2.5 w-2.5" /> PO VARIANCE
                    </span>
                  )}
                </div>
                {a.scope && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.scope}</p>}
              </div>
              {a.po_amount && (
                <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                  <DollarSign className="h-3 w-3" />
                  {a.po_amount.toLocaleString()}
                </div>
              )}
            </button>

            {expanded && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">PO Amount</p>
                    <p className="font-bold">${(a.po_amount ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Invoiced</p>
                    <p className="font-bold">${(a.invoiced_amount ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Variance</p>
                    <p className={`font-bold ${variance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      ${Math.abs(variance).toLocaleString()}
                    </p>
                  </div>
                </div>

                {a.blockers && (
                  <div className="rounded border border-red-200 bg-red-50 p-2">
                    <p className="text-[10px] font-semibold text-red-700">BLOCKERS</p>
                    <p className="text-xs text-red-900">{a.blockers}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {nextOptions.map(next => (
                    <button key={next} onClick={() => advance(a, next)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-accent">
                      <ArrowRight className="h-3 w-3" /> {STATUS_LABEL[next]}
                    </button>
                  ))}
                  <button onClick={() => generateToken(a)} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10">
                    {tokenCopied === a.id ? <><Check className="h-3 w-3" /> Copied!</> : <><LinkIcon className="h-3 w-3" /> Portal Link</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Status legend */}
      {assignments.length > 0 && (
        <details className="text-[10px] text-muted-foreground">
          <summary className="cursor-pointer">17-state lifecycle</summary>
          <div className="mt-1 flex flex-wrap gap-1">
            {STATUSES.map(s => (
              <span key={s} className={`rounded px-1 py-0.5 ${STATUS_COLOR[s]}`}>{STATUS_LABEL[s]}</span>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
