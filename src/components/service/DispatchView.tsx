'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Calendar, LayoutGrid, Clock, User, ChevronLeft, ChevronRight,
  AlertCircle, Truck, MapPin, CheckCircle2, X, Link2,
} from 'lucide-react'
import type {
  PsaDispatchAssignment, PsaDispatchStatus, PsaTicket, PsaPriority, PsaVertical,
} from '@/types/database'
import { missingSkills } from '@/lib/psa-skills'

type TechUser = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
  skills: { id: string; skill: string; proficiency: string }[]
  availability: { id: string; day_of_week: number; start_time: string; end_time: string }[]
}

type AssignmentWithRefs = PsaDispatchAssignment & {
  ticket?: (Pick<PsaTicket, 'id' | 'ticket_number' | 'title' | 'priority' | 'status' | 'vertical'> & {
    customer?: { id: string; name: string } | null
  }) | null
  tech?: { id: string; first_name: string | null; last_name: string | null; email: string } | null
}

type UnassignedTicket = Pick<PsaTicket, 'id' | 'ticket_number' | 'title' | 'priority' | 'status' | 'vertical' | 'required_skills'> & {
  customer?: { id: string; name: string; state?: string | null } | null
}

interface ComplianceCheck {
  eligible: boolean
  warnings: string[]
  blockers: string[]
}

const PRIORITY_COLORS: Record<PsaPriority, string> = {
  P1: 'bg-red-600 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-amber-400 text-amber-900',
  P4: 'bg-blue-400 text-white',
  P5: 'bg-neutral-300 text-neutral-700',
}

const DISPATCH_STATUS_CONFIG: Record<PsaDispatchStatus, { label: string; color: string; icon: typeof Clock }> = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Calendar },
  en_route:  { label: 'En Route',  color: 'bg-cyan-100 text-cyan-700 border-cyan-200',  icon: Truck },
  on_site:   { label: 'On Site',   color: 'bg-teal-100 text-teal-700 border-teal-200',  icon: MapPin },
  wip:       { label: 'WIP',       color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-200',     icon: X },
}

const VERTICAL_LABELS: Record<PsaVertical, string> = {
  SEC: 'SEC', NET: 'NET', AV: 'AV', MSP: 'MSP', CYB: 'CYB', SVC: 'SVC', INT: 'INT',
}

function techName(t: { first_name: string | null; last_name: string | null; email: string } | null | undefined) {
  if (!t) return '—'
  const n = `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim()
  return n || t.email
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function fmtDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

type View = 'card' | 'schedule' | 'planner'

export default function DispatchView() {
  const [date, setDate] = useState(todayISO())
  const [view, setView] = useState<View>('card')
  const [techs, setTechs] = useState<TechUser[]>([])
  const [assignments, setAssignments] = useState<AssignmentWithRefs[]>([])
  const [unassigned, setUnassigned] = useState<UnassignedTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTech, setSelectedTech] = useState<string | null>(null)
  const [editingAssignment, setEditingAssignment] = useState<AssignmentWithRefs | null>(null)
  const [showAssignTicket, setShowAssignTicket] = useState<UnassignedTicket | null>(null)
  const [scheduleLinkStatus, setScheduleLinkStatus] = useState<{ ticketId: string; message: string } | null>(null)

  async function sendScheduleLink(ticket: UnassignedTicket) {
    setScheduleLinkStatus({ ticketId: ticket.id, message: 'Generating…' })
    try {
      const res = await fetch(`/api/org/psa/tickets/${ticket.id}/schedule-link`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setScheduleLinkStatus({ ticketId: ticket.id, message: data.error ?? 'Failed' })
        setTimeout(() => setScheduleLinkStatus(null), 3000)
        return
      }
      if (data.url && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(data.url)
        setScheduleLinkStatus({ ticketId: ticket.id, message: 'Link copied to clipboard' })
      } else {
        setScheduleLinkStatus({ ticketId: ticket.id, message: data.url ?? 'Link generated' })
      }
      setTimeout(() => setScheduleLinkStatus(null), 3000)
    } catch {
      setScheduleLinkStatus({ ticketId: ticket.id, message: 'Failed' })
      setTimeout(() => setScheduleLinkStatus(null), 3000)
    }
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [techRes, assignRes, unassignedRes] = await Promise.all([
      fetch('/api/org/psa/techs'),
      fetch(`/api/org/psa/dispatch?date=${date}`),
      fetch('/api/org/psa/tickets?status=NEW'),
    ])
    if (techRes.ok) setTechs(await techRes.json())
    if (assignRes.ok) setAssignments(await assignRes.json())
    if (unassignedRes.ok) {
      const all = await unassignedRes.json() as UnassignedTicket[]
      // Also fetch OPEN tickets without an assignment today
      const openRes = await fetch('/api/org/psa/tickets?status=OPEN')
      if (openRes.ok) {
        const opens = await openRes.json() as UnassignedTicket[]
        all.push(...opens)
      }
      setUnassigned(all)
    }
    setLoading(false)
  }, [date])

  useEffect(() => { loadAll() }, [loadAll])

  // DnD helpers
  function onDragStart(e: React.DragEvent, payload: { type: 'ticket'; ticket: UnassignedTicket } | { type: 'assignment'; assignment: AssignmentWithRefs }) {
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  async function onDropOnTech(e: React.DragEvent, techId: string) {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/json')
    if (!data) return
    const payload = JSON.parse(data)
    if (payload.type === 'ticket') {
      // Create new assignment
      await fetch('/api/org/psa/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: payload.ticket.id,
          tech_id: techId,
          scheduled_date: date,
        }),
      })
      loadAll()
    } else if (payload.type === 'assignment') {
      // Reassign to different tech
      if (payload.assignment.tech_id === techId) return
      await fetch(`/api/org/psa/dispatch/${payload.assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tech_id: techId }),
      })
      loadAll()
    }
  }

  async function updateStatus(assignmentId: string, status: PsaDispatchStatus) {
    await fetch(`/api/org/psa/dispatch/${assignmentId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadAll()
  }

  const assignmentsByTech = useMemo(() => {
    const map = new Map<string, AssignmentWithRefs[]>()
    for (const a of assignments) {
      if (!map.has(a.tech_id)) map.set(a.tech_id, [])
      map.get(a.tech_id)!.push(a)
    }
    return map
  }, [assignments])

  // Filter unassigned: tickets that aren't yet on the board for this date
  const assignedTicketIds = new Set(assignments.map(a => a.ticket_id))
  const visibleUnassigned = unassigned.filter(t => !assignedTicketIds.has(t.id))

  return (
    <div className="max-w-[1800px] mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Dispatch Board</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Schedule tickets to field techs</p>
        </div>
        <Link
          href="/org/service/tickets"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Tickets
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border border-neutral-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDate(addDays(date, -1))}
            className="p-1.5 hover:bg-neutral-100 rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 border border-neutral-300 rounded text-sm"
          />
          <button
            onClick={() => setDate(addDays(date, 1))}
            className="p-1.5 hover:bg-neutral-100 rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDate(todayISO())}
            className="ml-1 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 rounded"
          >
            Today
          </button>
          <div className="ml-3 text-sm font-medium text-neutral-700">{fmtDate(date)}</div>
        </div>

        <div className="flex items-center bg-neutral-100 rounded p-0.5">
          <ViewToggle active={view === 'card'}     onClick={() => setView('card')}     icon={<LayoutGrid className="w-4 h-4" />} label="Cards" />
          <ViewToggle active={view === 'schedule'} onClick={() => setView('schedule')} icon={<Clock className="w-4 h-4" />}       label="Schedule" />
          <ViewToggle active={view === 'planner'}  onClick={() => setView('planner')}  icon={<User className="w-4 h-4" />}        label="Planner" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96 text-neutral-500">
          <Clock className="w-5 h-5 animate-spin mr-2" /> Loading dispatch…
        </div>
      ) : (
        <>
          {view === 'card' && (
            <CardView
              techs={techs}
              assignmentsByTech={assignmentsByTech}
              unassigned={visibleUnassigned}
              onDragStart={onDragStart}
              onDropOnTech={onDropOnTech}
              onEditAssignment={setEditingAssignment}
              onUpdateStatus={updateStatus}
              onClickUnassigned={setShowAssignTicket}
              onSendScheduleLink={sendScheduleLink}
              scheduleLinkStatus={scheduleLinkStatus}
            />
          )}
          {view === 'schedule' && (
            <ScheduleView
              techs={techs}
              assignmentsByTech={assignmentsByTech}
              onEditAssignment={setEditingAssignment}
            />
          )}
          {view === 'planner' && (
            <PlannerView
              techs={techs}
              assignments={assignments}
              selectedTech={selectedTech}
              onSelectTech={setSelectedTech}
              onEditAssignment={setEditingAssignment}
              onUpdateStatus={updateStatus}
            />
          )}
        </>
      )}

      {editingAssignment && (
        <EditAssignmentDialog
          assignment={editingAssignment}
          techs={techs}
          onClose={() => setEditingAssignment(null)}
          onSaved={() => { setEditingAssignment(null); loadAll() }}
        />
      )}

      {showAssignTicket && (
        <AssignTicketDialog
          ticket={showAssignTicket}
          techs={techs}
          date={date}
          onClose={() => setShowAssignTicket(null)}
          onSaved={() => { setShowAssignTicket(null); loadAll() }}
        />
      )}
    </div>
  )
}

// ============================================================================
// Card View — kanban columns: unassigned + one per tech
// ============================================================================

function CardView({
  techs, assignmentsByTech, unassigned, onDragStart, onDropOnTech, onEditAssignment, onUpdateStatus, onClickUnassigned,
  onSendScheduleLink, scheduleLinkStatus,
}: {
  techs: TechUser[]
  assignmentsByTech: Map<string, AssignmentWithRefs[]>
  unassigned: UnassignedTicket[]
  onDragStart: (e: React.DragEvent, p: { type: 'ticket'; ticket: UnassignedTicket } | { type: 'assignment'; assignment: AssignmentWithRefs }) => void
  onDropOnTech: (e: React.DragEvent, techId: string) => void
  onEditAssignment: (a: AssignmentWithRefs) => void
  onUpdateStatus: (id: string, status: PsaDispatchStatus) => void
  onClickUnassigned: (t: UnassignedTicket) => void
  onSendScheduleLink: (t: UnassignedTicket) => void
  scheduleLinkStatus: { ticketId: string; message: string } | null
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {/* Unassigned column */}
      <div className="flex-shrink-0 w-72 bg-neutral-50 border border-neutral-200 rounded-lg">
        <div className="p-3 border-b border-neutral-200 bg-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-neutral-900">Unassigned</div>
            <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">{unassigned.length}</span>
          </div>
        </div>
        <div className="p-2 space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto">
          {unassigned.length === 0 ? (
            <div className="text-center text-xs text-neutral-400 py-8">No unassigned tickets</div>
          ) : unassigned.map(t => (
            <div
              key={t.id}
              draggable
              onDragStart={e => onDragStart(e, { type: 'ticket', ticket: t })}
              onClick={() => onClickUnassigned(t)}
              className="bg-white border border-neutral-200 rounded p-2.5 cursor-move hover:border-blue-400 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] text-neutral-500">{t.ticket_number}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[t.priority]}`}>
                  {t.priority}
                </span>
              </div>
              <div className="text-xs font-medium text-neutral-900 line-clamp-2">{t.title}</div>
              {t.customer && (
                <div className="text-[10px] text-neutral-500 mt-1 truncate">{t.customer.name}</div>
              )}
              <div className="flex items-center justify-between mt-1">
                <div className="text-[10px] text-neutral-400">{VERTICAL_LABELS[t.vertical]}</div>
                {(t.priority === 'P4' || t.priority === 'P5') && (
                  <button
                    onClick={e => { e.stopPropagation(); onSendScheduleLink(t) }}
                    className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
                    title="Generate customer self-scheduling link"
                  >
                    <Link2 className="w-3 h-3" />
                    Send link
                  </button>
                )}
              </div>
              {scheduleLinkStatus?.ticketId === t.id && (
                <div className="text-[10px] text-emerald-600 mt-1">{scheduleLinkStatus.message}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Per-tech columns */}
      {techs.length === 0 && (
        <div className="flex-1 bg-white border border-dashed border-neutral-300 rounded-lg p-8 text-center text-sm text-neutral-500">
          No field techs found. Add users with role FIELD_TECH, LEAD, or TECH_SUP.
        </div>
      )}
      {techs.map(tech => {
        const techAssignments = assignmentsByTech.get(tech.id) ?? []
        return (
          <div
            key={tech.id}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDrop={e => onDropOnTech(e, tech.id)}
            className="flex-shrink-0 w-72 bg-neutral-50 border border-neutral-200 rounded-lg"
          >
            <div className="p-3 border-b border-neutral-200 bg-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">{techName(tech)}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">{tech.role}</div>
                </div>
                <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">{techAssignments.length}</span>
              </div>
              {tech.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tech.skills.slice(0, 3).map(s => (
                    <span key={s.id} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] rounded">
                      {s.skill}
                    </span>
                  ))}
                  {tech.skills.length > 3 && <span className="text-[9px] text-neutral-400">+{tech.skills.length - 3}</span>}
                </div>
              )}
            </div>
            <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-260px)] overflow-y-auto">
              {techAssignments.length === 0 ? (
                <div className="text-center text-xs text-neutral-300 py-8">Drop ticket here</div>
              ) : techAssignments.map(a => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  onDragStart={onDragStart}
                  onEdit={() => onEditAssignment(a)}
                  onUpdateStatus={onUpdateStatus}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AssignmentCard({ assignment, onDragStart, onEdit, onUpdateStatus }: {
  assignment: AssignmentWithRefs
  onDragStart: (e: React.DragEvent, p: { type: 'assignment'; assignment: AssignmentWithRefs }) => void
  onEdit: () => void
  onUpdateStatus: (id: string, status: PsaDispatchStatus) => void
}) {
  const cfg = DISPATCH_STATUS_CONFIG[assignment.status]
  const Icon = cfg.icon
  const ticket = assignment.ticket

  const nextStatus: PsaDispatchStatus | null =
    assignment.status === 'scheduled' ? 'en_route' :
    assignment.status === 'en_route'  ? 'on_site' :
    assignment.status === 'on_site'   ? 'wip' :
    assignment.status === 'wip'       ? 'completed' : null

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, { type: 'assignment', assignment })}
      className={`bg-white border rounded p-2.5 cursor-move hover:shadow-sm transition ${cfg.color}`}
    >
      <div className="flex items-center justify-between mb-1">
        <button onClick={onEdit} className="font-mono text-[10px] text-neutral-600 hover:underline">
          {ticket?.ticket_number ?? '—'}
        </button>
        {ticket && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[ticket.priority]}`}>
            {ticket.priority}
          </span>
        )}
      </div>
      <div className="text-xs font-medium text-neutral-900 line-clamp-2">{ticket?.title ?? 'Unknown ticket'}</div>
      {ticket?.customer && (
        <div className="text-[10px] text-neutral-600 mt-1 truncate">{ticket.customer.name}</div>
      )}
      {assignment.scheduled_start && (
        <div className="text-[10px] text-neutral-500 mt-1">
          {new Date(assignment.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {assignment.scheduled_end && ` – ${new Date(assignment.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </div>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-200">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium">
          <Icon className="w-3 h-3" /> {cfg.label}
        </span>
        {nextStatus && (
          <button
            onClick={() => onUpdateStatus(assignment.id, nextStatus)}
            className="text-[10px] text-blue-600 hover:underline font-medium"
          >
            → {DISPATCH_STATUS_CONFIG[nextStatus].label}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Schedule View — horizontal timeline, tech rows, assignment bars
// ============================================================================

const HOUR_START = 6
const HOUR_END = 20
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const PX_PER_HOUR = 80

function ScheduleView({ techs, assignmentsByTech, onEditAssignment }: {
  techs: TechUser[]
  assignmentsByTech: Map<string, AssignmentWithRefs[]>
  onEditAssignment: (a: AssignmentWithRefs) => void
}) {
  const totalWidth = HOURS.length * PX_PER_HOUR

  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth + 200 }}>
          {/* Hour header */}
          <div className="flex sticky top-0 bg-neutral-50 border-b border-neutral-200 z-10">
            <div className="w-48 flex-shrink-0 p-3 text-xs font-semibold text-neutral-700 border-r border-neutral-200">
              Tech
            </div>
            <div className="flex">
              {HOURS.map(h => (
                <div key={h} className="text-xs text-neutral-500 font-mono p-3 border-r border-neutral-100" style={{ width: PX_PER_HOUR }}>
                  {h}:00
                </div>
              ))}
            </div>
          </div>

          {/* Tech rows */}
          {techs.length === 0 && (
            <div className="p-8 text-center text-sm text-neutral-500">No techs available</div>
          )}
          {techs.map(tech => {
            const techAssignments = assignmentsByTech.get(tech.id) ?? []
            return (
              <div key={tech.id} className="flex border-b border-neutral-100 hover:bg-neutral-50">
                <div className="w-48 flex-shrink-0 p-3 border-r border-neutral-200">
                  <div className="text-sm font-medium text-neutral-900">{techName(tech)}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">{tech.role}</div>
                </div>
                <div className="relative flex" style={{ height: 60 }}>
                  {HOURS.map(h => (
                    <div key={h} className="border-r border-neutral-100" style={{ width: PX_PER_HOUR }} />
                  ))}
                  {techAssignments.map(a => {
                    if (!a.scheduled_start) return null
                    const start = new Date(a.scheduled_start)
                    const end = a.scheduled_end ? new Date(a.scheduled_end) : new Date(start.getTime() + 3600000)
                    const startHours = start.getHours() + start.getMinutes() / 60
                    const endHours = end.getHours() + end.getMinutes() / 60
                    const left = (startHours - HOUR_START) * PX_PER_HOUR
                    const width = Math.max(40, (endHours - startHours) * PX_PER_HOUR)
                    if (left < 0 || left > totalWidth) return null
                    const cfg = DISPATCH_STATUS_CONFIG[a.status]
                    return (
                      <button
                        key={a.id}
                        onClick={() => onEditAssignment(a)}
                        className={`absolute top-1 bottom-1 rounded border px-2 text-left text-[10px] font-medium hover:shadow-md transition ${cfg.color}`}
                        style={{ left, width }}
                      >
                        <div className="font-mono truncate">{a.ticket?.ticket_number}</div>
                        <div className="truncate">{a.ticket?.title}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Planner View — single-tech detailed day
// ============================================================================

function PlannerView({ techs, assignments, selectedTech, onSelectTech, onEditAssignment, onUpdateStatus }: {
  techs: TechUser[]
  assignments: AssignmentWithRefs[]
  selectedTech: string | null
  onSelectTech: (id: string | null) => void
  onEditAssignment: (a: AssignmentWithRefs) => void
  onUpdateStatus: (id: string, status: PsaDispatchStatus) => void
}) {
  const active = selectedTech ?? techs[0]?.id ?? null
  const tech = techs.find(t => t.id === active)
  const techAssignments = assignments.filter(a => a.tech_id === active).sort((a, b) => {
    if (!a.scheduled_start || !b.scheduled_start) return 0
    return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
  })

  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Tech sidebar */}
      <div className="bg-white border border-neutral-200 rounded-lg p-3 space-y-1">
        <div className="text-xs font-semibold text-neutral-500 uppercase px-2 py-1">Select Tech</div>
        {techs.map(t => (
          <button
            key={t.id}
            onClick={() => onSelectTech(t.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition ${
              active === t.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-neutral-50 text-neutral-700'
            }`}
          >
            {techName(t)}
          </button>
        ))}
      </div>

      {/* Day detail */}
      <div className="col-span-3 bg-white border border-neutral-200 rounded-lg p-4">
        {!tech ? (
          <div className="text-center text-sm text-neutral-500 py-12">Select a tech to view their day</div>
        ) : (
          <>
            <div className="mb-4 pb-3 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">{techName(tech)}</h2>
              <div className="text-xs text-neutral-500 mt-1">
                {techAssignments.length} assignments today
                {tech.skills.length > 0 && ` · ${tech.skills.length} skills`}
              </div>
            </div>
            {techAssignments.length === 0 ? (
              <div className="text-center text-sm text-neutral-500 py-12">No assignments scheduled</div>
            ) : (
              <div className="space-y-3">
                {techAssignments.map(a => {
                  const cfg = DISPATCH_STATUS_CONFIG[a.status]
                  const Icon = cfg.icon
                  const nextStatus: PsaDispatchStatus | null =
                    a.status === 'scheduled' ? 'en_route' :
                    a.status === 'en_route'  ? 'on_site' :
                    a.status === 'on_site'   ? 'wip' :
                    a.status === 'wip'       ? 'completed' : null
                  return (
                    <div key={a.id} className={`border rounded p-4 ${cfg.color}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs">{a.ticket?.ticket_number}</span>
                            {a.ticket && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[a.ticket.priority]}`}>
                                {a.ticket.priority}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs font-medium">
                              <Icon className="w-3 h-3" /> {cfg.label}
                            </span>
                          </div>
                          <button onClick={() => onEditAssignment(a)} className="text-sm font-medium text-neutral-900 hover:underline text-left">
                            {a.ticket?.title ?? '—'}
                          </button>
                          {a.ticket?.customer && (
                            <div className="text-xs text-neutral-600 mt-1">{a.ticket.customer.name}</div>
                          )}
                          {a.scheduled_start && (
                            <div className="text-xs text-neutral-500 mt-1">
                              {new Date(a.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {a.scheduled_end && ` – ${new Date(a.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            </div>
                          )}
                          {a.notes && <div className="text-xs text-neutral-600 mt-2 italic">{a.notes}</div>}
                        </div>
                        {nextStatus && (
                          <button
                            onClick={() => onUpdateStatus(a.id, nextStatus)}
                            className="px-3 py-1.5 bg-white border border-neutral-300 rounded text-xs font-medium hover:border-blue-500 hover:text-blue-600"
                          >
                            → {DISPATCH_STATUS_CONFIG[nextStatus].label}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Dialogs
// ============================================================================

function AssignTicketDialog({ ticket, techs, date, onClose, onSaved }: {
  ticket: UnassignedTicket
  techs: TechUser[]
  date: string
  onClose: () => void
  onSaved: () => void
}) {
  const required = ticket.required_skills ?? []
  const rankedTechs = useMemo(() => {
    const ranked = techs.map(t => {
      const techSkillLabels = (t.skills ?? []).map(s => s.skill)
      const missing = missingSkills(required, techSkillLabels)
      return { tech: t, missing, matched: required.length > 0 && missing.length === 0 }
    })
    ranked.sort((a, b) => {
      if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length
      return techName(a.tech).localeCompare(techName(b.tech))
    })
    return ranked
  }, [techs, required])

  const firstMatch = rankedTechs.find(r => r.missing.length === 0)?.tech.id
  const [techId, setTechId] = useState(firstMatch ?? techs[0]?.id ?? '')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [compliance, setCompliance] = useState<Record<string, ComplianceCheck>>({})
  const jobState = ticket.customer?.state ?? null

  useEffect(() => {
    if (!jobState) { setCompliance({}); return }
    const stateNorm = jobState.toUpperCase().slice(0, 2)
    let cancelled = false
    Promise.all(
      techs.map(async t => {
        try {
          const res = await fetch(`/api/org/compliance/dispatch-check?user_id=${t.id}&state=${stateNorm}`)
          if (!res.ok) return [t.id, null] as const
          const data = await res.json() as ComplianceCheck
          return [t.id, data] as const
        } catch {
          return [t.id, null] as const
        }
      })
    ).then(results => {
      if (cancelled) return
      const map: Record<string, ComplianceCheck> = {}
      for (const [id, data] of results) if (data) map[id] = data
      setCompliance(map)
    })
    return () => { cancelled = true }
  }, [jobState, techs])

  const activeCompliance = compliance[techId]

  async function submit() {
    setError(null)
    const payload: Record<string, unknown> = {
      ticket_id: ticket.id,
      tech_id: techId,
      scheduled_date: date,
      notes: notes || null,
    }
    if (start) payload.scheduled_start = `${date}T${start}:00`
    if (end)   payload.scheduled_end   = `${date}T${end}:00`

    const res = await fetch('/api/org/psa/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to assign')
      return
    }
    onSaved()
  }

  return (
    <Dialog onClose={onClose} title="Assign Ticket">
      <div className="space-y-4">
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs">{ticket.ticket_number}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PRIORITY_COLORS[ticket.priority]}`}>
              {ticket.priority}
            </span>
          </div>
          <div className="text-sm font-medium">{ticket.title}</div>
          {ticket.customer && <div className="text-xs text-neutral-500 mt-1">{ticket.customer.name}</div>}
          {required.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-[10px] uppercase tracking-wide text-neutral-500 mr-1">Required:</span>
              {required.map(s => (
                <span key={s} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px]">{s}</span>
              ))}
            </div>
          )}
        </div>

        <Field label="Tech">
          <select value={techId} onChange={e => setTechId(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded text-sm">
            {rankedTechs.map(({ tech: t, missing }) => {
              const c = compliance[t.id]
              const skillLabel = required.length === 0
                ? ''
                : missing.length === 0
                  ? ' ✓ skills'
                  : ` · missing: ${missing.join(', ')}`
              const licLabel = !c
                ? ''
                : c.blockers.length > 0
                  ? ' ⚠ license required'
                  : c.warnings.length > 0
                    ? ' ⚠ license warning'
                    : c.eligible && jobState
                      ? ' ✓ licensed'
                      : ''
              return <option key={t.id} value={t.id}>{`${techName(t)} (${t.role})${skillLabel}${licLabel}`}</option>
            })}
          </select>
          {required.length > 0 && rankedTechs.some(r => r.missing.length > 0) && (
            <div className="mt-1 text-[11px] text-neutral-500">
              Techs missing required skills are shown with details — assignment is still allowed as a soft override.
            </div>
          )}
          {jobState && activeCompliance && (activeCompliance.blockers.length > 0 || activeCompliance.warnings.length > 0) && (
            <div className={`mt-2 rounded border p-2 text-[11px] ${
              activeCompliance.blockers.length > 0
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}>
              <div className="font-semibold mb-1">
                {jobState.toUpperCase().slice(0, 2)} licensing — {activeCompliance.blockers.length > 0 ? 'blocker' : 'warning'}
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {activeCompliance.blockers.map((b, i) => <li key={`b${i}`}>{b}</li>)}
                {activeCompliance.warnings.map((w, i) => <li key={`w${i}`}>{w}</li>)}
              </ul>
              <div className="mt-1 text-[10px] opacity-80">Soft warning — assignment still allowed. Manage licenses at /org/compliance/technicians.</div>
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time">
            <input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded text-sm" />
          </Field>
          <Field label="End time">
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded text-sm" />
          </Field>
        </div>

        <Field label="Notes">
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm font-sans" />
        </Field>

        {error && <div className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-1.5 border border-neutral-300 rounded text-sm hover:bg-neutral-50">Cancel</button>
          <button onClick={submit} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Assign</button>
        </div>
      </div>
    </Dialog>
  )
}

function EditAssignmentDialog({ assignment, techs, onClose, onSaved }: {
  assignment: AssignmentWithRefs
  techs: TechUser[]
  onClose: () => void
  onSaved: () => void
}) {
  const [techId, setTechId] = useState(assignment.tech_id)
  const [start, setStart] = useState(assignment.scheduled_start ? new Date(assignment.scheduled_start).toTimeString().slice(0, 5) : '')
  const [end, setEnd] = useState(assignment.scheduled_end ? new Date(assignment.scheduled_end).toTimeString().slice(0, 5) : '')
  const [notes, setNotes] = useState(assignment.notes ?? '')
  const [travel, setTravel] = useState(assignment.travel_notes ?? '')

  async function save() {
    const payload: Record<string, unknown> = {
      tech_id: techId,
      notes: notes || null,
      travel_notes: travel || null,
    }
    if (start) payload.scheduled_start = `${assignment.scheduled_date}T${start}:00`
    if (end)   payload.scheduled_end   = `${assignment.scheduled_date}T${end}:00`

    await fetch(`/api/org/psa/dispatch/${assignment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    onSaved()
  }

  async function remove() {
    if (!confirm('Remove this assignment?')) return
    await fetch(`/api/org/psa/dispatch/${assignment.id}`, { method: 'DELETE' })
    onSaved()
  }

  return (
    <Dialog onClose={onClose} title={`Edit Assignment — ${assignment.ticket?.ticket_number ?? ''}`}>
      <div className="space-y-4">
        <div className="text-sm font-medium text-neutral-900">{assignment.ticket?.title}</div>

        <Field label="Tech">
          <select value={techId} onChange={e => setTechId(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded text-sm">
            {techs.map(t => <option key={t.id} value={t.id}>{techName(t)}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time">
            <input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded text-sm" />
          </Field>
          <Field label="End time">
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="w-full px-3 py-2 border border-neutral-300 rounded text-sm" />
          </Field>
        </div>

        <Field label="Notes">
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm font-sans" />
        </Field>

        <Field label="Travel notes">
          <textarea rows={2} value={travel} onChange={e => setTravel(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm font-sans" />
        </Field>

        <div className="flex justify-between pt-2">
          <button onClick={remove} className="px-4 py-1.5 text-red-600 text-sm hover:underline">Remove</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 border border-neutral-300 rounded text-sm hover:bg-neutral-50">Cancel</button>
            <button onClick={save} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Save</button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

// ============================================================================
// Shared primitives
// ============================================================================

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ViewToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition ${
        active ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
      }`}
    >
      {icon} {label}
    </button>
  )
}
