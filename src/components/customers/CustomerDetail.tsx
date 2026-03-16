'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { Customer } from '@/types/database'
import { StatusBadge, TierBadge, ScoreBadge } from '@/components/shared/EntityHelpers'
import { ContactsPanel } from '@/components/customers/ContactsPanel'
import { AddressesPanel } from '@/components/customers/AddressesPanel'
import {
  US_STATES, ENTITY_TYPES, ONBOARDING_STATUSES,
  PAYMENT_TERMS_OPTIONS, ACCEPTED_PAYMENT_METHODS_OPTIONS,
} from '@/types/enums'
import { CustomerType, CustomerTier } from '@/types/enums'

interface CustomerDetailProps { customerId: string }

type Tab = 'Overview' | 'Details' | 'Tech Stack' | 'Contacts' | 'Documents' | 'Financial' | 'Inventory' | 'Linked Data'
const TABS: Tab[] = ['Overview', 'Details', 'Tech Stack', 'Contacts', 'Documents', 'Financial', 'Inventory', 'Linked Data']

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

export function CustomerDetail({ customerId }: CustomerDetailProps) {
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/customers?id=${customerId}`)
    if (!res.ok) { setLoading(false); return }
    const data: Customer = await res.json()
    setCustomer(data)
    setLoading(false)
  }, [customerId])

  useEffect(() => { load() }, [load])

  const patch = useCallback(async (update: Partial<Customer>) => {
    if (!customer) return
    const res = await fetch('/api/org/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: customer.id, ...update }),
    })
    if (res.ok) setCustomer(await res.json())
  }, [customer])

  async function handleDelete() {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    const res = await fetch(`/api/org/customers?id=${customerId}`, { method: 'DELETE' })
    if (res.ok) router.push('/org/customers')
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>
  if (!customer) return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-sm text-muted-foreground">Customer not found.</p>
      <Link href="/org/customers" className="text-sm text-primary hover:underline">Back to customers</Link>
    </div>
  )

  return (
    <div>
      {/* Unified Header */}
      <div className="mb-3 flex items-center gap-2.5 flex-wrap">
        <Link href="/org/customers" className="rounded p-1.5 hover:bg-muted"><ArrowLeft className="h-4 w-4 text-muted-foreground" /></Link>
        <span className="text-[13px] text-muted-foreground">Customers</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-base font-semibold text-foreground">{customer.name}</span>
        <StatusBadge status={customer.onboarding_status ?? customer.status} />
        <TierBadge tier={customer.tier} />
        <ScoreBadge score={customer.overall_score} />
        <div className="flex-1" />
        <button onClick={handleDelete} className="rounded p-1.5 hover:bg-muted"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" /></button>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-0 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`border-b-2 px-3.5 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab customer={customer} patch={patch} />}
      {tab === 'Details' && <DetailsTab customer={customer} patch={patch} />}
      {tab === 'Tech Stack' && <TechStackTab customer={customer} patch={patch} />}
      {tab === 'Contacts' && <ContactsPanel entityType="customer" entityId={customerId} />}
      {tab === 'Documents' && <Placeholder label="Documents" />}
      {tab === 'Financial' && <FinancialTab customer={customer} patch={patch} />}
      {tab === 'Inventory' && <Placeholder label="Inventory" />}
      {tab === 'Linked Data' && <Placeholder label="Linked Data" />}
    </div>
  )
}

function Placeholder({ label }: { label: string }) {
  return <div className="rounded-lg border border-border bg-card p-8 text-center"><p className="text-sm text-muted-foreground">{label} — coming in future phase</p></div>
}

function OverviewTab({ customer, patch }: { customer: Customer; patch: (u: Partial<Customer>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <SH>Identity</SH>
        <Ro label="Customer Number" value={customer.customer_number} readOnly />
        <Ro label="Company Name" value={customer.name} onBlur={(v) => patch({ name: v || '' })} />
        <Ro label="Official Business Name" value={customer.official_business_name} onBlur={(v) => patch({ official_business_name: v || null })} />
        <div>
          <label className={labelCls}>Entity Type</label>
          <select className={inputCls} value={customer.entity_type ?? ''} onChange={(e) => patch({ entity_type: e.target.value || '' })}>
            <option value="">—</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Industry</label>
          <select className={inputCls} value={customer.customer_type ?? ''} onChange={(e) => patch({ customer_type: (e.target.value || null) as CustomerType | null })}>
            <option value="">—</option>
            {Object.values(CustomerType).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Ro label="Status" value={customer.status} onBlur={(v) => patch({ status: v || null })} />

        <SH>Location</SH>
        <div className="col-span-full flex gap-2.5">
          <div className="flex-[3]"><Ro label="Payment Address" value={customer.payment_address} onBlur={(v) => patch({ payment_address: v || null })} /></div>
          <div className="flex-[2]"><Ro label="City" value={customer.payment_city} onBlur={(v) => patch({ payment_city: v || null })} /></div>
          <div className="flex-1">
            <label className={labelCls}>State</label>
            <select className={inputCls} value={customer.payment_state ?? ''} onChange={(e) => patch({ payment_state: e.target.value || null })}>
              <option value="">—</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1"><Ro label="Zip" value={customer.payment_zip} onBlur={(v) => patch({ payment_zip: v || null })} /></div>
        </div>
        <Ro label="Territory" value={customer.territory} onBlur={(v) => patch({ territory: v || null })} />
        <Ro label="Region" value={customer.region} onBlur={(v) => patch({ region: v || null })} />
        <div>
          <label className={labelCls}>Region State</label>
          <select className={inputCls} value={customer.region_state ?? ''} onChange={(e) => patch({ region_state: e.target.value || null })}>
            <option value="">—</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div />

        <SH>Contact</SH>
        <Ro label="Contact Name" value={customer.contact_name} onBlur={(v) => patch({ contact_name: v || null })} />
        <Ro label="Primary Email" value={customer.contact_email} onBlur={(v) => patch({ contact_email: v || null })} />
        <Ro label="Telephone" value={customer.telephone} onBlur={(v) => patch({ telephone: v || null })} />
        <Ro label="Primary Website" value={customer.primary_website} onBlur={(v) => patch({ primary_website: v || null })} />
        <Ro label="Emergency Contact" value={customer.emergency_contact} onBlur={(v) => patch({ emergency_contact: v || null })} />
        <div />

        <SH>Flags</SH>
        <div className="col-span-full flex flex-wrap gap-x-5 gap-y-2">
          <Ck label="W9 Received" checked={customer.w9_received} onChange={(v) => patch({ w9_received: v })} />
          <Ck label="Signed Contract" checked={customer.doc_signed_contract} onChange={(v) => patch({ doc_signed_contract: v })} />
          <Ck label="Licenses on File" checked={customer.doc_licenses} onChange={(v) => patch({ doc_licenses: v })} />
          <Ck label="Setup Required" checked={customer.setup_required} onChange={(v) => patch({ setup_required: v })} />
          <Ck label="Setup Complete" checked={customer.setup_complete} onChange={(v) => patch({ setup_complete: v })} />
          <Ck label="Tax Exempt" checked={customer.tax_exempt} onChange={(v) => patch({ tax_exempt: v })} />
        </div>

        <SH>Dates</SH>
        <Ro label="Contract Start" value={customer.contract_start_date?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ contract_start_date: v || null })} />
        <Ro label="Contract Renewal" value={customer.contract_renewal_date?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ contract_renewal_date: v || null })} />
        <Ro label="Target Go-Live" value={customer.target_go_live_date?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ target_go_live_date: v || null })} />
        <div />
      </div>
    </div>
  )
}

function DetailsTab({ customer, patch }: { customer: Customer; patch: (u: Partial<Customer>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-3 gap-x-3.5 gap-y-2.5">
        <SH>Status & Tier</SH>
        <div>
          <label className={labelCls}>Tier</label>
          <select className={inputCls} value={customer.tier ?? ''} onChange={(e) => patch({ tier: (e.target.value || null) as CustomerTier | null })}>
            <option value="">—</option>
            {Object.values(CustomerTier).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Priority</label>
          <select className={inputCls} value={customer.tier_priority?.toString() ?? ''} onChange={(e) => patch({ tier_priority: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">—</option>
            <option value="1">1 — Highest</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5 — Lowest</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Onboarding Status</label>
          <select className={inputCls} value={customer.onboarding_status ?? ''} onChange={(e) => patch({ onboarding_status: e.target.value || null })}>
            <option value="">—</option>
            {ONBOARDING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <SH>Health Scores</SH>
        <Ro label="Onboarding Health Score" value={customer.onboarding_health_score?.toString()} type="number" onBlur={(v) => patch({ onboarding_health_score: v === '' ? null : Number(v) })} />
        <Ro label="Overall Score" value={customer.overall_score?.toString()} type="number" onBlur={(v) => patch({ overall_score: v === '' ? null : Number(v) })} />
        <Ro label="Onboarded By" value={customer.onboarded_by} onBlur={(v) => patch({ onboarded_by: v || null })} />

        <SH>Customer Scores</SH>
        <Ro label="Payment Behavior" value={customer.payment_behavior_score?.toString()} type="number" onBlur={(v) => patch({ payment_behavior_score: v === '' ? null : Number(v) })} />
        <Ro label="Response Time" value={customer.response_time_score?.toString()} type="number" onBlur={(v) => patch({ response_time_score: v === '' ? null : Number(v) })} />
        <Ro label="Delay Frequency" value={customer.delay_frequency_score?.toString()} type="number" onBlur={(v) => patch({ delay_frequency_score: v === '' ? null : Number(v) })} />
        <Ro label="Ease of Working" value={customer.ease_of_working_score?.toString()} type="number" onBlur={(v) => patch({ ease_of_working_score: v === '' ? null : Number(v) })} />
        <Ro label="Signature Timeframe" value={customer.signature_timeframe_score?.toString()} type="number" onBlur={(v) => patch({ signature_timeframe_score: v === '' ? null : Number(v) })} />
        <div />

        <SH>Service States</SH>
        <div className="col-span-full flex flex-wrap gap-1">
          {US_STATES.map((s) => {
            const active = (customer.service_states ?? []).includes(s)
            return (
              <button key={s} type="button" onClick={() => {
                const next = active ? (customer.service_states ?? []).filter((x) => x !== s) : [...(customer.service_states ?? []), s]
                patch({ service_states: next.length ? next : [] })
              }}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
                {s}
              </button>
            )
          })}
        </div>

        <SH>Audit</SH>
        <Ro label="Last Audit Date" value={customer.last_audit_date?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ last_audit_date: v || null })} />
        <div className="col-span-2">
          <label className={labelCls}>Audit Note</label>
          <textarea className={textareaCls} rows={2} defaultValue={customer.audit_note ?? ''} onBlur={(e) => patch({ audit_note: e.target.value || null })} />
        </div>

        <SH>Notes</SH>
        <div className="col-span-full">
          <label className={labelCls}>Referral Source</label>
          <input className={inputCls} defaultValue={customer.referral_source ?? ''} onBlur={(e) => patch({ referral_source: e.target.value || null })} />
        </div>
        <div className="col-span-full">
          <label className={labelCls}>Site Access Notes</label>
          <textarea className={textareaCls} rows={2} defaultValue={customer.site_access_notes ?? ''} onBlur={(e) => patch({ site_access_notes: e.target.value || null })} />
        </div>
        <div className="col-span-full">
          <label className={labelCls}>General Notes</label>
          <textarea className={textareaCls} rows={3} defaultValue={customer.notes ?? ''} onBlur={(e) => patch({ notes: e.target.value || null })} />
        </div>
      </div>
    </div>
  )
}

function TechStackTab({ customer, patch }: { customer: Customer; patch: (u: Partial<Customer>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <SH>Current Technology</SH>
        <div className="col-span-full">
          <label className={labelCls}>Current Tech Stack</label>
          <textarea className={textareaCls} rows={3} defaultValue={customer.current_tech_stack ?? ''} onBlur={(e) => patch({ current_tech_stack: e.target.value || null })} />
        </div>
        <div className="col-span-full">
          <label className={labelCls}>Pain Points</label>
          <textarea className={textareaCls} rows={3} defaultValue={customer.pain_points ?? ''} onBlur={(e) => patch({ pain_points: e.target.value || null })} />
        </div>
        <div className="col-span-full">
          <label className={labelCls}>Success Metric Goal</label>
          <textarea className={textareaCls} rows={2} defaultValue={customer.success_metric_goal ?? ''} onBlur={(e) => patch({ success_metric_goal: e.target.value || null })} />
        </div>
        <Ro label="MAC/Serial Inventory Link" value={customer.mac_serial_inventory_link} onBlur={(v) => patch({ mac_serial_inventory_link: v || null })} />
        <div />
      </div>
    </div>
  )
}

function FinancialTab({ customer, patch }: { customer: Customer; patch: (u: Partial<Customer>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <Ro label="TIN / EIN" value={customer.tin_ein} onBlur={(v) => patch({ tin_ein: v || null })} />
        <div>
          <label className={labelCls}>Payment Terms</label>
          <select className={inputCls} value={customer.payment_terms ?? ''} onChange={(e) => patch({ payment_terms: e.target.value || null })}>
            <option value="">—</option>
            {PAYMENT_TERMS_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Ro label="Late Fee Policy" value={customer.late_fee_policy} onBlur={(v) => patch({ late_fee_policy: v || null })} />
        <Ro label="Invoicing Contact" value={customer.invoicing_contact} onBlur={(v) => patch({ invoicing_contact: v || null })} />
        <div className="col-span-full">
          <label className={labelCls}>Accepted Payment Methods</label>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {ACCEPTED_PAYMENT_METHODS_OPTIONS.map((m) => {
              const sel = (customer.accepted_payment_methods ?? []).includes(m)
              return <Ck key={m} label={m} checked={sel} onChange={(v) => {
                const next = v ? [...(customer.accepted_payment_methods ?? []), m] : (customer.accepted_payment_methods ?? []).filter((x) => x !== m)
                patch({ accepted_payment_methods: next.length ? next : [] })
              }} />
            })}
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <AddressesPanel entityType="customer" entityId={customer.id} />
      </div>
    </div>
  )
}
