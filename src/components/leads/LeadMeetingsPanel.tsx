'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Calendar, MapPin, Clock, Trash2, MoreHorizontal } from 'lucide-react'
import { LeadMeetingForm } from './LeadMeetingForm'
import type { LeadMeeting } from '@/types/database'

interface LeadMeetingsPanelProps {
  leadId: string
  disabled?: boolean
}

export function LeadMeetingsPanel({ leadId, disabled }: LeadMeetingsPanelProps) {
  const [meetings, setMeetings] = useState<LeadMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/org/leads/${leadId}/meetings`)
    if (res.ok) {
      const data = await res.json()
      setMeetings(data)
    }
    setLoading(false)
  }, [leadId])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  async function handleDelete(meetingId: string) {
    if (!confirm('Delete this meeting?')) return
    const res = await fetch(`/api/org/leads/${leadId}/meetings?meetingId=${meetingId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId))
    }
  }

  function handleSaved() {
    setShowForm(false)
    fetchMeetings()
  }

  const now = new Date()

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Meetings</h3>
        {!disabled && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Plus className="h-3 w-3" /> Schedule Meeting
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4">
          <LeadMeetingForm
            leadId={leadId}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {loading ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Loading meetings...</p>
      ) : meetings.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No meetings scheduled.{!disabled && ' Click "Schedule Meeting" to add one.'}
        </p>
      ) : (
        <div className="space-y-2">
          {meetings.map((meeting) => {
            const start = new Date(meeting.start_time)
            const end = new Date(meeting.end_time)
            const isPast = end < now
            const isToday = start.toDateString() === now.toDateString()

            return (
              <div
                key={meeting.id}
                className={`relative rounded-md border px-3 py-2.5 ${
                  isPast
                    ? 'border-border/50 bg-muted/20 opacity-70'
                    : isToday
                      ? 'border-blue-500/30 bg-blue-500/5'
                      : 'border-border bg-background'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <span className="text-sm font-medium text-foreground truncate">
                        {meeting.title}
                      </span>
                      {isToday && !isPast && (
                        <span className="shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                          TODAY
                        </span>
                      )}
                      {isPast && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          PAST
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {start.toLocaleDateString()} {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' — '}
                        {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {meeting.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {meeting.location}
                        </span>
                      )}
                    </div>

                    {meeting.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{meeting.description}</p>
                    )}

                    {meeting.outcome && (
                      <p className="mt-1 text-xs">
                        <span className="font-medium text-muted-foreground">Outcome:</span>{' '}
                        <span className="text-foreground">{meeting.outcome}</span>
                      </p>
                    )}
                  </div>

                  {!disabled && (
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setMenuOpen(menuOpen === meeting.id ? null : meeting.id)}
                        className="rounded p-1 hover:bg-muted"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      {menuOpen === meeting.id && (
                        <div className="absolute right-0 z-10 mt-1 w-28 rounded-md border border-border bg-card py-1 shadow-md">
                          <button
                            onClick={() => { handleDelete(meeting.id); setMenuOpen(null) }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-muted"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
