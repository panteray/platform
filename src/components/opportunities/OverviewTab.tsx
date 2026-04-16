'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import type { Opportunity, Customer } from '@/types/database'
import { OppStatus, OPP_STATUS_ORDER, OPP_STATUS_LABELS, OppType, CustomerType, US_STATES, REQUEST_TYPE_OPTIONS, LABOR_REQUIREMENT_OPTIONS } from '@/types/enums'

interface Props {
  opp: Opportunity
  callerRole: string | null
  onUpdate: (updated: Opportunity) => void
}

const HIGH_LEVEL_STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'] as const
type PipelineStage = (typeof HIGH_LEVEL_STAGES)[number]
const ADMIN_ROLES = ['GLOBAL_ADMIN', 'ORG_ADMIN', 'ORG_MANAGER']
const PRESALES_ASSIGN_ROLES = ['GLOBAL_ADMIN', 'ORG_ADMIN', 'ORG_MANAGER', 'PRESALES']

function statusToStage(status: string): PipelineStage {
  const s = status as OppStatus
  if ([OppStatus.NEW, OppStatus.ASSIGNED_TO_PRESALES, OppStatus.ON_HOLD].includes(s)) return 'Lead'
  if ([OppStatus.SURVEY, OppStatus.DESIGN, OppStatus.WAITING_ON_INFO].includes(s)) return 'Qualified'
  if ([OppStatus.SUBMITTED_FOR_QUOTE, OppStatus.AWAITING_SOW, OppStatus.SUBMITTED_TO_CUSTOMER].includes(s)) return 'Proposal'
  if ([OppStatus.AWAITING_PO, OppStatus.AWAITING_SIGNED_DOCS, OppStatus.PROJECT, OppStatus.AWAITING_DELIVERY, OppStatus.INSTALL, OppStatus.QC, OppStatus.SIGN_OFF, OppStatus.CUSTOMER_SIGNATURE].includes(s)) return 'Negotiation'
  if (s === OppStatus.COMPLETE) return 'Closed Won'
  if (s === OppStatus.CLOSED) return 'Closed Lost'
  return 'Lead'
}

type OrgUser = { id: string; first_name: string; last_name: string; email: string; role: string; divisions?: string[] }

export function OverviewTab({ opp, callerRole, onUpdate }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [territories, setTerritories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOnHoldPrompt, setShowOnHoldPrompt] = useState(false)
  const [onHoldReason, setOnHoldReason] = useState(opp.on_hold_reason ?? '')

  const isAdmin = callerRole ? ADMIN_ROLES.includes(callerRole) : false
  const canAssignPresales = callerRole ? PRESALES_ASSIGN_ROLES.includes(callerRole) : false

  useEffect(() => {
    Promise.all([
      fetch('/api/org/customers').then((r) => r.ok ? r.json() : []),
      fetch('/api/org/users').then((r) => r.ok ? r.json() : []),
    ]).then(([c, u]) => { setCustomers(c); setOrgUsers(u) })
    // Load territories from org settings
    fetch('/api/profile').then(async (r) => {
      if (!r.ok) return
      const profile = await r.json()
      if (profile.org?.settings?.territories) setTerritories(profile.org.settings.territories)
    }).catch((e) => { console.error('[OverviewTab] Failed to load territories:', e) })
  }, [])

  async function patchField(field: string, value: unknown) {
    setSaving(true); setError(null)
    const res = await fetch(`/api/org/opportunities/${opp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value ?? null }) })
    const result = await res.json(); setSaving(false)
    if (!res.ok) { setError(result.error); return }
    onUpdate(result.opportunity)
  }

  async function transitionStatus(newStatus: string) {
    if (newStatus === 'ON_HOLD') { setShowOnHoldPrompt(true); return }
    setStatusSaving(true); setError(null)
    const res = await fetch(`/api/org/opportunities/${opp.id}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_status: newStatus }) })
    const result = await res.json(); setStatusSaving(false)
    if (!res.ok) { setError(result.error); return }
    onUpdate({ ...opp, status: result.status })
  }

  async function confirmOnHold() {
    if (!onHoldReason.trim()) { setError('On-hold reason is required'); return }
    setStatusSaving(true); setError(null)
    const res = await fetch(`/api/org/opportunities/${opp.id}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_status: 'ON_HOLD', on_hold_reason: onHoldReason.trim() }) })
    const result = await res.json(); setStatusSaving(false)
    if (!res.ok) { setError(result.error); return }
    setShowOnHoldPrompt(false); onUpdate({ ...opp, status: 'ON_HOLD' as OppStatus, on_hold_reason: onHoldReason.trim() })
  }

  // Filtered user lists
  const isrUsers = orgUsers.filter((u) => u.role === 'SALES_ISR')
  const osrUsers = orgUsers.filter((u) => u.role === 'SALES_OSR')
  const presalesUsers = orgUsers.filter((u) => {
    if (u.role !== 'PRESALES') return false
    if (!opp.opp_type) return true
    return (u.divisions ?? []).includes(opp.opp_type)
  })
  const pmUsers = orgUsers.filter((u) => u.role === 'PROJECT_MANAGER')

  const currentStage = statusToStage(opp.status)
  const stageIdx = HIGH_LEVEL_STAGES.indexOf(currentStage)

  // Fine-grained status pills (exclude ON_HOLD and CLOSED — shown separately)
  const PIPELINE_STATUSES = OPP_STATUS_ORDER.filter((s) => s !== OppStatus.ON_HOLD && s !== OppStatus.CLOSED) as OppStatus[]
  const currentStatusIdx = PIPELINE_STATUSES.indexOf(opp.status as OppStatus)

  const ic = 'h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
  const lc = 'block text-[11px] font-medium text-muted-foreground mb-1'
  const tc = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical'

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      {/* Pipeline Stepper */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Pipeline</p>
        <div className="flex items-start gap-0 overflow-x-auto px-1 py-2">
          {HIGH_LEVEL_STAGES.map((stage, i) => {
            const done = i < stageIdx
            const active = i === stageIdx && opp.status !== 'CLOSED'
            const isClosedLost = i === stageIdx && opp.status === 'CLOSED'
            const isLast = i === HIGH_LEVEL_STAGES.length - 1
            return (
              <div key={stage} className="flex items-center">
                <div className="flex flex-col items-center" style={{ minWidth: 72 }}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 transition-colors ${isClosedLost ? 'bg-red-500 text-white border-red-500' : done ? 'bg-primary text-primary-foreground border-primary' : active ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30' : 'bg-muted text-muted-foreground border-muted'}`}>
                    {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1.5 text-center leading-tight max-w-[64px] ${active ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{stage}</span>
                </div>
                {!isLast && <div className={`h-0.5 w-6 shrink-0 mb-5 ${i < stageIdx ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Status Pills */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Status Detail</p>
        <div className="relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-6 bg-gradient-to-l from-card to-transparent" />
          <div className="flex gap-0.5 overflow-x-auto scrollbar-hide pb-1">
            {PIPELINE_STATUSES.map((s, idx) => {
              const isCurrent = s === opp.status
              const isPast = idx < currentStatusIdx
              return <div key={s} className={`flex-shrink-0 rounded px-2 py-1 text-[10px] font-medium leading-tight whitespace-nowrap ${isCurrent ? 'bg-primary text-primary-foreground' : isPast ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`} title={OPP_STATUS_LABELS[s]}>{OPP_STATUS_LABELS[s] ?? s.replace(/_/g, ' ')}</div>
            })}
            {(opp.status === 'ON_HOLD' || opp.status === 'CLOSED') && <div className="flex-shrink-0 rounded px-2 py-1 text-[10px] font-medium leading-tight whitespace-nowrap bg-yellow-500/20 text-yellow-600">{opp.status.replace(/_/g, ' ')}</div>}
          </div>
        </div>
      </div>

      {/* Status + Type */}
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Status</label><select className={ic} value={opp.status} disabled={statusSaving} onChange={(e) => transitionStatus(e.target.value)}>
          {OPP_STATUS_ORDER.map((s) => <option key={s} value={s}>{OPP_STATUS_LABELS[s] ?? s.replace(/_/g, ' ')}</option>)}
        </select></div>
        <div><label className={lc}>OPP Type (Discipline)</label><select className={ic} value={opp.opp_type ?? ''} onChange={(e) => patchField('opp_type', e.target.value || null)}>
          <option value="">Select type...</option>
          {Object.values(OppType).map((t) => <option key={t} value={t}>{t}</option>)}
        </select></div>
      </div>

      {/* On-hold prompt */}
      {showOnHoldPrompt && (
        <div className="rounded-md border p-4 space-y-3 bg-yellow-500/10 border-yellow-500/30">
          <label className={lc}>On-Hold Reason (required)</label>
          <textarea className={tc} rows={2} value={onHoldReason} onChange={(e) => setOnHoldReason(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={confirmOnHold} disabled={statusSaving} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Confirm On-Hold</button>
            <button onClick={() => setShowOnHoldPrompt(false)} className="h-8 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {/* Customer Vertical */}
      <div><label className={lc}>Customer Vertical</label><select className={ic} value={opp.customer_vertical ?? ''} onChange={(e) => patchField('customer_vertical', e.target.value || null)}>
        <option value="">—</option>{Object.values(CustomerType).map((t) => <option key={t} value={t}>{t}</option>)}
      </select></div>

      {/* Core Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>OPP Number</label><input className={ic} defaultValue={opp.opp_number ?? ''} onBlur={(e) => { if (e.target.value !== (opp.opp_number ?? '')) patchField('opp_number', e.target.value) }} /></div>
        <div><label className={lc}>Customer</label><select className={ic} value={opp.customer_id ?? ''} onChange={(e) => {
          const cid = e.target.value || null; patchField('customer_id', cid)
          if (cid) { const c = customers.find((x) => x.id === cid); if (c) { /* auto-populate POC + location */ if (c.contact_name) patchField('poc_name', c.contact_name); if (c.contact_email) patchField('poc_email', c.contact_email); if (c.contact_phone) patchField('poc_phone', c.contact_phone); if (c.customer_type) patchField('customer_vertical', c.customer_type) } }
        }}><option value="">—</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      </div>
      <div><label className={lc}>Project Name</label><input className={ic} defaultValue={opp.project_name ?? ''} onBlur={(e) => patchField('project_name', e.target.value)} /></div>
      <div><label className={lc}>System Name</label><input className={ic} defaultValue={opp.system_name ?? ''} onBlur={(e) => patchField('system_name', e.target.value)} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={lc}>Install Address</label><input className={ic} defaultValue={opp.install_address ?? ''} onBlur={(e) => patchField('install_address', e.target.value)} /></div>
        <div><label className={lc}>State</label><select className={ic} value={opp.state ?? ''} onChange={(e) => patchField('state', e.target.value || null)}><option value="">—</option>{US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className={lc}>Campus / Bldg / Rm</label><input className={ic} defaultValue={opp.campus_bldg_rm ?? ''} onBlur={(e) => patchField('campus_bldg_rm', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Territory</label><select className={ic} value={opp.territory ?? ''} onChange={(e) => patchField('territory', e.target.value || null)}><option value="">—</option>{territories.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label className={lc}>Multiple Locations</label><select className={ic} value={opp.multiple_locations ? 'Yes' : opp.multiple_locations === false ? 'No' : ''} onChange={(e) => patchField('multiple_locations', e.target.value === 'Yes' ? true : e.target.value === 'No' ? false : null)}><option value="">—</option><option value="Yes">Yes</option><option value="No">No</option></select></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Request Type</label><select className={ic} value={opp.request_type ?? ''} onChange={(e) => patchField('request_type', e.target.value || null)}><option value="">—</option>{REQUEST_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label className={lc}>Labor Requirement</label><select className={ic} value={opp.labor_requirement ?? ''} onChange={(e) => patchField('labor_requirement', e.target.value || null)}><option value="">—</option>{LABOR_REQUIREMENT_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
      </div>
      <div><label className={lc}>Project Description</label><textarea className={tc} rows={3} defaultValue={opp.project_description ?? ''} onBlur={(e) => patchField('project_description', e.target.value)} /></div>
      <div><label className={lc}>Notes</label><textarea className={tc} rows={2} defaultValue={opp.notes ?? ''} onBlur={(e) => patchField('notes', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Quote Expected Date</label><input type="date" className={ic} defaultValue={opp.quote_expected_date ?? ''} onBlur={(e) => patchField('quote_expected_date', e.target.value)} /></div>
        <div><label className={lc}>PO Number</label><input className={ic} defaultValue={opp.po_number ?? ''} onBlur={(e) => patchField('po_number', e.target.value)} /></div>
      </div>

      {/* Team Assignments */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-2">Team</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lc}>Assigned ISR</label><select className={ic} value={opp.assigned_isr_id ?? ''} onChange={(e) => patchField('assigned_isr_id', e.target.value || null)}><option value="">—</option>{isrUsers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
        <div><label className={lc}>Assigned OSR</label><select className={ic} value={opp.assigned_osr_id ?? ''} onChange={(e) => patchField('assigned_osr_id', e.target.value || null)}><option value="">—</option>{osrUsers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lc}>Assigned Presales</label>
          <select className={ic} value={opp.assigned_presales_id ?? ''} disabled={!canAssignPresales || !opp.opp_type} onChange={(e) => patchField('assigned_presales_id', e.target.value || null)} style={(!canAssignPresales || !opp.opp_type) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
            <option value="">—</option>{presalesUsers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
          </select>
          {!opp.opp_type && <p className="text-[10px] text-muted-foreground mt-0.5">Select OPP Type first</p>}
          {opp.opp_type && !canAssignPresales && <p className="text-[10px] text-muted-foreground mt-0.5">Only Admin or Presales can assign</p>}
        </div>
        <div>
          <label className={lc}>Assigned PM</label>
          <select className={ic} value={opp.assigned_pm_id ?? ''} disabled={!isAdmin} onChange={(e) => patchField('assigned_pm_id', e.target.value || null)} style={!isAdmin ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
            <option value="">—</option>{pmUsers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
          </select>
          {!isAdmin && <p className="text-[10px] text-muted-foreground mt-0.5">Only Admin can assign PM</p>}
        </div>
      </div>
      <div>
        <label className={lc}>Project Number (PN)</label>
        <input className={ic} defaultValue={opp.project_number ?? ''} disabled={!isAdmin} onBlur={(e) => { if (isAdmin) patchField('project_number', e.target.value) }} style={!isAdmin ? { opacity: 0.5, cursor: 'not-allowed' } : {}} />
      </div>

      {/* POC */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-2">Point of Contact</p>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={lc}>POC Name</label><input className={ic} defaultValue={opp.poc_name ?? ''} onBlur={(e) => patchField('poc_name', e.target.value)} /></div>
        <div><label className={lc}>POC Phone</label><input className={ic} defaultValue={opp.poc_phone ?? ''} onBlur={(e) => patchField('poc_phone', e.target.value)} /></div>
        <div><label className={lc}>POC Email</label><input className={ic} type="email" defaultValue={opp.poc_email ?? ''} onBlur={(e) => patchField('poc_email', e.target.value)} /></div>
      </div>

      {/* Decline reason */}
      <div><label className={lc}>Decline Reason</label><textarea className={tc} rows={2} defaultValue={opp.decline_reason ?? ''} onBlur={(e) => patchField('decline_reason', e.target.value)} /></div>

      {saving && <p className="text-xs text-muted-foreground">Saving...</p>}
    </div>
  )
}
