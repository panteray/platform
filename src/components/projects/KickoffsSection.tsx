'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, CalendarPlus } from 'lucide-react'
import type { MeetingMinutes } from '@/types/database'

interface Props {
  projectId: string
  onOpenMeetings?: () => void
}

/** Compact IKOM / CKOM tracker shown above the project tabs.
 *  Full meeting detail lives in the Meetings tab — this is the at-a-glance
 *  kickoff state with quick schedule / mark-held actions. */
export function KickoffsSection({ projectId, onOpenMeetings }: Props) {
  const [meetings, setMeetings] = useState<MeetingMinutes[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/meetings?type=ikom,ckom`)
    if (res.ok) setMeetings(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function quickCreate(type: 'ikom' | 'ckom') {
    setError(null)
    const res = await fetch(`/api/org/projects/${projectId}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_type: type,
        title: type === 'ikom' ? 'Internal Kickoff Meeting' : 'Customer Kickoff Meeting',
        meeting_date: new Date().toISOString(),
      }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to create kickoff'); return }
    load()
  }

  async function markHeld(m: MeetingMinutes) {
    setError(null)
    const res = await fetch(`/api/org/projects/${projectId}/meetings/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_held: true }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to mark held'); return }
    load()
  }

  if (loading) return null

  const ikom = meetings.find((m) => m.meeting_type === 'ikom')
  const ckom = meetings.find((m) => m.meeting_type === 'ckom')

  function Row({ label, meeting, type }: { label: string; meeting: MeetingMinutes | undefined; type: 'ikom' | 'ckom' }) {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold w-12 shrink-0">{label}</span>
          {meeting ? (
            <>
              <span className="text-xs text-muted-foreground truncate">{new Date(meeting.meeting_date).toLocaleString()}</span>
              {meeting.held_at
                ? <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 shrink-0">Held</span>
                : <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 shrink-0">Scheduled</span>}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Not scheduled</span>
          )}
        </div>
        <div className="shrink-0">
          {meeting && !meeting.held_at && (
            <button onClick={() => markHeld(meeting)} className="inline-flex items-center gap-1 h-6 rounded-md bg-emerald-600 px-2 text-[11px] font-medium text-white hover:bg-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Mark Held
            </button>
          )}
          {!meeting && (
            <button onClick={() => quickCreate(type)} className="inline-flex items-center gap-1 h-6 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted">
              <CalendarPlus className="h-3 w-3" /> Schedule
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Kickoffs</p>
        {onOpenMeetings && (
          <button onClick={onOpenMeetings} className="text-[11px] text-primary hover:underline">All meetings →</button>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Row label="IKOM" meeting={ikom} type="ikom" />
      <Row label="CKOM" meeting={ckom} type="ckom" />
    </div>
  )
}
