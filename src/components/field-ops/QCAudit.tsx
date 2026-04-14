'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardCheck, Camera, CheckCircle2, XCircle, Plus, Loader2 } from 'lucide-react'
import type { QcChecklist } from '@/types/database'

interface Props { projectId: string }

export function QCAudit({ projectId }: Props) {
  const [checklists, setChecklists] = useState<QcChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/qc`)
    if (res.ok) {
      const data = await res.json()
      setChecklists(data)
      if (data.length > 0 && !activeId) setActiveId(data[0].id)
    }
    setLoading(false)
  }, [projectId, activeId])

  useEffect(() => { load() }, [load])

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

  const submitChecklist = async (id: string) => {
    await fetch(`/api/org/projects/${projectId}/qc?qc_id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'submitted' }),
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

  const active = checklists.find(c => c.id === activeId)
  const passedCount = active?.items.filter(i => i.passed).length ?? 0
  const totalItems = active?.items.length ?? 0

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-foreground">QC Audit</h2>
        <p className="text-[10px] text-muted-foreground">
          {checklists.length} checklists · Verify installation quality
        </p>
      </div>

      {/* Area Tabs */}
      {checklists.length > 0 && (
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {checklists.map(cl => {
            const pct = cl.items.length > 0 ? Math.round((cl.items.filter(i => i.passed).length / cl.items.length) * 100) : 0
            return (
              <button
                key={cl.id}
                onClick={() => setActiveId(cl.id)}
                className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-colors ${
                  activeId === cl.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {cl.area_name || 'Area'} ({pct}%)
              </button>
            )
          })}
        </div>
      )}

      {/* Active Checklist */}
      {active ? (
        <div className="space-y-2">
          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${passedCount === totalItems ? 'bg-emerald-500' : 'bg-primary'}`}
                style={{ width: `${totalItems > 0 ? (passedCount / totalItems) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">{passedCount}/{totalItems}</span>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
              active.status === 'approved' ? 'bg-emerald-100 text-emerald-700'
              : active.status === 'submitted' ? 'bg-amber-100 text-amber-700'
              : active.status === 'failed' ? 'bg-red-100 text-red-700'
              : 'bg-blue-100 text-blue-700'
            }`}>
              {active.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>

          {/* Items */}
          <div className="space-y-1">
            {active.items.map(item => (
              <button
                key={item.id}
                onClick={() => toggleItem(active, item.id)}
                className="w-full flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
              >
                {item.passed
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  : <XCircle className="h-5 w-5 text-muted-foreground/30 flex-shrink-0" />}
                <span className={`text-xs ${item.passed ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {/* Photo Capture */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-4 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors">
              <Camera className="h-5 w-5 text-muted-foreground/40 mb-0.5" />
              <span className="text-[9px] font-medium text-muted-foreground">Before Photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" />
            </label>
            <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-4 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors">
              <Camera className="h-5 w-5 text-muted-foreground/40 mb-0.5" />
              <span className="text-[9px] font-medium text-muted-foreground">After Photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" />
            </label>
          </div>

          {/* Submit */}
          {(active.status === 'draft' || active.status === 'in_progress') && (
            <button
              onClick={() => submitChecklist(active.id)}
              disabled={passedCount === 0}
              className="w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Submit for PM Review
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <ClipboardCheck className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs">No QC checklists assigned</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            PM creates checklists from the project detail page
          </p>
        </div>
      )}
    </div>
  )
}
