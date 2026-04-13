'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowRight, Clock, Pause, XCircle } from 'lucide-react'
import { OppStatusBadge } from './OppStatusBadge'

interface HistoryEntry {
  id: string
  previous_status: string | null
  new_status: string
  changed_by: string | null
  changed_by_name: string | null
  on_hold_reason: string | null
  decline_reason: string | null
  created_at: string
}

interface OppStatusTimelineProps {
  oppId: string
}

export function OppStatusTimeline({ oppId }: OppStatusTimelineProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/org/opportunities/${oppId}/history`)
    if (res.ok) setHistory(await res.json())
    setLoading(false)
  }, [oppId])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  if (loading) {
    return <p className="py-4 text-center text-xs text-muted-foreground">Loading history...</p>
  }

  if (history.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No status changes recorded.</p>
  }

  return (
    <div className="space-y-0">
      {/* Timeline line */}
      <div className="relative">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

        {history.map((entry) => {
          const date = new Date(entry.created_at)
          const isOnHold = entry.new_status === 'ON_HOLD'
          const isClosed = entry.new_status === 'CLOSED'
          const isInitial = !entry.previous_status

          return (
            <div key={entry.id} className="relative flex gap-3 py-2.5">
              {/* Icon dot */}
              <div
                className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ${
                  isOnHold
                    ? 'bg-amber-500/15 text-amber-500'
                    : isClosed
                      ? 'bg-red-500/15 text-red-500'
                      : isInitial
                        ? 'bg-blue-500/15 text-blue-500'
                        : 'bg-primary/15 text-primary'
                }`}
              >
                {isOnHold ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : isClosed ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.previous_status && (
                    <>
                      <OppStatusBadge status={entry.previous_status} />
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    </>
                  )}
                  <OppStatusBadge status={entry.new_status} />
                </div>

                {entry.on_hold_reason && (
                  <p className="mt-1 text-xs text-amber-600">
                    Reason: {entry.on_hold_reason}
                  </p>
                )}
                {entry.decline_reason && (
                  <p className="mt-1 text-xs text-red-500">
                    Decline: {entry.decline_reason}
                  </p>
                )}

                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {entry.changed_by_name && (
                    <span>by <span className="font-medium text-foreground/70">{entry.changed_by_name}</span></span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
