'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, AlertTriangle, ArrowRight, CheckCircle2, Clock, FileWarning, DollarSign } from 'lucide-react'
import type { ChangeOrder } from '@/types/database'

interface Props { projectId: string }

const CO_STEPS = [
  'initiated', 'classified', 'engineering_delegated', 'quote_delegated',
  'pm_review', 'customer_sig', 'injected', 'field_acknowledged', 'closed',
] as const

const STEP_LABELS: Record<string, string> = {
  initiated: 'Initiated',
  classified: 'Classified',
  engineering_delegated: 'Engineering',
  quote_delegated: 'Quoting',
  pm_review: 'PM Review',
  customer_sig: 'Customer Sig',
  injected: 'Injected',
  field_acknowledged: 'Field Ack',
  closed: 'Closed',
}

const STATUS_COLORS: Record<string, string> = {
  initiated: 'bg-blue-100 text-blue-700',
  classified: 'bg-indigo-100 text-indigo-700',
  engineering_delegated: 'bg-purple-100 text-purple-700',
  quote_delegated: 'bg-violet-100 text-violet-700',
  pm_review: 'bg-amber-100 text-amber-700',
  customer_sig: 'bg-orange-100 text-orange-700',
  injected: 'bg-emerald-100 text-emerald-700',
  field_acknowledged: 'bg-teal-100 text-teal-700',
  closed: 'bg-neutral-100 text-neutral-600',
}

export function ProjectChangeOrdersTab({ projectId }: Props) {
  const [cos, setCos] = useState<ChangeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'minor' | 'major'>('minor')
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState('')
  const [costImpact, setCostImpact] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/change-orders`)
    if (res.ok) setCos(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!title.trim()) return
    setCreating(true)
    const res = await fetch(`/api/org/projects/${projectId}/change-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        type,
        description: description.trim() || null,
        reason: reason.trim() || null,
        cost_impact: costImpact ? parseFloat(costImpact) : 0,
      }),
    })
    if (res.ok) {
      await load()
      setShowForm(false)
      setTitle('')
      setDescription('')
      setReason('')
      setCostImpact('')
    }
    setCreating(false)
  }

  const advanceStatus = async (co: ChangeOrder, nextStatus: string) => {
    const res = await fetch(`/api/org/projects/${projectId}/change-orders?co_id=${co.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (res.ok) await load()
  }

  const getNextStatuses = (status: string, coType: string): string[] => {
    const transitions: Record<string, string[]> = {
      initiated: ['classified'],
      classified: ['engineering_delegated', 'quote_delegated', 'pm_review'],
      engineering_delegated: ['quote_delegated', 'pm_review'],
      quote_delegated: ['pm_review'],
      pm_review: coType === 'minor' ? ['injected', 'closed'] : ['customer_sig', 'injected', 'closed'],
      customer_sig: ['injected', 'closed'],
      injected: ['field_acknowledged'],
      field_acknowledged: ['closed'],
    }
    return transitions[status] ?? []
  }

  const stepIdx = (status: string) => CO_STEPS.indexOf(status as typeof CO_STEPS[number])

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const openCOs = cos.filter(c => c.status !== 'closed')
  const closedCOs = cos.filter(c => c.status === 'closed')
  const totalImpact = cos.reduce((sum, c) => sum + (c.cost_impact ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Change Orders</h3>
          <p className="text-xs text-muted-foreground">
            {openCOs.length} open, {closedCOs.length} closed
            {totalImpact !== 0 && (
              <span className={totalImpact > 0 ? ' text-red-600' : ' text-emerald-600'}>
                {' '}| ${Math.abs(totalImpact).toLocaleString()} {totalImpact > 0 ? 'cost' : 'credit'}
              </span>
            )}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New CO
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold">Initiate Change Order</h4>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="CO title..."
            className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as 'minor' | 'major')}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              >
                <option value="minor">Minor (PM approves)</option>
                <option value="major">Major (Customer sig required)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Cost Impact ($)</label>
              <input
                type="number"
                value={costImpact}
                onChange={e => setCostImpact(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for change..."
            rows={2}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description of work..."
            rows={2}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!title.trim() || creating}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create CO'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* CO List */}
      {cos.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <FileWarning className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm">No change orders</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Changes to scope, schedule, or cost are tracked here</p>
        </div>
      )}

      {cos.map(co => {
        const expanded = expandedId === co.id
        const currentStep = stepIdx(co.status)
        const nextOptions = getNextStatuses(co.status, co.type)

        return (
          <div key={co.id} className="rounded-lg border border-border bg-card overflow-hidden">
            {/* CO Header */}
            <button
              onClick={() => setExpandedId(expanded ? null : co.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">{co.co_number}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${co.type === 'major' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {co.type.toUpperCase()}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${STATUS_COLORS[co.status]}`}>
                    {STEP_LABELS[co.status]}
                  </span>
                </div>
                <p className="text-xs font-medium text-foreground mt-0.5 truncate">{co.title}</p>
              </div>
              {co.cost_impact !== 0 && (
                <div className={`flex items-center gap-1 text-xs font-bold ${(co.cost_impact ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  <DollarSign className="h-3 w-3" />
                  {Math.abs(co.cost_impact ?? 0).toLocaleString()}
                </div>
              )}
            </button>

            {/* Expanded Detail */}
            {expanded && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                {/* 9-Step Progress */}
                <div className="flex items-center gap-0.5">
                  {CO_STEPS.map((step, idx) => (
                    <div key={step} className="flex items-center gap-0.5">
                      <div className={`h-2 w-2 rounded-full ${
                        idx < currentStep ? 'bg-emerald-500'
                        : idx === currentStep ? 'bg-primary ring-2 ring-primary/30'
                        : 'bg-muted'
                      }`} />
                      {idx < CO_STEPS.length - 1 && (
                        <div className={`h-px w-4 ${idx < currentStep ? 'bg-emerald-500' : 'bg-muted'}`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-6 text-[10px] text-muted-foreground">
                  {CO_STEPS.map((step, idx) => (
                    <span key={step} className={idx === currentStep ? 'font-bold text-primary' : ''}>
                      {STEP_LABELS[step]}
                    </span>
                  ))}
                </div>

                {/* Details */}
                {co.reason && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Reason</p>
                    <p className="text-xs text-foreground">{co.reason}</p>
                  </div>
                )}
                {co.description && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Description</p>
                    <p className="text-xs text-foreground">{co.description}</p>
                  </div>
                )}
                {co.schedule_impact_days > 0 && (
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    <Clock className="h-3 w-3" />
                    {co.schedule_impact_days} day schedule impact
                  </div>
                )}

                {/* Advance Actions */}
                {nextOptions.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-muted-foreground">Advance to:</span>
                    {nextOptions.map(next => (
                      <button
                        key={next}
                        onClick={() => advanceStatus(co, next)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-accent"
                      >
                        {next === 'closed' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <ArrowRight className="h-3 w-3" />}
                        {STEP_LABELS[next]}
                      </button>
                    ))}
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
