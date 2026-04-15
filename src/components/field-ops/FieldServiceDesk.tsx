'use client'

import { useEffect, useState, useCallback } from 'react'
import { Headset, Plus, AlertCircle, Clock, CheckCircle2, CalendarDays, Loader2 } from 'lucide-react'

interface Props { projectId: string }

/**
 * Field Service Desk — PSA Ticket View
 *
 * Real-time tickets wired to /api/org/psa/tickets. Shows:
 *  • Today's Schedule — mine=1 tickets with change_window_start today
 *  • Project Tickets — all tickets on this project
 *  • Quick create — POST with project_id + vertical=SVC
 */

type Priority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
type Status =
  | 'NEW' | 'OPEN' | 'SCHEDULED' | 'EN_ROUTE' | 'ON_SITE' | 'WORK_IN_PROGRESS'
  | 'WAITING_ON_CUSTOMER' | 'WAITING_ON_PARTS' | 'WAITING_ON_VENDOR'
  | 'WAITING_ON_SITE_ACCESS' | 'NEEDS_RMA' | 'COMPLETED' | 'RESOLVED' | 'CANCELLED'

interface Ticket {
  id: string
  title: string
  description: string | null
  priority: Priority
  status: Status
  vertical: string
  project_id: string | null
  change_window_start: string | null
  change_window_end: string | null
  assigned_to: string | null
  created_at: string
}

const PRIORITY_COLORS: Record<Priority, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-blue-100 text-blue-700',
  P4: 'bg-neutral-100 text-neutral-600',
  P5: 'bg-neutral-100 text-neutral-500',
}

const RESOLVED_STATES: Status[] = ['COMPLETED', 'RESOLVED', 'CANCELLED']
const IN_PROGRESS_STATES: Status[] = ['EN_ROUTE', 'ON_SITE', 'WORK_IN_PROGRESS']

function isToday(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

export function FieldServiceDesk({ projectId }: Props) {
  const [projectTickets, setProjectTickets] = useState<Ticket[]>([])
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('P3')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [projRes, mineRes] = await Promise.all([
        fetch(`/api/org/psa/tickets?project_id=${encodeURIComponent(projectId)}`),
        fetch(`/api/org/psa/tickets?mine=1`),
      ])
      if (!projRes.ok) throw new Error(`Project tickets: ${projRes.status}`)
      if (!mineRes.ok) throw new Error(`My tickets: ${mineRes.status}`)
      setProjectTickets(await projRes.json())
      setMyTickets(await mineRes.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/org/psa/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          vertical: 'SVC',
          ticket_type: 'INCIDENT',
          project_id: projectId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setTitle('')
      setDescription('')
      setPriority('P3')
      setShowCreate(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create ticket')
    } finally {
      setSubmitting(false)
    }
  }

  // Today's schedule = my tickets with change_window_start today
  const todaySchedule = myTickets
    .filter(t => isToday(t.change_window_start))
    .sort((a, b) => (a.change_window_start || '').localeCompare(b.change_window_start || ''))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Service Desk</h2>
          <p className="text-[10px] text-muted-foreground">Today&apos;s schedule and project tickets</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3 w-3" /> New Ticket
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Issue title..."
            className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as Priority)}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
            >
              <option value="P1">P1 — Critical</option>
              <option value="P2">P2 — High</option>
              <option value="P3">P3 — Medium</option>
              <option value="P4">P4 — Low</option>
              <option value="P5">P5 — Planning</option>
            </select>
          </div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue..."
            rows={3}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!title.trim() || submitting}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-xs text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <>
          {/* Today's Schedule */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground">Today&apos;s Schedule</h3>
              <span className="text-[10px] text-muted-foreground">({todaySchedule.length})</span>
            </div>
            {todaySchedule.length === 0 ? (
              <p className="text-[10px] text-muted-foreground pl-5">Nothing scheduled for today</p>
            ) : (
              <div className="space-y-1">
                {todaySchedule.map(t => <TicketRow key={t.id} ticket={t} showTime />)}
              </div>
            )}
          </div>

          {/* Project Tickets */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Headset className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground">Project Tickets</h3>
              <span className="text-[10px] text-muted-foreground">({projectTickets.length})</span>
            </div>
            {projectTickets.length === 0 ? (
              <p className="text-[10px] text-muted-foreground pl-5">No tickets on this project</p>
            ) : (
              <div className="space-y-1">
                {projectTickets.map(t => <TicketRow key={t.id} ticket={t} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TicketRow({ ticket, showTime }: { ticket: Ticket; showTime?: boolean }) {
  const isResolved = RESOLVED_STATES.includes(ticket.status)
  const isInProgress = IN_PROGRESS_STATES.includes(ticket.status)
  const timeLabel = showTime && ticket.change_window_start
    ? new Date(ticket.change_window_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : new Date(ticket.created_at).toLocaleDateString()

  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
      {isResolved ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
      ) : isInProgress ? (
        <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{ticket.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {timeLabel} · {ticket.status.replace(/_/g, ' ').toLowerCase()}
        </p>
      </div>
      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${PRIORITY_COLORS[ticket.priority]}`}>
        {ticket.priority}
      </span>
    </div>
  )
}
