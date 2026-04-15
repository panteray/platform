'use client'

// MyDaySchedule — tech's "My Day" list. Groups tickets assigned to current user by
// change_window_start (today vs next 7 days). Status + priority chips. Tap → ticket detail.
// Data source: /api/org/psa/tickets?mine=1

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, AlertCircle, ChevronRight, Calendar, Loader2 } from 'lucide-react'
import type { PsaTicket, PsaTicketStatus, PsaPriority } from '@/types/database'

type Ticket = PsaTicket & {
  customer?: { id: string; name: string } | null
}

const PRIORITY_COLORS: Record<PsaPriority, string> = {
  P1: 'bg-red-600 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-amber-400 text-amber-900',
  P4: 'bg-blue-400 text-white',
  P5: 'bg-neutral-300 text-neutral-700',
}

const STATUS_LABEL: Record<PsaTicketStatus, string> = {
  NEW: 'New', OPEN: 'Open', SCHEDULED: 'Scheduled', EN_ROUTE: 'En Route',
  ON_SITE: 'On Site', WORK_IN_PROGRESS: 'WIP',
  WAITING_ON_CUSTOMER: 'Waiting', WAITING_ON_PARTS: 'Parts',
  WAITING_ON_VENDOR: 'Vendor', WAITING_ON_SITE_ACCESS: 'Access',
  NEEDS_RMA: 'RMA', COMPLETED: 'Completed', RESOLVED: 'Resolved', CANCELLED: 'Cancelled',
}

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export function MyDaySchedule() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(false)

  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/org/psa/tickets?mine=1')
      if (res.ok) {
        const data = await res.json()
        setTickets(Array.isArray(data) ? data : data.tickets ?? [])
      }
      setLoading(false)
    })()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-neutral-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading schedule…
      </div>
    )
  }

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const weekEnd = endOfDay(addDays(now, 7))

  // Bucket: Today (has window starting today OR active and no window), Upcoming (next 7 days)
  const active: Ticket[] = []
  const today: Ticket[] = []
  const upcoming: Ticket[] = []
  const overdue: Ticket[] = []

  for (const t of tickets) {
    if (t.status === 'RESOLVED' || t.status === 'CANCELLED') continue
    if (t.status === 'EN_ROUTE' || t.status === 'ON_SITE' || t.status === 'WORK_IN_PROGRESS') {
      active.push(t)
      continue
    }
    const ws = t.change_window_start ? new Date(t.change_window_start) : null
    if (!ws) {
      today.push(t) // no scheduled window → treat as today work
      continue
    }
    if (ws < todayStart) overdue.push(t)
    else if (ws <= todayEnd) today.push(t)
    else if (ws <= weekEnd) upcoming.push(t)
  }

  // Sort by priority then scheduled time
  const prioRank: Record<PsaPriority, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 }
  const sorter = (a: Ticket, b: Ticket) => {
    const p = prioRank[a.priority] - prioRank[b.priority]
    if (p !== 0) return p
    const ta = a.change_window_start ? new Date(a.change_window_start).getTime() : 0
    const tb = b.change_window_start ? new Date(b.change_window_start).getTime() : 0
    return ta - tb
  }
  active.sort(sorter); today.sort(sorter); upcoming.sort(sorter); overdue.sort(sorter)

  return (
    <div className="space-y-6">
      {/* Active work — what the tech is doing right now */}
      {active.length > 0 && (
        <Section
          title="In Progress"
          accent="emerald"
          icon={<Clock className="w-4 h-4" />}
          count={active.length}
        >
          {active.map(t => <TicketCard key={t.id} ticket={t} />)}
        </Section>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <Section
          title="Overdue"
          accent="red"
          icon={<AlertCircle className="w-4 h-4" />}
          count={overdue.length}
        >
          {overdue.map(t => <TicketCard key={t.id} ticket={t} overdue />)}
        </Section>
      )}

      {/* Today */}
      <Section
        title="Today"
        accent="blue"
        icon={<Calendar className="w-4 h-4" />}
        count={today.length}
      >
        {today.length === 0 ? (
          <div className="text-sm text-neutral-500 py-4 text-center">Nothing scheduled for today</div>
        ) : (
          today.map(t => <TicketCard key={t.id} ticket={t} />)
        )}
      </Section>

      {/* Upcoming (next 7 days) — collapsed by default */}
      {upcoming.length > 0 && (
        <div>
          <button
            onClick={() => setShowUpcoming(!showUpcoming)}
            className="w-full flex items-center justify-between px-1 py-2 text-left text-sm font-semibold text-neutral-700 hover:text-neutral-900"
          >
            <span>Next 7 Days ({upcoming.length})</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${showUpcoming ? 'rotate-90' : ''}`} />
          </button>
          {showUpcoming && (
            <div className="space-y-2 mt-2">
              {upcoming.map(t => <TicketCard key={t.id} ticket={t} showDay />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  title, accent, icon, count, children,
}: {
  title: string
  accent: 'blue' | 'emerald' | 'red' | 'neutral'
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  const accentClass = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    red: 'text-red-600',
    neutral: 'text-neutral-600',
  }[accent]
  return (
    <div>
      <div className={`flex items-center gap-2 mb-3 text-sm font-semibold ${accentClass}`}>
        {icon}
        <span className="uppercase tracking-wide text-xs">{title}</span>
        <span className="text-neutral-400 font-normal">({count})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function TicketCard({ ticket, overdue, showDay }: { ticket: Ticket; overdue?: boolean; showDay?: boolean }) {
  const borderClass = overdue ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-white hover:border-neutral-400'
  return (
    <Link
      href={`/org/psa/tickets/${ticket.id}`}
      className={`block border rounded-lg p-3 transition ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[ticket.priority]}`}>
              {ticket.priority}
            </span>
            <span className="font-mono text-[10px] text-neutral-400">{ticket.ticket_number}</span>
            <span className="text-[10px] uppercase text-neutral-500 font-semibold">
              {STATUS_LABEL[ticket.status]}
            </span>
          </div>
          <div className="text-sm font-medium text-neutral-900 truncate">{ticket.title}</div>
          {ticket.customer && (
            <div className="text-xs text-neutral-500 truncate mt-0.5">{ticket.customer.name}</div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          {ticket.change_window_start && (
            <div className="text-xs text-neutral-600 font-medium">
              {showDay ? fmtDay(ticket.change_window_start) : fmtTime(ticket.change_window_start)}
            </div>
          )}
          <ChevronRight className="w-4 h-4 text-neutral-300 inline-block mt-1" />
        </div>
      </div>
    </Link>
  )
}
