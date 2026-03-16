'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Customer } from '@/types/database'
import { OppType, CustomerType, US_STATES, REQUEST_TYPE_OPTIONS, LABOR_REQUIREMENT_OPTIONS } from '@/types/enums'
import { AddressesPanel } from '@/components/customers/AddressesPanel'

type OrgUser = { id: string; first_name: string; last_name: string; email: string; role: string; divisions?: string[] }

export default function CreateOppPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [territories, setTerritories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdOppId, setCreatedOppId] = useState<string | null>(null)

  // Section 1 — Identity
  const [oppNumber, setOppNumber] = useState('')
  const [oppType, setOppType] = useState('')
  const [customerVertical, setCustomerVertical] = useState('')
  const [status] = useState('NEW')

  // Section 2 — Customer & Location
  const [customerId, setCustomerId] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [systemName, setSystemName] = useState('')
  const [installAddress, setInstallAddress] = useState('')
  const [state, setState] = useState('')
  const [campusBldgRm, setCampusBldgRm] = useState('')
  const [multipleLocations, setMultipleLocations] = useState('')
  const [territory, setTerritory] = useState('')

  // Section 3 — Team
  const [assignedIsrId, setAssignedIsrId] = useState('')
  const [assignedOsrId, setAssignedOsrId] = useState('')
  const [assignedPresalesId, setAssignedPresalesId] = useState('')

  // Section 4 — Details
  const [requestType, setRequestType] = useState('')
  const [laborRequirement, setLaborRequirement] = useState('')
  const [quoteExpectedDate, setQuoteExpectedDate] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [notes, setNotes] = useState('')

  // Section 5 — POC
  const [pocName, setPocName] = useState('')
  const [pocPhone, setPocPhone] = useState('')
  const [pocEmail, setPocEmail] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/org/customers').then((r) => r.ok ? r.json() : []),
      fetch('/api/org/users').then((r) => r.ok ? r.json() : []),
    ]).then(([c, u]) => { setCustomers(c); setOrgUsers(u) })
    fetch('/api/profile').then(async (r) => {
      if (!r.ok) return
      const p = await r.json()
      if (p.org?.settings?.territories) setTerritories(p.org.settings.territories)
    }).catch(() => {})
  }, [])

  // Auto-populate from customer selection
  function handleCustomerChange(cid: string) {
    setCustomerId(cid)
    if (!cid) return
    const c = customers.find((x) => x.id === cid)
    if (!c) return
    if (c.contact_name) setPocName(c.contact_name)
    if (c.contact_email) setPocEmail(c.contact_email)
    if (c.contact_phone) setPocPhone(c.contact_phone)
    if (c.customer_type) setCustomerVertical(c.customer_type)
    if (c.address) setInstallAddress(c.address)
    if (c.state) setState(c.state)
    if (c.territory) setTerritory(c.territory)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)

    let resolvedCustomerId = customerId || null
    if (showNewCustomer && newCustomerName.trim()) {
      const res = await fetch('/api/org/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCustomerName.trim() }) })
      if (!res.ok) { setError('Failed to create customer'); setSaving(false); return }
      const newCust = await res.json(); resolvedCustomerId = newCust.id
    }

    const body: Record<string, unknown> = {
      opp_number: oppNumber || undefined, opp_type: oppType || undefined, status,
      customer_id: resolvedCustomerId, customer_vertical: customerVertical || undefined,
      project_name: projectName || undefined, system_name: systemName || undefined,
      install_address: installAddress || undefined, state: state || undefined,
      campus_bldg_rm: campusBldgRm || undefined, multiple_locations: multipleLocations || undefined,
      territory: territory || undefined, request_type: requestType || undefined,
      labor_requirement: laborRequirement || undefined, quote_expected_date: quoteExpectedDate || undefined,
      project_description: projectDescription || undefined, notes: notes || undefined,
      assigned_isr_id: assignedIsrId || undefined, assigned_osr_id: assignedOsrId || undefined,
      assigned_presales_id: assignedPresalesId || undefined,
      poc_name: pocName || undefined, poc_phone: pocPhone || undefined, poc_email: pocEmail || undefined,
    }

    const res = await fetch('/api/org/opportunities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await res.json()
    if (!res.ok) { setError(result.error || 'Failed to create'); setSaving(false); return }
    setCreatedOppId(result.id)
    router.push(`/org/opportunities/${result.id}`)
  }

  const isrUsers = orgUsers.filter((u) => u.role === 'SALES_ISR')
  const osrUsers = orgUsers.filter((u) => u.role === 'SALES_OSR')
  const presalesUsers = orgUsers.filter((u) => {
    if (u.role !== 'PRESALES') return false
    if (!oppType) return true
    return (u.divisions ?? []).includes(oppType)
  })

  const ic = 'h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
  const lc = 'block text-[11px] font-medium text-muted-foreground mb-1'
  const tc = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-vertical'
  const shCls = 'text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-4 mb-2 border-b border-border pb-1'

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/org/opportunities" className="rounded p-1.5 hover:bg-muted"><ArrowLeft className="h-4 w-4 text-muted-foreground" /></Link>
        <h1 className="text-lg font-medium">Create Opportunity</h1>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Section 1 — Identity */}
        <p className={shCls}>1. Identity</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lc}>OPP Number</label><input className={ic} placeholder="Auto-generated (OPP-000001)" value={oppNumber} onChange={(e) => setOppNumber(e.target.value)} /></div>
          <div><label className={lc}>OPP Type (Discipline)</label><select className={ic} value={oppType} onChange={(e) => { setOppType(e.target.value); setAssignedPresalesId('') }}><option value="">Select type...</option>{Object.values(OppType).map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lc}>Customer Vertical</label><select className={ic} value={customerVertical} onChange={(e) => setCustomerVertical(e.target.value)}><option value="">—</option>{Object.values(CustomerType).map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={lc}>Status</label><input className={ic} value="NEW" disabled style={{ opacity: 0.6 }} /></div>
        </div>

        {/* Section 2 — Customer & Location */}
        <p className={shCls}>2. Customer & Location</p>
        <div>
          <label className={lc}>Customer</label>
          {!showNewCustomer ? (
            <div className="flex gap-2">
              <select className={ic} value={customerId} onChange={(e) => handleCustomerChange(e.target.value)}><option value="">Select customer...</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <button type="button" onClick={() => setShowNewCustomer(true)} className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted whitespace-nowrap">New</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input className={ic} placeholder="New customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
              <button type="button" onClick={() => { setShowNewCustomer(false); setNewCustomerName('') }} className="h-9 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lc}>Project Name</label><input className={ic} value={projectName} onChange={(e) => setProjectName(e.target.value)} /></div>
          <div><label className={lc}>System Name</label><input className={ic} value={systemName} onChange={(e) => setSystemName(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lc}>Install Address</label><input className={ic} value={installAddress} onChange={(e) => setInstallAddress(e.target.value)} /></div>
          <div><label className={lc}>State</label><select className={ic} value={state} onChange={(e) => setState(e.target.value)}><option value="">—</option>{US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className={lc}>Campus / Bldg / Rm</label><input className={ic} value={campusBldgRm} onChange={(e) => setCampusBldgRm(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lc}>Territory</label><select className={ic} value={territory} onChange={(e) => setTerritory(e.target.value)}><option value="">—</option>{territories.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={lc}>Multiple Locations</label><select className={ic} value={multipleLocations} onChange={(e) => setMultipleLocations(e.target.value)}><option value="">—</option><option value="Yes">Yes</option><option value="No">No</option></select></div>
        </div>
        {multipleLocations === 'Yes' && createdOppId && <AddressesPanel entityType="opportunity" entityId={createdOppId} />}
        {multipleLocations === 'Yes' && !createdOppId && <p className="text-xs text-muted-foreground">Additional addresses can be added after creation.</p>}

        {/* Section 3 — Team Assignment */}
        <p className={shCls}>3. Team Assignment</p>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lc}>Assigned ISR</label><select className={ic} value={assignedIsrId} onChange={(e) => setAssignedIsrId(e.target.value)}><option value="">—</option>{isrUsers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
          <div><label className={lc}>Assigned OSR</label><select className={ic} value={assignedOsrId} onChange={(e) => setAssignedOsrId(e.target.value)}><option value="">—</option>{osrUsers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}</select></div>
          <div>
            <label className={lc}>Assigned Presales</label>
            <select className={ic} value={assignedPresalesId} onChange={(e) => setAssignedPresalesId(e.target.value)} disabled={!oppType} style={!oppType ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
              <option value="">—</option>{presalesUsers.map((u) => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
            </select>
            {!oppType && <p className="text-[10px] text-muted-foreground mt-0.5">Select OPP Type first</p>}
          </div>
        </div>

        {/* Section 4 — Details */}
        <p className={shCls}>4. Details</p>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lc}>Request Type</label><select className={ic} value={requestType} onChange={(e) => setRequestType(e.target.value)}><option value="">—</option>{REQUEST_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={lc}>Labor Requirement</label><select className={ic} value={laborRequirement} onChange={(e) => setLaborRequirement(e.target.value)}><option value="">—</option>{LABOR_REQUIREMENT_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={lc}>Quote Expected Date</label><input type="date" className={ic} value={quoteExpectedDate} onChange={(e) => setQuoteExpectedDate(e.target.value)} /></div>
        </div>
        <div><label className={lc}>Project Description</label><textarea className={tc} rows={3} value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} /></div>
        <div><label className={lc}>Notes</label><textarea className={tc} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

        {/* Section 5 — POC */}
        <p className={shCls}>5. Point of Contact</p>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lc}>POC Name</label><input className={ic} value={pocName} onChange={(e) => setPocName(e.target.value)} /></div>
          <div><label className={lc}>POC Phone</label><input className={ic} value={pocPhone} onChange={(e) => setPocPhone(e.target.value)} /></div>
          <div><label className={lc}>POC Email</label><input className={ic} type="email" value={pocEmail} onChange={(e) => setPocEmail(e.target.value)} /></div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={saving} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? 'Creating...' : 'Create Opportunity'}</button>
          <Link href="/org/opportunities" className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm text-muted-foreground hover:bg-muted">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
