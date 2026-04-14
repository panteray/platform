'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle2, Clock, Circle, ArrowRight } from 'lucide-react'
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

export function ChangeOrderField({ projectId }: Props) {
  const [cos, setCos] = useState<ChangeOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/change-orders`)
    if (res.ok) setCos(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const acknowledge = async (co: ChangeOrder) => {
    const res = await fetch(`/api/org/projects/${projectId}/change-orders?co_id=${co.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'field_acknowledged' }),
    })
    if (res.ok) await load()
  }

  const stepIdx = (status: string) => CO_STEPS.indexOf(status as typeof CO_STEPS[number])

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const injectedCOs = cos.filter(c => c.status === 'injected')
  const otherCOs = cos.filter(c => c.status !== 'injected')

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-foreground">Change Orders</h2>
        <p className="text-[10px] text-muted-foreground">
          {cos.length} total · {injectedCOs.length} need acknowledgment
        </p>
      </div>

      {/* Injected Alert */}
      {injectedCOs.length > 0 && (
        <div className="space-y-2">
          {injectedCOs.map(co => (
            <div key={co.id} className="rounded-lg border-2 border-orange-300 bg-orange-50 p-3">
              <div className="flex items-center gap-1 mb-1.5 text-[10px] font-bold text-orange-700">
                <AlertTriangle className="h-3 w-3" /> Injected CO — Acknowledge Required
              </div>
              <p className="text-xs font-semibold text-foreground">{co.co_number} — {co.title}</p>
              {co.description && <p className="text-[10px] text-foreground/80 mt-0.5">{co.description}</p>}
              <div className="flex items-center gap-2 mt-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${co.type === 'major' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                  {co.type.toUpperCase()}
                </span>
                {co.cost_impact !== 0 && (
                  <span className="text-[10px] font-bold text-red-600">${Math.abs(co.cost_impact ?? 0).toLocaleString()}</span>
                )}
              </div>
              <button
                onClick={() => acknowledge(co)}
                className="mt-2 w-full rounded-md bg-orange-600 py-2 text-xs font-bold text-white hover:bg-orange-700"
              >
                Acknowledge CO
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Other COs */}
      {cos.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <RefreshCw className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs">No change orders</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            COs are created from deviation reports or by PM
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {otherCOs.map(co => {
            const current = stepIdx(co.status)

            return (
              <div key={co.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-primary">{co.co_number}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${co.type === 'major' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {co.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs font-medium text-foreground mt-0.5">{co.title}</p>

                {/* Step Progress */}
                <div className="mt-2 flex items-center gap-0.5">
                  {CO_STEPS.map((step, idx) => (
                    <div key={step} className="flex items-center">
                      {idx < current ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : idx === current ? (
                        <Clock className="h-3 w-3 text-primary" />
                      ) : (
                        <Circle className="h-3 w-3 text-muted-foreground/30" />
                      )}
                      {idx < CO_STEPS.length - 1 && (
                        <div className={`h-px w-3 ${idx < current ? 'bg-emerald-500' : 'bg-muted'}`} />
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Step {current + 1}/9: {STEP_LABELS[co.status]}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
