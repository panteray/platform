'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, CheckCircle2, XCircle, AlertTriangle, ClipboardCheck, Camera } from 'lucide-react'
import type { QcChecklist } from '@/types/database'

interface Props { projectId: string }

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-600',
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
}

export function ProjectQcTab({ projectId }: Props) {
  const [checklists, setChecklists] = useState<QcChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form
  const [areaName, setAreaName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/qc`)
    if (res.ok) setChecklists(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!areaName.trim()) return
    setCreating(true)

    const defaultItems = [
      'Cable terminations tested', 'Device mounted correctly', 'Power verified',
      'Network connectivity confirmed', 'Video feed operational', 'Labels applied',
      'Cable management complete', 'Firmware updated', 'Device registered in VMS/ACS',
    ].map((label, idx) => ({ id: `item-${idx}`, label, passed: false, notes: '' }))

    const res = await fetch(`/api/org/projects/${projectId}/qc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_name: areaName.trim(),
        items: defaultItems,
        status: 'draft',
      }),
    })
    if (res.ok) {
      await load()
      setShowForm(false)
      setAreaName('')
    }
    setCreating(false)
  }

  const toggleItem = async (checklist: QcChecklist, itemId: string) => {
    const updatedItems = checklist.items.map(item =>
      item.id === itemId ? { ...item, passed: !item.passed } : item
    )
    await fetch(`/api/org/projects/${projectId}/qc?qc_id=${checklist.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: updatedItems }),
    })
    await load()
  }

  const updateStatus = async (checklist: QcChecklist, status: string) => {
    await fetch(`/api/org/projects/${projectId}/qc?qc_id=${checklist.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const approvedCount = checklists.filter(c => c.status === 'approved').length
  const totalCount = checklists.length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">QC Checklists</h3>
          <p className="text-xs text-muted-foreground">
            {approvedCount}/{totalCount} areas approved
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New Checklist
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold">New QC Checklist</h4>
          <input
            value={areaName}
            onChange={e => setAreaName(e.target.value)}
            placeholder="Area name (e.g. Floor 1 - East Wing)..."
            className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
            autoFocus
          />
          <p className="text-[10px] text-muted-foreground">A default 9-item checklist will be created. Items can be customized.</p>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!areaName.trim() || creating}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty */}
      {checklists.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <ClipboardCheck className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm">No QC checklists</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create checklists per area for quality verification</p>
        </div>
      )}

      {/* Checklists */}
      {checklists.map(cl => {
        const expanded = expandedId === cl.id
        const passedCount = cl.items.filter(i => i.passed).length
        const totalItems = cl.items.length
        const pct = totalItems > 0 ? Math.round((passedCount / totalItems) * 100) : 0

        return (
          <div key={cl.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpandedId(expanded ? null : cl.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{cl.area_name || 'Unnamed Area'}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${STATUS_COLORS[cl.status]}`}>
                    {cl.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{passedCount}/{totalItems}</span>
                </div>
              </div>
            </button>

            {expanded && (
              <div className="border-t border-border px-4 py-3 space-y-2">
                {/* Checklist Items */}
                {cl.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleItem(cl, item.id)}
                      className={`flex-shrink-0 ${item.passed ? 'text-emerald-500' : 'text-muted-foreground/40'}`}
                    >
                      {item.passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </button>
                    <span className={`text-xs ${item.passed ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}

                {/* Corrective Actions */}
                {cl.corrective_actions.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">Corrective Actions</p>
                    {cl.corrective_actions.map(ca => (
                      <div key={ca.id} className="flex items-center gap-2 text-xs text-foreground">
                        <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        <span>{ca.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Status Actions */}
                <div className="flex items-center gap-2 pt-2">
                  {cl.status === 'draft' && (
                    <button
                      onClick={() => updateStatus(cl, 'in_progress')}
                      className="rounded-md border border-border px-2.5 py-1 text-[10px] font-medium hover:bg-accent"
                    >
                      Start QC
                    </button>
                  )}
                  {(cl.status === 'in_progress' || cl.status === 'draft') && (
                    <button
                      onClick={() => updateStatus(cl, 'submitted')}
                      className="rounded-md bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-200"
                    >
                      Submit for Review
                    </button>
                  )}
                  {cl.status === 'submitted' && (
                    <>
                      <button
                        onClick={() => updateStatus(cl, 'approved')}
                        className="rounded-md bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-200"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(cl, 'failed')}
                        className="rounded-md bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-800 hover:bg-red-200"
                      >
                        Fail
                      </button>
                    </>
                  )}
                  {cl.status === 'failed' && (
                    <button
                      onClick={() => updateStatus(cl, 'in_progress')}
                      className="rounded-md border border-border px-2.5 py-1 text-[10px] font-medium hover:bg-accent"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
