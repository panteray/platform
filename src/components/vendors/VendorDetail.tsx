'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { Vendor } from '@/types/database'
import { StatusBadge, TierBadge, ScoreBadge, DiscountTag } from '@/components/shared/EntityHelpers'
import { ContactsPanel } from '@/components/customers/ContactsPanel'
import { AddressesPanel } from '@/components/customers/AddressesPanel'
import {
  US_STATES, VENDOR_CATEGORY_OPTIONS, VENDOR_STATUSES, PARTNER_LEVELS,
  DISCIPLINE_TYPES, PAYMENT_TERMS_OPTIONS, ACCEPTED_PAYMENT_METHODS_OPTIONS,
} from '@/types/enums'

interface VendorDetailProps { vendorId: string }

type Tab = 'Overview' | 'Details' | 'Contacts' | 'Documents' | 'Financial' | 'RMA & Support' | 'Procurement' | 'Partner Status' | 'Linked Data'
const TABS: Tab[] = ['Overview', 'Details', 'Contacts', 'Documents', 'Financial', 'RMA & Support', 'Procurement', 'Partner Status', 'Linked Data']

const inputCls = 'h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
const labelCls = 'block text-[11px] font-medium text-muted-foreground mb-1'
const textareaCls = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical'

function SH({ children }: { children: string }) {
  return (
    <div className="col-span-full mt-1 border-b border-border pb-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{children}</span>
    </div>
  )
}

export function VendorDetail({ vendorId }: VendorDetailProps) {
  const router = useRouter()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')

  const load = useCallback(async () => {
    const res = await fetch('/api/org/vendors')
    if (!res.ok) return
    const data: Vendor[] = await res.json()
    setVendor(data.find((v) => v.id === vendorId) ?? null)
    setLoading(false)
  }, [vendorId])

  useEffect(() => { load() }, [load])

  const patch = useCallback(async (update: Partial<Vendor>) => {
    if (!vendor) return
    const res = await fetch('/api/org/vendors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: vendor.id, ...update }),
    })
    if (res.ok) {
      const updated = await res.json()
      setVendor(updated)
    }
  }, [vendor])

  async function handleDelete() {
    if (!confirm('Delete this vendor? This cannot be undone.')) return
    const res = await fetch(`/api/org/vendors?id=${vendorId}`, { method: 'DELETE' })
    if (res.ok) router.push('/org/vendors')
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>
  if (!vendor) return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-sm text-muted-foreground">Vendor not found.</p>
      <Link href="/org/vendors" className="text-sm text-primary hover:underline">Back to vendors</Link>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5 flex-wrap">
        <Link href="/org/vendors" className="rounded p-1.5 hover:bg-muted"><ArrowLeft className="h-4 w-4 text-muted-foreground" /></Link>
        <span className="text-[13px] text-muted-foreground">Vendors</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-base font-semibold text-foreground">{vendor.name}</span>
        <StatusBadge status={vendor.status} />
        <TierBadge tier={vendor.partner_level} />
        <DiscountTag pct={vendor.partner_discount_pct} />
        <ScoreBadge score={vendor.overall_score} />
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

      {tab === 'Overview' && <OverviewTab vendor={vendor} patch={patch} />}
      {tab === 'Details' && <DetailsTab vendor={vendor} patch={patch} />}
      {tab === 'Contacts' && <ContactsPanel entityType="vendor" entityId={vendorId} />}
      {tab === 'Documents' && <PlaceholderTab label="Documents" />}
      {tab === 'Financial' && <FinancialTab vendor={vendor} patch={patch} />}
      {tab === 'RMA & Support' && <RmaTab vendor={vendor} patch={patch} />}
      {tab === 'Procurement' && <ProcurementTab vendor={vendor} patch={patch} />}
      {tab === 'Partner Status' && <PartnerTab vendor={vendor} patch={patch} />}
      {tab === 'Linked Data' && <PlaceholderTab label="Linked Data" />}
    </div>
  )
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">{label} — coming in future phase</p>
    </div>
  )
}

function OverviewTab({ vendor, patch }: { vendor: Vendor; patch: (u: Partial<Vendor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <SH>Identity</SH>
        <Ro label="Vendor Number" value={vendor.vendor_number} readOnly />
        <Ro label="Vendor Name" value={vendor.name} onBlur={(v) => patch({ name: v || '' })} />
        <Ro label="Official Business Name" value={vendor.official_business_name} onBlur={(v) => patch({ official_business_name: v || null })} />
        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={vendor.product_category ?? ''} onChange={(e) => patch({ product_category: e.target.value || null })}>
            <option value="">—</option>
            {VENDOR_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <SH>Location</SH>
        <div className="col-span-full flex gap-2.5">
          <div className="flex-[3]"><Ro label="Address" value={vendor.address} onBlur={(v) => patch({ address: v || null })} /></div>
          <div className="flex-[2]"><Ro label="City" value={vendor.city} onBlur={(v) => patch({ city: v || null })} /></div>
          <div className="flex-1">
            <label className={labelCls}>State</label>
            <select className={inputCls} value={vendor.state ?? ''} onChange={(e) => patch({ state: e.target.value || null })}>
              <option value="">—</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1"><Ro label="Zip" value={vendor.zip} onBlur={(v) => patch({ zip: v || null })} /></div>
        </div>
        <Ro label="Region" value={vendor.region} onBlur={(v) => patch({ region: v || null })} />
        <div>
          <label className={labelCls}>Region State</label>
          <select className={inputCls} value={vendor.region_state ?? ''} onChange={(e) => patch({ region_state: e.target.value || null })}>
            <option value="">—</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <SH>Contact</SH>
        <Ro label="Contact Name" value={vendor.contact_name} onBlur={(v) => patch({ contact_name: v || null })} />
        <Ro label="Contact Email" value={vendor.contact_email} onBlur={(v) => patch({ contact_email: v || null })} />
        <Ro label="Contact Phone" value={vendor.contact_phone} onBlur={(v) => patch({ contact_phone: v || null })} />
        <Ro label="Support Email" value={vendor.support_email} onBlur={(v) => patch({ support_email: v || null })} />
        <Ro label="Primary Website" value={vendor.primary_website} onBlur={(v) => patch({ primary_website: v || null })} />
        <div />

        <SH>Flags</SH>
        <div className="col-span-full flex flex-wrap gap-x-5 gap-y-2">
          <Ck label="E-Verified" checked={vendor.e_verified} onChange={(v) => patch({ e_verified: v })} />
          <Ck label="W9 Received" checked={vendor.w9_received} onChange={(v) => patch({ w9_received: v })} />
          <Ck label="Signed Contract" checked={vendor.doc_signed_contract} onChange={(v) => patch({ doc_signed_contract: v })} />
          <Ck label="Licenses on File" checked={vendor.doc_licenses} onChange={(v) => patch({ doc_licenses: v })} />
          <Ck label="Preferred Vendor" checked={vendor.preferred_vendor} onChange={(v) => patch({ preferred_vendor: v })} />
          <Ck label="API Integration" checked={vendor.api_integration_available} onChange={(v) => patch({ api_integration_available: v })} />
          <Ck label="Price List Uploaded" checked={vendor.price_list_uploaded} onChange={(v) => patch({ price_list_uploaded: v })} />
          <Ck label="NDAA Compliant" checked={vendor.is_ndaa_compliant} onChange={(v) => patch({ is_ndaa_compliant: v })} />
        </div>

        <SH>Dates</SH>
        <Ro label="Last Price Update" value={vendor.last_price_update_date?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ last_price_update_date: v || null })} />
        <div />
      </div>
    </div>
  )
}

function DetailsTab({ vendor, patch }: { vendor: Vendor; patch: (u: Partial<Vendor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-3 gap-x-3.5 gap-y-2.5">
        <SH>Status & Tier</SH>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={vendor.status ?? ''} onChange={(e) => patch({ status: e.target.value || null })}>
            <option value="">—</option>
            {VENDOR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Partner Level</label>
          <select className={inputCls} value={vendor.partner_level ?? ''} onChange={(e) => patch({ partner_level: e.target.value || null })}>
            <option value="">—</option>
            {PARTNER_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <Ro label="Partner Discount %" value={vendor.partner_discount_pct?.toString()} type="number" onBlur={(v) => patch({ partner_discount_pct: v === '' ? null : Number(v) })} />

        <SH>Health Scores</SH>
        <Ro label="Onboarding Health Score" value={vendor.onboarding_health_score?.toString()} type="number" onBlur={(v) => patch({ onboarding_health_score: v === '' ? null : Number(v) })} />
        <Ro label="Overall Score" value={vendor.overall_score?.toString()} type="number" onBlur={(v) => patch({ overall_score: v === '' ? null : Number(v) })} />
        <Ro label="Onboarded By" value={vendor.onboarded_by} onBlur={(v) => patch({ onboarded_by: v || null })} />

        <SH>Service States</SH>
        <div className="col-span-full flex flex-wrap gap-1">
          {US_STATES.map((s) => {
            const active = (vendor.service_states ?? []).includes(s)
            return (
              <button key={s} type="button" onClick={() => {
                const next = active ? (vendor.service_states ?? []).filter((x) => x !== s) : [...(vendor.service_states ?? []), s]
                patch({ service_states: next.length ? next : [] })
              }}
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
                {s}
              </button>
            )
          })}
        </div>

        <SH>Disciplines</SH>
        <div className="col-span-full flex flex-wrap gap-1.5">
          {DISCIPLINE_TYPES.map((d) => {
            const active = (vendor.disciplines ?? []).includes(d)
            return (
              <button key={d} type="button" onClick={() => {
                const cur = vendor.disciplines ?? []
                patch({ disciplines: active ? cur.filter((x) => x !== d) : [...cur, d] })
              }}
                className={`rounded-full border px-3 py-0.5 text-xs font-semibold transition-colors ${active ? 'border-primary bg-primary text-white' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                {d}
              </button>
            )
          })}
        </div>

        <SH>Audit</SH>
        <Ro label="Last Audit Date" value={vendor.last_audit_date?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ last_audit_date: v || null })} />
        <div className="col-span-2">
          <label className={labelCls}>Audit Note</label>
          <textarea className={textareaCls} rows={2} defaultValue={vendor.audit_note ?? ''} onBlur={(e) => patch({ audit_note: e.target.value || null })} />
        </div>

        <SH>Notes</SH>
        <div className="col-span-full">
          <label className={labelCls}>General Notes</label>
          <textarea className={textareaCls} rows={3} defaultValue={vendor.notes ?? ''} onBlur={(e) => patch({ notes: e.target.value || null })} />
        </div>
      </div>
    </div>
  )
}

function FinancialTab({ vendor, patch }: { vendor: Vendor; patch: (u: Partial<Vendor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <Ro label="TIN / EIN" value={vendor.tin_ein} onBlur={(v) => patch({ tin_ein: v || null })} />
        <div>
          <label className={labelCls}>Payment Terms</label>
          <select className={inputCls} value={vendor.payment_terms ?? ''} onChange={(e) => patch({ payment_terms: e.target.value || null })}>
            <option value="">—</option>
            {PAYMENT_TERMS_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Ro label="Late Fee Policy" value={vendor.late_fee_policy} onBlur={(v) => patch({ late_fee_policy: v || null })} />
        <Ro label="Invoicing Contact" value={vendor.invoicing_contact} onBlur={(v) => patch({ invoicing_contact: v || null })} />
        <Ro label="Credit Limit" value={vendor.credit_limit?.toString()} type="number" onBlur={(v) => patch({ credit_limit: v === '' ? null : Number(v) })} />
        <div />
        <div className="col-span-full">
          <label className={labelCls}>Accepted Payment Methods</label>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {ACCEPTED_PAYMENT_METHODS_OPTIONS.map((m) => {
              const sel = (vendor.accepted_payment_methods ?? []).includes(m)
              return <Ck key={m} label={m} checked={sel} onChange={(v) => {
                const next = v ? [...(vendor.accepted_payment_methods ?? []), m] : (vendor.accepted_payment_methods ?? []).filter((x) => x !== m)
                patch({ accepted_payment_methods: next.length ? next : [] })
              }} />
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function RmaTab({ vendor, patch }: { vendor: Vendor; patch: (u: Partial<Vendor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <Ro label="RMA Contact Name" value={vendor.rma_contact_name} onBlur={(v) => patch({ rma_contact_name: v || null })} />
        <Ro label="RMA Support Phone" value={vendor.rma_support_phone} onBlur={(v) => patch({ rma_support_phone: v || null })} />
        <div className="col-span-full">
          <label className={labelCls}>RMA Policy</label>
          <textarea className={textareaCls} rows={2} defaultValue={vendor.rma_policy ?? ''} onBlur={(e) => patch({ rma_policy: e.target.value || null })} />
        </div>
        <Ro label="RMA Portal Link" value={vendor.rma_portal_link} onBlur={(v) => patch({ rma_portal_link: v || null })} />
        <Ro label="Warranty Policy Link" value={vendor.warranty_policy_link} onBlur={(v) => patch({ warranty_policy_link: v || null })} />
        <Ro label="Support Portal Login" value={vendor.support_portal_login} onBlur={(v) => patch({ support_portal_login: v || null })} />
        <div />
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <AddressesPanel entityType="vendor" entityId={vendor.id} />
      </div>
    </div>
  )
}

function ProcurementTab({ vendor, patch }: { vendor: Vendor; patch: (u: Partial<Vendor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <Ro label="Org Procurement Lead" value={vendor.org_procurement_lead} onBlur={(v) => patch({ org_procurement_lead: v || null })} />
        <div className="flex items-center gap-5 pt-5">
          <Ck label="Preferred Vendor" checked={vendor.preferred_vendor} onChange={(v) => patch({ preferred_vendor: v })} />
          <Ck label="API Integration" checked={vendor.api_integration_available} onChange={(v) => patch({ api_integration_available: v })} />
          <Ck label="Price List Uploaded" checked={vendor.price_list_uploaded} onChange={(v) => patch({ price_list_uploaded: v })} />
        </div>
        <Ro label="Lead Time (avg days)" value={vendor.lead_time_avg_days?.toString()} type="number" onBlur={(v) => patch({ lead_time_avg_days: v === '' ? null : Number(v) })} />
        <Ro label="Standard Shipping Method" value={vendor.standard_shipping_method} onBlur={(v) => patch({ standard_shipping_method: v || null })} />
        <Ro label="Shipping Account Number" value={vendor.shipping_account_number} onBlur={(v) => patch({ shipping_account_number: v || null })} />
        <Ro label="Last Price Update" value={vendor.last_price_update_date?.toString().slice(0, 10)} type="date" onBlur={(v) => patch({ last_price_update_date: v || null })} />
      </div>
    </div>
  )
}

function PartnerTab({ vendor, patch }: { vendor: Vendor; patch: (u: Partial<Vendor>) => Promise<void> }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
        <div>
          <label className={labelCls}>Partner Level</label>
          <select className={inputCls} value={vendor.partner_level ?? ''} onChange={(e) => patch({ partner_level: e.target.value || null })}>
            <option value="">— None —</option>
            {PARTNER_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <Ro label="Discount % off MSRP" value={vendor.partner_discount_pct?.toString()} type="number" onBlur={(v) => patch({ partner_discount_pct: v === '' ? null : Number(v) })} />
        <Ro label="Discount Tier" value={vendor.discount_tier} onBlur={(v) => patch({ discount_tier: v || null })} />
        <div />
      </div>
      {vendor.partner_level && (
        <div className="mt-4 rounded-lg border border-border p-4" style={{ background: 'rgba(59,130,246,0.06)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Current Partner Status</p>
          <p className="text-sm font-medium text-foreground">
            {vendor.partner_level}
            {vendor.partner_discount_pct != null && ` — ${vendor.partner_discount_pct}% off MSRP`}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Field helpers ──
function Ro({ label, value, onBlur, type = 'text', readOnly }: {
  label: string; value: string | null | undefined; onBlur?: (v: string) => void; type?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} className={inputCls} defaultValue={value ?? ''} readOnly={readOnly}
        onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined} />
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
