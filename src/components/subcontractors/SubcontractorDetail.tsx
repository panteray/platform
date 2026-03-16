'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { Subcontractor } from '@/types/database'
import { StatusBadge, TierBadge, ScoreBadge } from '@/components/shared/EntityHelpers'
import { ContactsPanel } from '@/components/customers/ContactsPanel'
import { AddressesPanel } from '@/components/customers/AddressesPanel'
import {
  US_STATES, ENTITY_TYPES, SUB_STATUSES, SUB_TYPES,
  PAYMENT_TERMS_OPTIONS, ACCEPTED_PAYMENT_METHODS_OPTIONS, DISCIPLINE_TYPES,
} from '@/types/enums'

interface SubcontractorDetailProps { subcontractorId: string }

type Tab = 'Overview' | 'Details' | 'Contacts' | 'Documents' | 'Financial' | 'Compliance' | 'Skills' | 'Licenses' | 'Linked Data'
const TABS: Tab[] = ['Overview', 'Details', 'Contacts', 'Documents', 'Financial', 'Compliance', 'Skills', 'Licenses', 'Linked Data']

const inputCls = 'h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
const labelCls = 'block text-[11px] font-medium text-muted-foreground mb-1'
const textareaCls = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical'

function SH({ children }: { children: string }) {
  return <div className="col-span-full mt-1 border-b border-border pb-1"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{children}</span></div>
}

function Ro({ label, value, onBlur, type = 'text', readOnly }: {
  label: string; value: string | null | undefined; onBlur?: (v: string) => void; type?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} className={inputCls} defaultValue={value ?? ''} readOnly={readOnly} onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined} />
    </div>
  )
}

function Ck({ label, checked, onChange }: { label: string; checked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer whitespace-nowrap">
      <input type="checkbox" checked={checked} onChange={onChange ? (e) => onChange(e.target.checked) : undefined} className="accent-primary" />
      {label}
    </label>
  )
}

export function SubcontractorDetail({ subcontractorId }: SubcontractorDetailProps) {
  const router = useRouter()
  const [sub, setSub] = useState<Subcontractor | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')

  const load = useCallback(async () => {
    const res = await fetch('/api/org/subcontractors')
    if (!res.ok) return
    const data: Subcontractor[] = await res.json()
    setSub(data.find((s) => s.id === subcontractorId) ?? null)
    setLoading(false)
  }, [subcontractorId])

  useEffect(() => { load() }, [load])

  const patch = useCallback(async (update: Partial<Subcontractor>) => {
    if (!sub) return
    const res = await fetch('/api/org/subcontractors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sub.id, ...update }),
    })
    if (res.ok) setSub(await res.json())
  }, [sub])

  async function handleDelete() {
    if (!confirm('Delete this subcontractor? This cannot be undone.')) return
    const res = await fetch(`/api/org/subcontractors?id=${subcontractorId}`, { method: 'DELETE' })
    if (res.ok) router.push('/org/subcontractors')
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>
  if (!sub) return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-sm text-muted-foreground">Subcontractor not found.</p>
      <Link href="/org/subcontractors" className="text-sm text-primary hover:underline">Back to subcontractors</Link>
    </div>
  )

  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5 flex-wrap">
        <Link href="/org/subcontractors" className="rounded p-1.5 hover:bg-muted"><ArrowLeft className="h-4 w-4 text-muted-foreground" /></Link>
        <span className="text-[13px] text-muted-foreground">Subcontractors</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-base font-semibold text-foreground">{sub.name}</span>
        <StatusBadge status={sub.status} />
        {sub.is_preferred && <TierBadge tier="Preferred" />}
        <ScoreBadge score={sub.overall_score} />
        <div className="flex-1" />
        <button onClick={handleDelete} className="rounded p-1.5 hover:bg-muted"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" /></button>
      </div>

      <div className="mb-3 flex gap-0 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`border-b-2 px-3.5 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab sub={sub} patch={patch} />}
      {tab === 'Details' && <DetailsTab sub={sub} patch={patch} />}
      {tab === 'Contacts' && <ContactsPanel entityType="subcontractor" entityId={subcontractorId} />}
      {tab === 'Documents' && <Placeholder label="Documents" />}
      {tab === 'Financial' && <FinancialTab sub={sub} patch={patch} />}
      {tab === 'Compliance' && <ComplianceTab sub={sub} patch={patch} />}
      {tab === 'Skills' && <SkillsTab sub={sub} patch={patch} />}
      {tab === 'Licenses' && <Placeholder label="Licenses" />}
      {tab === 'Linked Data' && <Placeholder label="Linked Data" />}
    </div>
  )
}

function Placeholder({ label }: { label: string }) {
  return <div className="rounded-lg border border-border bg-card p-8 text-center"><p className="text-sm text-muted-foreground">{label} — coming in future phase</p></div>
}

function OverviewTab({ sub, patch }: { sub: Subcontractor; patch: (u: Partial<Subcontractor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <SH>Identity</SH>
        <Ro label="Sub Number" value={sub.sub_number} readOnly />
        <Ro label="Company Name" value={sub.name} onBlur={(v) => patch({ name: v || '' })} />
        <Ro label="Official Business Name" value={sub.official_business_name} onBlur={(v) => patch({ official_business_name: v || null })} />
        <div>
          <label className={labelCls}>Entity Type</label>
          <select className={inputCls} value={sub.entity_type ?? ''} onChange={(e) => patch({ entity_type: e.target.value || '' })}>
            <option value="">—</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <SH>Location</SH>
        <div className="col-span-full flex gap-2.5">
          <div className="flex-[3]"><Ro label="Payment Address" value={sub.payment_address} onBlur={(v) => patch({ payment_address: v || null })} /></div>
          <div className="flex-[2]"><Ro label="City" value={sub.payment_city} onBlur={(v) => patch({ payment_city: v || null })} /></div>
          <div className="flex-1">
            <label className={labelCls}>State</label>
            <select className={inputCls} value={sub.payment_state ?? ''} onChange={(e) => patch({ payment_state: e.target.value || null })}>
              <option value="">—</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1"><Ro label="Zip" value={sub.payment_zip} onBlur={(v) => patch({ payment_zip: v || null })} /></div>
        </div>
        <Ro label="Territory" value={sub.territory} onBlur={(v) => patch({ territory: v || null })} />
        <Ro label="Region" value={sub.region} onBlur={(v) => patch({ region: v || null })} />
        <div>
          <label className={labelCls}>Region State</label>
          <select className={inputCls} value={sub.region_state ?? ''} onChange={(e) => patch({ region_state: e.target.value || null })}>
            <option value="">—</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div />

        <SH>Contact</SH>
        <Ro label="Contact Name" value={sub.contact_name} onBlur={(v) => patch({ contact_name: v || null })} />
        <Ro label="Contact Email" value={sub.contact_email} onBlur={(v) => patch({ contact_email: v || null })} />
        <Ro label="PO Email" value={sub.po_email} onBlur={(v) => patch({ po_email: v || null })} />
        <Ro label="Contact Phone" value={sub.contact_phone} onBlur={(v) => patch({ contact_phone: v || null })} />
        <Ro label="Org Contact" value={sub.org_contact} onBlur={(v) => patch({ org_contact: v || null })} />
        <div />

        <SH>Flags</SH>
        <div className="col-span-full flex flex-wrap gap-x-5 gap-y-2">
          <Ck label="E-Verified" checked={sub.e_verified} onChange={(v) => patch({ e_verified: v })} />
          <Ck label="W9 Received" checked={sub.w9_received} onChange={(v) => patch({ w9_received: v })} />
          <Ck label="Insurance Certs" checked={sub.insurance_certs} onChange={(v) => patch({ insurance_certs: v })} />
          <Ck label="Sub Agreement Signed" checked={sub.sub_agreement_signed} onChange={(v) => patch({ sub_agreement_signed: v })} />
          <Ck label="Signed Contract" checked={sub.doc_signed_contract} onChange={(v) => patch({ doc_signed_contract: v })} />
          <Ck label="Licenses on File" checked={sub.doc_licenses} onChange={(v) => patch({ doc_licenses: v })} />
          <Ck label="Setup Required" checked={sub.setup_required} onChange={(v) => patch({ setup_required: v })} />
          <Ck label="Setup Complete" checked={sub.setup_complete} onChange={(v) => patch({ setup_complete: v })} />
        </div>

        <SH>Dates</SH>
        <Ro label="COI Expiration" value={sub.coi_expiration_date?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ coi_expiration_date: v || null })} />
        <Ro label="Workers Comp Expiry" value={sub.workers_comp_expiry?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ workers_comp_expiry: v || null })} />
      </div>
    </div>
  )
}

function DetailsTab({ sub, patch }: { sub: Subcontractor; patch: (u: Partial<Subcontractor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-3 gap-x-3.5 gap-y-2.5">
        <SH>Status & Type</SH>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={sub.status ?? ''} onChange={(e) => patch({ status: e.target.value || null })}>
            <option value="">—</option>
            {SUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select className={inputCls} value={sub.type ?? ''} onChange={(e) => patch({ type: e.target.value || null })}>
            <option value="">—</option>
            {SUB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-4 pt-5">
          <Ck label="Preferred" checked={sub.is_preferred} onChange={(v) => patch({ is_preferred: v })} />
        </div>

        <SH>Health Scores</SH>
        <Ro label="Onboarding Health Score" value={sub.onboarding_health_score?.toString()} type="number" onBlur={(v) => patch({ onboarding_health_score: v === '' ? null : Number(v) })} />
        <Ro label="Overall Score" value={sub.overall_score?.toString()} type="number" onBlur={(v) => patch({ overall_score: v === '' ? null : Number(v) })} />
        <Ro label="Onboarded By" value={sub.onboarded_by} onBlur={(v) => patch({ onboarded_by: v || null })} />

        <SH>Performance Scores</SH>
        <Ro label="Timeliness Score" value={sub.timeliness_score?.toString()} type="number" onBlur={(v) => patch({ timeliness_score: v === '' ? null : Number(v) })} />
        <Ro label="QC Pass Rate" value={sub.qc_pass_rate?.toString()} type="number" onBlur={(v) => patch({ qc_pass_rate: v === '' ? null : Number(v) })} />
        <Ro label="Rework Count" value={sub.rework_count?.toString()} type="number" onBlur={(v) => patch({ rework_count: v === '' ? 0 : Number(v) })} />
        <Ro label="Report Cadence" value={sub.report_cadence_score?.toString()} type="number" onBlur={(v) => patch({ report_cadence_score: v === '' ? null : Number(v) })} />
        <Ro label="Daily Task Completion" value={sub.daily_task_completion?.toString()} type="number" onBlur={(v) => patch({ daily_task_completion: v === '' ? null : Number(v) })} />
        <Ro label="Revisit Count" value={sub.revisit_count?.toString()} type="number" onBlur={(v) => patch({ revisit_count: v === '' ? 0 : Number(v) })} />

        <SH>Service States</SH>
        <div className="col-span-full flex flex-wrap gap-1">
          {US_STATES.map((s) => {
            const active = (sub.service_states ?? []).includes(s)
            return (
              <button key={s} type="button" onClick={() => {
                const next = active ? (sub.service_states ?? []).filter((x) => x !== s) : [...(sub.service_states ?? []), s]
                patch({ service_states: next.length ? next : [] })
              }}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
                {s}
              </button>
            )
          })}
        </div>

        <SH>Audit</SH>
        <Ro label="Last Audit Date" value={sub.last_audit_date?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ last_audit_date: v || null })} />
        <div className="col-span-2">
          <label className={labelCls}>Audit Note</label>
          <textarea className={textareaCls} rows={2} defaultValue={sub.audit_note ?? ''} onBlur={(e) => patch({ audit_note: e.target.value || null })} />
        </div>

        <SH>Notes</SH>
        <div className="col-span-full">
          <label className={labelCls}>Experience / Skills / Certs</label>
          <textarea className={textareaCls} rows={2} defaultValue={sub.experience_skills_certs ?? ''} onBlur={(e) => patch({ experience_skills_certs: e.target.value || null })} />
        </div>
        <div className="col-span-full">
          <label className={labelCls}>Preferred Toolset</label>
          <input className={inputCls} defaultValue={sub.preferred_toolset ?? ''} onBlur={(e) => patch({ preferred_toolset: e.target.value || null })} />
        </div>
        <div className="col-span-full">
          <label className={labelCls}>General Notes</label>
          <textarea className={textareaCls} rows={3} defaultValue={sub.notes ?? ''} onBlur={(e) => patch({ notes: e.target.value || null })} />
        </div>
      </div>
    </div>
  )
}

function FinancialTab({ sub, patch }: { sub: Subcontractor; patch: (u: Partial<Subcontractor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <Ro label="TIN / EIN" value={sub.tin_ein} onBlur={(v) => patch({ tin_ein: v || null })} />
        <Ro label="Hourly Rate" value={sub.hourly_rate?.toString()} type="number" onBlur={(v) => patch({ hourly_rate: v === '' ? null : Number(v) })} />
        <Ro label="Day Rate" value={sub.day_rate?.toString()} type="number" onBlur={(v) => patch({ day_rate: v === '' ? null : Number(v) })} />
        <div>
          <label className={labelCls}>Payment Terms</label>
          <select className={inputCls} value={sub.payment_terms ?? ''} onChange={(e) => patch({ payment_terms: e.target.value || null })}>
            <option value="">—</option>
            {PAYMENT_TERMS_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Ro label="Late Fee Policy" value={sub.late_fee_policy} onBlur={(v) => patch({ late_fee_policy: v || null })} />
        <Ro label="Invoicing Contact" value={sub.invoicing_contact} onBlur={(v) => patch({ invoicing_contact: v || null })} />
        <div className="col-span-full">
          <label className={labelCls}>Accepted Payment Methods</label>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {ACCEPTED_PAYMENT_METHODS_OPTIONS.map((m) => {
              const sel = (sub.accepted_payment_methods ?? []).includes(m)
              return <Ck key={m} label={m} checked={sel} onChange={(v) => {
                const next = v ? [...(sub.accepted_payment_methods ?? []), m] : (sub.accepted_payment_methods ?? []).filter((x) => x !== m)
                patch({ accepted_payment_methods: next.length ? next : [] })
              }} />
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ComplianceTab({ sub, patch }: { sub: Subcontractor; patch: (u: Partial<Subcontractor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <div className="col-span-full flex flex-wrap gap-x-5 gap-y-2">
          <Ck label="E-Verified" checked={sub.e_verified} onChange={(v) => patch({ e_verified: v })} />
          <Ck label="W9 Received" checked={sub.w9_received} onChange={(v) => patch({ w9_received: v })} />
          <Ck label="Insurance Certs" checked={sub.insurance_certs} onChange={(v) => patch({ insurance_certs: v })} />
          <Ck label="Sub Agreement Signed" checked={sub.sub_agreement_signed} onChange={(v) => patch({ sub_agreement_signed: v })} />
          <Ck label="Signed Contract" checked={sub.doc_signed_contract} onChange={(v) => patch({ doc_signed_contract: v })} />
          <Ck label="Licenses on File" checked={sub.doc_licenses} onChange={(v) => patch({ doc_licenses: v })} />
        </div>
        <Ro label="COI Expiration" value={sub.coi_expiration_date?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ coi_expiration_date: v || null })} />
        <Ro label="Workers Comp Expiry" value={sub.workers_comp_expiry?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ workers_comp_expiry: v || null })} />
        <Ro label="General Liability Expiry" value={sub.general_liability_expiry?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ general_liability_expiry: v || null })} />
        <Ro label="Background Check Status" value={sub.background_check_status} onBlur={(v) => patch({ background_check_status: v || null })} />
        <Ro label="Safety Rating (EMR)" value={sub.safety_rating_emr?.toString()} type="number" onBlur={(v) => patch({ safety_rating_emr: v === '' ? null : Number(v) })} />
        <Ro label="License Number" value={sub.license_number} onBlur={(v) => patch({ license_number: v || null })} />
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <AddressesPanel entityType="subcontractor" entityId={sub.id} />
      </div>
    </div>
  )
}

function SkillsTab({ sub, patch }: { sub: Subcontractor; patch: (u: Partial<Subcontractor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-1 gap-y-3">
        <div>
          <label className={labelCls}>Work Disciplines</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {DISCIPLINE_TYPES.map((d) => (
              <button key={d} type="button" className="rounded-full border px-3 py-0.5 text-xs font-semibold border-border text-muted-foreground hover:bg-muted">
                {d}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Discipline toggles will be wired to subcontractor_types junction table</p>
        </div>
        <div>
          <label className={labelCls}>Experience / Skills / Certs</label>
          <textarea className={textareaCls} rows={4} defaultValue={sub.experience_skills_certs ?? ''} onBlur={(e) => patch({ experience_skills_certs: e.target.value || null })} />
        </div>
        <div>
          <label className={labelCls}>Certified Brands</label>
          <input className={inputCls} defaultValue={(sub.certified_brands ?? []).join(', ')} onBlur={(e) => {
            const vals = e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
            patch({ certified_brands: vals.length ? vals : [] })
          }} placeholder="Comma-separated: Axis, Lenel, Genetec" />
        </div>
        <div className="flex items-center gap-4">
          <Ck label="Government Labor Provider" checked={sub.government_labor_provider} onChange={(v) => patch({ government_labor_provider: v })} />
        </div>
        <Ro label="Preferred Toolset" value={sub.preferred_toolset} onBlur={(v) => patch({ preferred_toolset: v || null })} />
      </div>
    </div>
  )
}
