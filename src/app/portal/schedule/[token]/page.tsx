'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Calendar, Clock, CheckCircle2, AlertCircle, User } from 'lucide-react'

type Slot = {
  tech_id: string
  tech_name: string
  date: string
  start: string
  end: string
}

interface TicketInfo {
  id: string
  ticket_number: string
  title: string
  description: string | null
  priority: string
  vertical: string
  customer: { id: string; name: string } | null
}

function fmtDay(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function CustomerSchedulePortalPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token

  const [ticket, setTicket] = useState<TicketInfo | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Slot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (!token) return
    ;(async () => {
      const res = await fetch(`/api/portal/schedule/${token}`)
      if (!res.ok) {
        setError((await res.json()).error ?? 'Unable to load scheduling link')
        setLoading(false)
        return
      }
      const data = await res.json()
      setTicket(data.ticket)
      setSlots(data.slots ?? [])
      setNote(data.note ?? null)
      setLoading(false)
    })()
  }, [token])

  const slotsByDate = useMemo(() => {
    const m = new Map<string, Slot[]>()
    for (const s of slots) {
      const arr = m.get(s.date) ?? []
      arr.push(s)
      m.set(s.date, arr)
    }
    // sort each day by start
    for (const [, arr] of m) arr.sort((a, b) => a.start.localeCompare(b.start))
    return m
  }, [slots])

  async function submit() {
    if (!picked) return
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/portal/schedule/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tech_id: picked.tech_id,
        date: picked.date,
        start: picked.start,
        end: picked.end,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to confirm appointment')
      return
    }
    setConfirmed(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-500">Loading…</div>
      </div>
    )
  }

  if (error && !ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-lg p-6 shadow-sm text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <div className="font-semibold text-red-700 mb-1">Link Unavailable</div>
          <div className="text-sm text-neutral-600">{error}</div>
        </div>
      </div>
    )
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
        <div className="max-w-md w-full bg-white border border-emerald-200 rounded-lg p-8 shadow-sm text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <div className="font-semibold text-emerald-700 text-lg mb-2">Appointment Confirmed</div>
          {picked && (
            <div className="text-sm text-neutral-700 space-y-1 mt-4">
              <div className="font-medium">{fmtDay(picked.date)}</div>
              <div>{fmtTime(picked.start)} – {fmtTime(picked.end)}</div>
              <div className="text-neutral-500 mt-2">with {picked.tech_name}</div>
            </div>
          )}
          <div className="text-xs text-neutral-500 mt-6">
            You&apos;ll receive a confirmation shortly. Thank you.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-white border border-neutral-200 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
            <div className="text-xs uppercase tracking-wider opacity-80 mb-1">Schedule your service</div>
            <div className="text-2xl font-semibold">{ticket?.title}</div>
            {ticket?.customer && (
              <div className="text-sm opacity-90 mt-1">{ticket.customer.name} · {ticket.ticket_number}</div>
            )}
          </div>

          <div className="p-6">
            {ticket?.description && (
              <div className="text-sm text-neutral-600 border-l-2 border-neutral-200 pl-3 mb-6">
                {ticket.description}
              </div>
            )}

            {note && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded p-3 mb-4 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {note}
              </div>
            )}

            {slots.length === 0 && !note && (
              <div className="text-sm text-neutral-500 text-center py-8">
                No availability in the next 5 business days. Please contact us to schedule.
              </div>
            )}

            {slots.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-3">
                  <Calendar className="w-4 h-4" />
                  Pick a time that works for you
                </div>

                <div className="space-y-5">
                  {Array.from(slotsByDate.entries()).map(([date, daySlots]) => (
                    <div key={date}>
                      <div className="text-sm font-semibold text-neutral-800 mb-2">{fmtDay(date)}</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {daySlots.map((s, i) => {
                          const isPicked = picked?.start === s.start && picked?.tech_id === s.tech_id
                          return (
                            <button
                              key={`${date}-${s.tech_id}-${i}`}
                              onClick={() => setPicked(s)}
                              className={`text-left px-3 py-2 rounded border text-sm transition ${
                                isPicked
                                  ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                                  : 'border-neutral-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                              }`}
                            >
                              <div className="flex items-center gap-1 font-medium">
                                <Clock className="w-3 h-3" />
                                {fmtTime(s.start)}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
                                <User className="w-3 h-3" />
                                {s.tech_name}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="mt-4 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-4">
                  <div className="text-sm text-neutral-600">
                    {picked ? (
                      <>
                        <span className="font-medium">{fmtDay(picked.date)}</span> · {fmtTime(picked.start)} – {fmtTime(picked.end)}
                      </>
                    ) : (
                      <span className="text-neutral-400">No time selected</span>
                    )}
                  </div>
                  <button
                    disabled={!picked || submitting}
                    onClick={submit}
                    className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Confirming…' : 'Confirm Appointment'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
