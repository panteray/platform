'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  TicketCheck, Plus, Search, LayoutGrid, List, AlertCircle, Clock,
  CheckCircle2, X,
} from 'lucide-react'
import type { PsaTicket, PsaTicketStatus, PsaVertical, PsaPriority, PsaTicketType } from '@/types/database'
import { PSA_SKILLS, PSA_SKILL_VERTICAL_LABELS, groupSkillsByVertical, type PsaSkillVertical } from '@/lib/psa-skills'

type TicketWithRefs = PsaTicket & {
  customer?: { id: string; name: string } | null
  asset?: { id: string; label: string; vendor: string | null; model: string | null } | null
  assignee?: { id: string; first_name: string | null; last_name: string | null; email: string } | null
}

const PRIORITY_COLORS: Record<PsaPriority, string> = {
  P1: 'bg-red-600 text-white',
  P2: 'bg-orange-500 text-white',
  P3: 'bg-amber-400 text-amber-900',
  P4: 'bg-blue-400 text-white',
  P5: 'bg-neutral-300 text-neutral-700',
}

const STATUS_CONFIG: Record<PsaTicketStatus, { label: string; color: string }> = {
  NEW:                    { label: 'New', color: 'bg-blue-100 text-blue-700' },
  OPEN:                   { label: 'Open', color: 'bg-indigo-100 text-indigo-700' },
  SCHEDULED:              { label: 'Scheduled', color: 'bg-purple-100 text-purple-700' },
  EN_ROUTE:               { label: 'En Route', color: 'bg-cyan-100 text-cyan-700' },
  ON_SITE:                { label: 'On Site', color: 'bg-teal-100 text-teal-700' },
  WORK_IN_PROGRESS:       { label: 'WIP', color: 'bg-amber-100 text-amber-700' },
  WAITING_ON_CUSTOMER:    { label: 'Waiting — Customer', color: 'bg-pink-100 text-pink-700' },
  WAITING_ON_PARTS:       { label: 'Waiting — Parts', color: 'bg-pink-100 text-pink-700' },
  WAITING_ON_VENDOR:      { label: 'Waiting — Vendor', color: 'bg-pink-100 text-pink-700' },
  WAITING_ON_SITE_ACCESS: { label: 'Waiting — Access', color: 'bg-pink-100 text-pink-700' },
  NEEDS_RMA:              { label: 'Needs RMA', color: 'bg-rose-100 text-rose-700' },
  COMPLETED:              { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  RESOLVED:               { label: 'Resolved', color: 'bg-neutral-100 text-neutral-600' },
  CANCELLED:              { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
}

const KANBAN_COLUMNS: PsaTicketStatus[] = [
  'NEW', 'OPEN', 'SCHEDULED', 'EN_ROUTE', 'ON_SITE', 'WORK_IN_PROGRESS',
  'WAITING_ON_CUSTOMER', 'COMPLETED', 'RESOLVED',
]

const VERTICALS: { value: PsaVertical | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'SEC', label: 'Security' },
  { value: 'NET', label: 'Network' },
  { value: 'AV', label: 'AV' },
  { value: 'MSP', label: 'MSP' },
  { value: 'CYB', label: 'Cyber' },
  { value: 'SVC', label: 'Service' },
  { value: 'INT', label: 'Internal' },
]

export default function TicketsView() {
  const [tickets, setTickets] = useState<TicketWithRefs[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [vertical, setVertical] = useState<PsaVertical | 'all'>('all')
  const [mine, setMine] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (vertical !== 'all') params.set('vertical', vertical)
    if (mine) params.set('mine', '1')
    const res = await fetch(`/api/org/psa/tickets?${params.toString()}`)
    if (res.ok) setTickets(await res.json())
    setLoading(false)
  }, [vertical, mine])

  useEffect(() => { load() }, [load])

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      t.title.toLowerCase().includes(q) ||
      t.ticket_number.toLowerCase().includes(q) ||
      (t.customer?.name ?? '').toLowerCase().includes(q) ||
      (t.asset?.label ?? '').toLowerCase().includes(q)
    )
  })

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TicketCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Service Desk</h1>
          <span className="text-xs text-muted-foreground">({tickets.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="rounded-md border border-border bg-background pl-7 pr-3 py-1.5 text-xs outline-none focus:border-primary w-56"
            />
          </div>
          <div className="flex rounded-md border border-border">
            <button onClick={() => setView('kanban')} className={`px-2 py-1.5 ${view === 'kanban' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView('table')} className={`px-2 py-1.5 ${view === 'table' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New Ticket
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {VERTICALS.map(v => (
          <button
            key={v.value}
            onClick={() => setVertical(v.value)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${vertical === v.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            {v.label}
          </button>
        ))}
        <div className="h-4 w-px bg-border mx-1" />
        <button
          onClick={() => setMine(!mine)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${mine ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
        >
          My Tickets
        </button>
      </div>

      {/* Kanban */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map(status => {
            const cfg = STATUS_CONFIG[status]
            const items = filtered.filter(t => t.status === status)
            return (
              <div key={status} className="min-w-[240px] flex-shrink-0">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-[10px] text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map(t => <TicketCard key={t.id} ticket={t} />)}
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[10px] text-muted-foreground">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table */}
      {view === 'table' && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-semibold">#</th>
                <th className="px-3 py-2 text-left font-semibold">Title</th>
                <th className="px-3 py-2 text-left font-semibold">Vert</th>
                <th className="px-3 py-2 text-left font-semibold">Pri</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Customer</th>
                <th className="px-3 py-2 text-left font-semibold">Assignee</th>
                <th className="px-3 py-2 text-left font-semibold">SLA</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const cfg = STATUS_CONFIG[t.status]
                return (
                  <tr key={t.id} className="border-b border-border hover:bg-accent/30">
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{t.ticket_number}</td>
                    <td className="px-3 py-2">
                      <Link href={`/org/psa/tickets/${t.id}`} className="font-medium text-primary hover:underline">{t.title}</Link>
                    </td>
                    <td className="px-3 py-2 text-[10px] font-bold text-muted-foreground">{t.vertical}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{t.customer?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.assignee ? `${t.assignee.first_name ?? ''} ${t.assignee.last_name ?? ''}`.trim() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <SlaIndicator ticket={t} />
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No tickets</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateTicketDialog onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
    </div>
  )
}

function TicketCard({ ticket: t }: { ticket: TicketWithRefs }) {
  return (
    <Link href={`/org/psa/tickets/${t.id}`} className="block rounded-lg border border-border bg-card p-2.5 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-muted-foreground">{t.ticket_number}</span>
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
      </div>
      <p className="text-xs font-medium text-foreground line-clamp-2">{t.title}</p>
      {t.customer && <p className="mt-1 text-[10px] text-muted-foreground truncate">{t.customer.name}</p>}
      {t.asset && <p className="text-[10px] text-muted-foreground truncate">{t.asset.label}</p>}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase text-muted-foreground">{t.vertical}</span>
        <SlaIndicator ticket={t} compact />
      </div>
    </Link>
  )
}

function SlaIndicator({ ticket, compact }: { ticket: TicketWithRefs; compact?: boolean }) {
  const now = Date.now()

  // If resolved, show green
  if (ticket.resolved_at) {
    return <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600"><CheckCircle2 className="h-2.5 w-2.5" /> {compact ? '' : 'RESOLVED'}</span>
  }

  // Response SLA
  if (!ticket.first_response_at && ticket.sla_response_due) {
    const due = new Date(ticket.sla_response_due).getTime()
    const ms = due - now
    if (ms < 0) return <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600"><AlertCircle className="h-2.5 w-2.5" /> RESP BREACH</span>
    const mins = Math.floor(ms / 60000)
    const hrs = Math.floor(mins / 60)
    const label = hrs > 0 ? `${hrs}h` : `${mins}m`
    return <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${mins < 30 ? 'text-red-600' : 'text-amber-600'}`}><Clock className="h-2.5 w-2.5" /> R:{label}</span>
  }

  // Resolution SLA
  if (ticket.sla_resolution_due) {
    const due = new Date(ticket.sla_resolution_due).getTime()
    const ms = due - now
    if (ms < 0) return <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600"><AlertCircle className="h-2.5 w-2.5" /> BREACH</span>
    const hrs = Math.floor(ms / 3600000)
    const label = hrs > 24 ? `${Math.floor(hrs / 24)}d` : `${hrs}h`
    return <span className={`inline-flex items-center gap-0.5 text-[9px] ${hrs < 4 ? 'text-red-600 font-bold' : hrs < 12 ? 'text-amber-600 font-bold' : 'text-muted-foreground'}`}><Clock className="h-2.5 w-2.5" /> {label}</span>
  }

  return null
}

function CreateTicketDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [vertical, setVertical] = useState<PsaVertical>('SEC')
  const [priority, setPriority] = useState<PsaPriority>('P3')
  const [ticketType, setTicketType] = useState<PsaTicketType>('INCIDENT')
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [showSkills, setShowSkills] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const skillGroups = groupSkillsByVertical()
  const toggleSkill = (label: string) => {
    setRequiredSkills((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    )
  }

  const submit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/org/psa/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description: description || null,
        vertical,
        priority,
        ticket_type: ticketType,
        required_skills: requiredSkills,
      }),
    })
    if (res.ok) {
      onCreated()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to create')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold">New Ticket</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Brief description of the issue"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Vertical</label>
              <select value={vertical} onChange={e => setVertical(e.target.value as PsaVertical)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary">
                <option value="SEC">Security</option>
                <option value="NET">Network</option>
                <option value="AV">AV</option>
                <option value="MSP">MSP</option>
                <option value="CYB">Cyber</option>
                <option value="SVC">Service</option>
                <option value="INT">Internal</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Type</label>
              <select value={ticketType} onChange={e => setTicketType(e.target.value as PsaTicketType)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary">
                <option value="INCIDENT">Incident</option>
                <option value="SERVICE_REQUEST">Service Req</option>
                <option value="CHANGE">Change</option>
                <option value="PROBLEM">Problem</option>
                <option value="EVENT">Event</option>
                <option value="INTERNAL">Internal</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as PsaPriority)} className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary">
                <option value="P1">P1 — Critical</option>
                <option value="P2">P2 — High</option>
                <option value="P3">P3 — Normal</option>
                <option value="P4">P4 — Low</option>
                <option value="P5">P5 — Scheduled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary resize-none"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowSkills((v) => !v)}
              className="text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground"
            >
              Required Skills ({requiredSkills.length}) {showSkills ? '▴' : '▾'}
            </button>
            {showSkills && (
              <div className="mt-1 max-h-48 overflow-auto rounded border border-border bg-background p-2 space-y-2">
                {(Object.keys(skillGroups) as PsaSkillVertical[]).map((v) => (
                  <div key={v}>
                    <div className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">
                      {PSA_SKILL_VERTICAL_LABELS[v]}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {skillGroups[v].map((label) => {
                        const active = requiredSkills.includes(label)
                        return (
                          <button
                            type="button"
                            key={label}
                            onClick={() => toggleSkill(label)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/70'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {/* unused constant to keep import tree-shaken-safe */}
                <span className="hidden">{PSA_SKILLS.length}</span>
              </div>
            )}
          </div>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
          <button
            onClick={submit}
            disabled={!title.trim() || submitting}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}
