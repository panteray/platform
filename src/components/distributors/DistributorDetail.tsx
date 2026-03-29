'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { Distributor } from '@/types/database'
import { ContactsPanel } from '@/components/customers/ContactsPanel'
import { AddressesPanel } from '@/components/customers/AddressesPanel'
import { US_STATES, PAYMENT_TERMS_OPTIONS, DISTRIBUTOR_STATUSES, CARRIER_OPTIONS } from '@/types/enums'

interface Props { distributorId: string }
type Tab = 'Overview' | 'Contacts' | 'Documents' | 'Linked Data'
const TABS: Tab[] = ['Overview', 'Contacts', 'Documents', 'Linked Data']
const ic = 'h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
const lc = 'block text-[11px] font-medium text-muted-foreground mb-1'
const tc = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical'

function SH({ children }: { children: string }) { return <div className="col-span-full mt-1 border-b border-border pb-1"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{children}</span></div> }
function Ro({ label, value, onBlur, type = 'text' }: { label: string; value: string | null | undefined; onBlur?: (v: string) => void; type?: string }) { return <div><label className={lc}>{label}</label><input type={type} className={ic} defaultValue={value ?? ''} onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined} /></div> }
function Ck({ label, checked, onChange }: { label: string; checked: boolean; onChange?: (v: boolean) => void }) { return <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer whitespace-nowrap"><input type="checkbox" checked={checked} onChange={onChange ? (e) => onChange(e.target.checked) : undefined} className="accent-primary" />{label}</label> }

export function DistributorDetail({ distributorId }: Props) {
  const router = useRouter()
  const [dist, setDist] = useState<Distributor | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')

  const load = useCallback(async () => {
    const res = await fetch('/api/org/distributors')
    if (!res.ok) return
    const data: Distributor[] = await res.json()
    setDist(data.find((d) => d.id === distributorId) ?? null); setLoading(false)
  }, [distributorId])
  useEffect(() => { load() }, [load])

  const patch = useCallback(async (update: Partial<Distributor>) => {
    if (!dist) return
    const res = await fetch('/api/org/distributors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dist.id, ...update }) })
    if (res.ok) setDist(await res.json())
  }, [dist])

  async function handleDelete() { if (!confirm('Delete this distributor?')) return; const res = await fetch(`/api/org/distributors?id=${distributorId}`, { method: 'DELETE' }); if (res.ok) router.push('/org/distributors') }

  if (loading) return <div className="flex h-64 items-center justify-center"><p className="text-sm text-muted-foreground">Loading...</p></div>
  if (!dist) return <div className="flex h-64 flex-col items-center justify-center gap-2"><p className="text-sm text-muted-foreground">Distributor not found.</p><Link href="/org/distributors" className="text-sm text-primary hover:underline">Back to distributors</Link></div>

  return (
    <div>
      <div className="mb-3 flex items-center gap-2.5 flex-wrap">
        <Link href="/org/distributors" className="rounded p-1.5 hover:bg-muted"><ArrowLeft className="h-4 w-4 text-muted-foreground" /></Link>
        <span className="text-[13px] text-muted-foreground">Distributors</span><span className="text-muted-foreground">/</span>
        <span className="text-base font-semibold text-foreground">{dist.name}</span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${dist.status === 'Active' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>{dist.status ?? '—'}</span>
        {dist.is_preferred && <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-500">Preferred</span>}
        <div className="flex-1" /><button onClick={handleDelete} className="rounded p-1.5 hover:bg-muted"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" /></button>
      </div>
      <div className="mb-3 flex gap-0 border-b border-border overflow-x-auto">
        {TABS.map((t) => (<button key={t} onClick={() => setTab(t)} className={`border-b-2 px-3.5 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t}</button>))}
      </div>
      {tab === 'Overview' && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
            <SH>Identity</SH>
            <Ro label="Distributor Number" value={dist.distributor_number} onBlur={(v) => patch({ distributor_number: v || null })} />
            <Ro label="Name" value={dist.name} onBlur={(v) => patch({ name: v || '' })} />
            <Ro label="Account Number" value={dist.account_number} onBlur={(v) => patch({ account_number: v || null })} />
            <div><label className={lc}>Status</label><select className={ic} value={dist.status ?? ''} onChange={(e) => patch({ status: e.target.value || null })}><option value="">—</option>{DISTRIBUTOR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <Ro label="Website" value={dist.website} onBlur={(v) => patch({ website: v || null })} />
            <Ro label="Portal Login" value={dist.portal_login} onBlur={(v) => patch({ portal_login: v || null })} />
            <SH>Rep Contact</SH>
            <Ro label="Rep Name" value={dist.rep_name} onBlur={(v) => patch({ rep_name: v || null })} />
            <Ro label="Rep Email" value={dist.rep_email} onBlur={(v) => patch({ rep_email: v || null })} />
            <Ro label="Rep Phone" value={dist.rep_phone} onBlur={(v) => patch({ rep_phone: v || null })} />
            <div />
            <SH>Location</SH>
            <div className="col-span-full flex gap-2.5">
              <div className="flex-[3]"><Ro label="Address" value={dist.address} onBlur={(v) => patch({ address: v || null })} /></div>
              <div className="flex-[2]"><Ro label="City" value={dist.city} onBlur={(v) => patch({ city: v || null })} /></div>
              <div className="flex-1"><label className={lc}>State</label><select className={ic} value={dist.state ?? ''} onChange={(e) => patch({ state: e.target.value || null })}><option value="">—</option>{US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="flex-1"><Ro label="Zip" value={dist.zip} onBlur={(v) => patch({ zip: v || null })} /></div>
            </div>
            <Ro label="Region" value={dist.region} onBlur={(v) => patch({ region: v || null })} />
            <div><label className={lc}>Region State</label><select className={ic} value={dist.region_state ?? ''} onChange={(e) => patch({ region_state: e.target.value || null })}><option value="">—</option>{US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <SH>Financial</SH>
            <div><label className={lc}>Payment Terms</label><select className={ic} value={dist.payment_terms ?? ''} onChange={(e) => patch({ payment_terms: e.target.value || null })}><option value="">—</option>{PAYMENT_TERMS_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <Ro label="Credit Limit" value={dist.credit_limit?.toString()} type="number" onBlur={(v) => patch({ credit_limit: v === '' ? null : Number(v) })} />
            <Ro label="Discount Tier" value={dist.discount_tier} onBlur={(v) => patch({ discount_tier: v || null })} />
            <div />
            <SH>Shipping</SH>
            <div className="col-span-full"><label className={lc}>Shipping Methods</label>
              <div className="flex flex-wrap gap-x-5 gap-y-2">{CARRIER_OPTIONS.map((c) => { const sel = (dist.shipping_methods ?? []).includes(c); return <Ck key={c} label={c} checked={sel} onChange={(v) => { const next = v ? [...(dist.shipping_methods ?? []), c] : (dist.shipping_methods ?? []).filter((x) => x !== c); patch({ shipping_methods: next.length ? next : [] }) }} /> })}</div>
            </div>
            <SH>Flags</SH>
            <div className="col-span-full flex flex-wrap gap-x-5 gap-y-2">
              <Ck label="Preferred Distributor" checked={dist.is_preferred} onChange={(v) => patch({ is_preferred: v })} />
              <Ck label="Active" checked={dist.is_active} onChange={(v) => patch({ is_active: v })} />
            </div>
            <SH>Notes</SH>
            <div className="col-span-full"><label className={lc}>Notes</label><textarea className={tc} rows={3} defaultValue={dist.notes ?? ''} onBlur={(e) => patch({ notes: e.target.value || null })} /></div>
          </div>
          <div className="mt-4 border-t border-border pt-4"><AddressesPanel entityType="distributor" entityId={dist.id} /></div>
        </div>
      )}
      {tab === 'Contacts' && <ContactsPanel entityType="distributor" entityId={distributorId} />}
      {tab === 'Documents' && <div className="rounded-lg border border-border bg-card p-8 text-center"><p className="text-sm text-muted-foreground">Documents — coming in future phase</p></div>}
      {tab === 'Linked Data' && <div className="rounded-lg border border-border bg-card p-8 text-center"><p className="text-sm text-muted-foreground">Linked Data — coming in future phase</p></div>}
    </div>
  )
}
