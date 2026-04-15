'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Clock, AlertCircle, CheckCircle2, User, Building2,
  Package, FileText, DollarSign, Camera, History, Send, Receipt,
} from 'lucide-react'
import type {
  PsaTicket, PsaTicketStatus, PsaPriority, PsaVertical,
  PsaTicketNote, PsaTimeEntry, PsaTicketPart, PsaTicketPhoto, PsaTicketStatusLog,
} from '@/types/database'
import { PSA_STATUS_TRANSITIONS } from '@/types/database'
import { JobCostFlyout } from '@/components/psa/JobCostFlyout'
import { KedbMatchBanner } from '@/components/psa/KedbMatchBanner'
import { CiImpactPanel } from '@/components/psa/CiImpactPanel'
import { PirPanel } from '@/components/psa/PirPanel'
import { TimeEntryPanel } from '@/components/psa/TimeEntryPanel'
import { PartsPanel } from '@/components/psa/PartsPanel'
import { PhotosPanel } from '@/components/psa/PhotosPanel'
import { CompletionModal } from '@/components/psa/CompletionModal'

type TicketDetail = PsaTicket & {
  customer?: { id: string; name: string } | null
  asset?: { id: string; label: string; vendor: string | null; model: string | null; serial_number: string | null } | null
  assignee?: { id: string; first_name: string | null; last_name: string | null; email: string } | null
  job_type?: { id: string; name: string; require_photos: boolean } | null
  notes: (PsaTicketNote & { author?: { id: string; first_name: string | null; last_name: string | null; email: string } | null })[]
  time_entries: (PsaTimeEntry & { user?: { id: string; first_name: string | null; last_name: string | null } | null })[]
  parts: PsaTicketPart[]
  photos: PsaTicketPhoto[]
  status_log: (PsaTicketStatusLog & { changed_by_user?: { id: string; first_name: string | null; last_name: string | null } | null })[]
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

const VERTICAL_LABELS: Record<PsaVertical, string> = {
  SEC: 'Security', NET: 'Network', AV: 'AV', MSP: 'MSP',
  CYB: 'Cyber', SVC: 'Service', INT: 'Internal',
}

function userName(u?: { first_name: string | null; last_name: string | null; email?: string } | null): string {
  if (!u) return '—'
  const n = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return n || u.email || '—'
}

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString()
}

function fmtRelative(dueAt: string): { text: string; tone: 'green' | 'amber' | 'red' } {
  const diffMs = new Date(dueAt).getTime() - Date.now()
  const hours = diffMs / 3600000
  if (hours < 0) return { text: 'BREACHED', tone: 'red' }
  if (hours < 4) return { text: `${hours.toFixed(1)}h`, tone: 'red' }
  if (hours < 12) return { text: `${hours.toFixed(1)}h`, tone: 'amber' }
  if (hours < 48) return { text: `${hours.toFixed(1)}h`, tone: 'green' }
  return { text: `${(hours / 24).toFixed(1)}d`, tone: 'green' }
}

type Tab = 'details' | 'notes' | 'time' | 'parts' | 'photos' | 'activity'

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('details')
  const [transitionError, setTransitionError] = useState<string | null>(null)
  const [gateFailures, setGateFailures] = useState<string[] | null>(null)
  const [showCosting, setShowCosting] = useState(false)
  const [generatingInvoice, setGeneratingInvoice] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)

  async function generateInvoice() {
    setGeneratingInvoice(true)
    const res = await fetch('/api/org/psa/invoices/generate-from-ticket', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticket_id: id }),
    })
    setGeneratingInvoice(false)
    if (res.ok) {
      const inv = await res.json()
      router.push(`/org/psa/invoices/${inv.id}`)
    } else {
      const e = await res.json().catch(() => ({}))
      alert(e.error ?? 'Failed to generate invoice')
    }
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/psa/tickets/${id}`)
    if (res.ok) setTicket(await res.json())
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function transition(toStatus: PsaTicketStatus, reason?: string) {
    setTransitionError(null)
    setGateFailures(null)
    // Intercept COMPLETED → RESOLVED — must capture customer signature + geolocation first
    if (toStatus === 'RESOLVED' && ticket?.status === 'COMPLETED') {
      setShowCompletion(true)
      return
    }
    const res = await fetch(`/api/org/psa/tickets/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_status: toStatus, reason }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (data.gate_failures) setGateFailures(data.gate_failures)
      setTransitionError(data.error || 'Transition failed')
      return
    }
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-neutral-500">
        <Clock className="w-5 h-5 animate-spin mr-2" /> Loading ticket…
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="p-6">
        <div className="text-red-600">Ticket not found</div>
        <Link href="/org/psa/tickets" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
          ← Back to tickets
        </Link>
      </div>
    )
  }

  const validTransitions = PSA_STATUS_TRANSITIONS[ticket.status] ?? []
  const statusConfig = STATUS_CONFIG[ticket.status]

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Back link */}
      <Link href="/org/psa/tickets" className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to tickets
      </Link>

      <KedbMatchBanner title={ticket.title} description={ticket.description} category={ticket.category} />

      {/* Header */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm text-neutral-500">{ticket.ticket_number}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${PRIORITY_COLORS[ticket.priority]}`}>
                {ticket.priority}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-neutral-100 text-neutral-600 uppercase">
                {VERTICAL_LABELS[ticket.vertical]}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-neutral-100 text-neutral-600">
                {ticket.ticket_type}
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900">{ticket.title}</h1>
            {ticket.description && (
              <p className="mt-2 text-sm text-neutral-600 whitespace-pre-wrap">{ticket.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(ticket.status === 'COMPLETED' || ticket.status === 'RESOLVED') && (
              <button
                onClick={generateInvoice}
                disabled={generatingInvoice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition disabled:opacity-50"
              >
                <Receipt className="w-3.5 h-3.5" /> {generatingInvoice ? 'Generating…' : 'Generate Invoice'}
              </button>
            )}
            <button
              onClick={() => setShowCosting(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition"
            >
              <DollarSign className="w-3.5 h-3.5" /> Costing
            </button>
          </div>
        </div>

        {/* Metadata row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-neutral-100">
          <div>
            <div className="text-xs text-neutral-500 mb-1">Customer</div>
            <div className="text-sm font-medium flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-neutral-400" />
              {ticket.customer?.name ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 mb-1">Assignee</div>
            <div className="text-sm font-medium flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-neutral-400" />
              {userName(ticket.assignee)}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 mb-1">Asset</div>
            <div className="text-sm font-medium flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-neutral-400" />
              {ticket.asset?.label ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 mb-1">Created</div>
            <div className="text-sm font-medium">{fmtDate(ticket.created_at)}</div>
          </div>
        </div>

        {/* SLA row */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-neutral-100">
          <SlaBlock
            label="Response SLA"
            dueAt={ticket.sla_response_due}
            met={!!ticket.first_response_at}
            breached={ticket.sla_response_breached}
            metAt={ticket.first_response_at}
          />
          <SlaBlock
            label="Resolution SLA"
            dueAt={ticket.sla_resolution_due}
            met={!!ticket.resolved_at}
            breached={ticket.sla_resolution_breached}
            metAt={ticket.resolved_at}
          />
        </div>

        {/* Transition buttons */}
        {validTransitions.length > 0 && (
          <div className="mt-6 pt-4 border-t border-neutral-100">
            <div className="text-xs font-medium text-neutral-500 mb-2">TRANSITION TO</div>
            <div className="flex flex-wrap gap-2">
              {validTransitions.map(s => (
                <TransitionButton
                  key={s}
                  status={s}
                  onClick={() => transition(s, s === 'CANCELLED' ? prompt('Cancellation reason?') ?? undefined : undefined)}
                />
              ))}
            </div>
            {transitionError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <div className="font-medium text-red-700 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {transitionError}
                </div>
                {gateFailures && gateFailures.length > 0 && (
                  <ul className="mt-2 ml-5 list-disc text-red-600 text-xs space-y-0.5">
                    {gateFailures.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post-Incident Report — P1/P2 only, hides otherwise */}
      <PirPanel ticketId={ticket.id} priority={ticket.priority} />

      {/* CI Impact — hides itself when no asset or no relationships */}
      <CiImpactPanel ticketId={ticket.id} />

      {/* Tabs */}
      <div className="bg-white border border-neutral-200 rounded-lg">
        <div className="flex border-b border-neutral-200 overflow-x-auto">
          <TabButton active={tab === 'details'}  onClick={() => setTab('details')}  icon={<FileText className="w-4 h-4" />}  label="Details" />
          <TabButton active={tab === 'notes'}    onClick={() => setTab('notes')}    icon={<FileText className="w-4 h-4" />}  label={`Notes (${ticket.notes.length})`} />
          <TabButton active={tab === 'time'}     onClick={() => setTab('time')}     icon={<Clock className="w-4 h-4" />}     label={`Time (${ticket.time_entries.length})`} />
          <TabButton active={tab === 'parts'}    onClick={() => setTab('parts')}    icon={<DollarSign className="w-4 h-4" />} label={`Parts (${ticket.parts.length})`} />
          <TabButton active={tab === 'photos'}   onClick={() => setTab('photos')}   icon={<Camera className="w-4 h-4" />}    label={`Photos (${ticket.photos.length})`} />
          <TabButton active={tab === 'activity'} onClick={() => setTab('activity')} icon={<History className="w-4 h-4" />}   label="Activity" />
        </div>

        <div className="p-6">
          {tab === 'details'  && <DetailsTab ticket={ticket} onReload={load} />}
          {tab === 'notes'    && <NotesTab ticketId={ticket.id} notes={ticket.notes} onReload={load} />}
          {tab === 'time'     && <TimeEntryPanel ticketId={ticket.id} entries={ticket.time_entries} onReload={load} />}
          {tab === 'parts'    && <PartsPanel ticketId={ticket.id} parts={ticket.parts} onReload={load} />}
          {tab === 'photos'   && <PhotosPanel ticketId={ticket.id} photos={ticket.photos} onReload={load} />}
          {tab === 'activity' && <ActivityTab log={ticket.status_log} />}
        </div>
      </div>

      <JobCostFlyout ticketId={ticket.id} open={showCosting} onClose={() => setShowCosting(false)} />

      <CompletionModal
        open={showCompletion}
        ticketId={ticket.id}
        onClose={() => setShowCompletion(false)}
        onComplete={load}
        existingResolutionNotes={ticket.resolution_notes}
      />
    </div>
  )
}

// ============================================================================
// Subcomponents
// ============================================================================

function SlaBlock({ label, dueAt, met, breached, metAt }: {
  label: string; dueAt: string | null; met: boolean; breached: boolean; metAt: string | null
}) {
  if (met) {
    return (
      <div>
        <div className="text-xs text-neutral-500 mb-1">{label}</div>
        <div className="text-sm font-medium text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4" /> Met — {fmtDate(metAt)}
        </div>
      </div>
    )
  }
  if (breached) {
    return (
      <div>
        <div className="text-xs text-neutral-500 mb-1">{label}</div>
        <div className="text-sm font-medium text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" /> Breached — was due {fmtDate(dueAt)}
        </div>
      </div>
    )
  }
  if (!dueAt) {
    return (
      <div>
        <div className="text-xs text-neutral-500 mb-1">{label}</div>
        <div className="text-sm text-neutral-400">—</div>
      </div>
    )
  }
  const rel = fmtRelative(dueAt)
  const toneClass = rel.tone === 'red' ? 'text-red-600' : rel.tone === 'amber' ? 'text-amber-600' : 'text-emerald-600'
  return (
    <div>
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className={`text-sm font-medium flex items-center gap-1 ${toneClass}`}>
        <Clock className="w-4 h-4" /> {rel.text} — due {fmtDate(dueAt)}
      </div>
    </div>
  )
}

function TransitionButton({ status, onClick }: { status: PsaTicketStatus; onClick: () => void }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium border border-neutral-200 hover:border-neutral-400 transition ${cfg.color}`}
    >
      → {cfg.label}
    </button>
  )
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
        active ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-900'
      }`}
    >
      {icon} {label}
    </button>
  )
}

// ----- Details tab: edit ticket fields -----
function DetailsTab({ ticket, onReload }: { ticket: TicketDetail; onReload: () => void }) {
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolution_notes ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/org/psa/tickets/${ticket.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_notes: resolutionNotes }),
    })
    setSaving(false)
    onReload()
  }

  return (
    <div className="space-y-6">
      <Section title="Resolution Notes">
        <textarea
          value={resolutionNotes}
          onChange={e => setResolutionNotes(e.target.value)}
          rows={6}
          placeholder="Required before resolving (min 10 characters)"
          className="w-full px-3 py-2 border border-neutral-300 rounded text-sm font-sans"
        />
        <button
          onClick={save}
          disabled={saving}
          className="mt-2 px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Resolution Notes'}
        </button>
      </Section>

      <Section title="Ticket Info">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-neutral-500">Vertical</dt><dd>{VERTICAL_LABELS[ticket.vertical]}</dd></div>
          <div><dt className="text-neutral-500">Type</dt><dd>{ticket.ticket_type}</dd></div>
          <div><dt className="text-neutral-500">Priority</dt><dd>{ticket.priority}</dd></div>
          <div><dt className="text-neutral-500">Category</dt><dd>{ticket.category ?? '—'}</dd></div>
          <div><dt className="text-neutral-500">Job Type</dt><dd>{ticket.job_type?.name ?? '—'}</dd></div>
          <div><dt className="text-neutral-500">Costing Enabled</dt><dd>{ticket.costing_enabled ? 'Yes' : 'No'}</dd></div>
          <div><dt className="text-neutral-500">First Response</dt><dd>{fmtDate(ticket.first_response_at)}</dd></div>
          <div><dt className="text-neutral-500">Completed</dt><dd>{fmtDate(ticket.completed_at)}</dd></div>
          <div><dt className="text-neutral-500">Resolved</dt><dd>{fmtDate(ticket.resolved_at)}</dd></div>
          <div><dt className="text-neutral-500">SLA Paused (min)</dt><dd>{ticket.sla_total_pause_min}</dd></div>
        </dl>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900 mb-3">{title}</h3>
      {children}
    </div>
  )
}

// ----- Notes tab -----
function NotesTab({ ticketId, notes, onReload }: {
  ticketId: string; notes: TicketDetail['notes']; onReload: () => void
}) {
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(true)
  const [posting, setPosting] = useState(false)

  async function post() {
    if (!body.trim()) return
    setPosting(true)
    await fetch(`/api/org/psa/tickets/${ticketId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, internal_only: internal }),
    })
    setBody('')
    setPosting(false)
    onReload()
  }

  return (
    <div className="space-y-4">
      <div className="border border-neutral-200 rounded p-3">
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={3}
          placeholder="Add a note…"
          className="w-full text-sm font-sans resize-none focus:outline-none"
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100">
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} />
            Internal only
          </label>
          <button
            onClick={post}
            disabled={posting || !body.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-3 h-3" /> Post Note
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="text-center text-sm text-neutral-500 py-8">No notes yet</div>
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className={`p-3 rounded border ${n.internal_only ? 'bg-amber-50 border-amber-200' : 'bg-neutral-50 border-neutral-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-neutral-700">{userName(n.author)}</span>
                <div className="flex items-center gap-2">
                  {n.internal_only && <span className="text-[10px] uppercase text-amber-700 font-semibold">Internal</span>}
                  <span className="text-xs text-neutral-500">{fmtDate(n.created_at)}</span>
                </div>
              </div>
              <div className="text-sm text-neutral-800 whitespace-pre-wrap">{n.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ----- Activity log -----
function ActivityTab({ log }: { log: TicketDetail['status_log'] }) {
  if (log.length === 0) {
    return <div className="text-center text-sm text-neutral-500 py-8">No activity yet</div>
  }
  return (
    <ol className="relative border-l border-neutral-200 ml-3 space-y-4">
      {log.map(entry => (
        <li key={entry.id} className="ml-4">
          <div className="absolute -left-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
          <div className="text-xs text-neutral-500">{fmtDate(entry.created_at)}</div>
          <div className="text-sm mt-1">
            <span className="font-medium">{userName(entry.changed_by_user)}</span>
            {' '}
            {entry.from_status ? (
              <>moved from <code className="text-xs bg-neutral-100 px-1 rounded">{STATUS_CONFIG[entry.from_status]?.label ?? entry.from_status}</code> to </>
            ) : (
              <>created ticket with status </>
            )}
            <code className="text-xs bg-neutral-100 px-1 rounded">{STATUS_CONFIG[entry.to_status]?.label ?? entry.to_status}</code>
          </div>
          {entry.reason && <div className="text-xs text-neutral-600 mt-1 italic">Reason: {entry.reason}</div>}
        </li>
      ))}
    </ol>
  )
}
