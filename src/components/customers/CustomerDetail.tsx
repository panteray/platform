'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, MapPin, Users, FileText, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { Customer } from '@/types/database'
import { CustomerForm } from '@/components/customers/CustomerForm'
import { ContactsPanel } from '@/components/customers/ContactsPanel'
import { AddressesPanel } from '@/components/customers/AddressesPanel'

interface CustomerDetailProps {
  customerId: string
}

type Tab = 'overview' | 'contacts' | 'addresses'

export function CustomerDetail({ customerId }: CustomerDetailProps) {
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')

  const load = useCallback(async () => {
    const res = await fetch('/api/org/customers')
    if (!res.ok) return
    const data: Customer[] = await res.json()
    const found = data.find((c) => c.id === customerId)
    setCustomer(found ?? null)
    setLoading(false)
  }, [customerId])

  useEffect(() => { load() }, [load])

  async function handleSave(formData: Record<string, unknown>) {
    setSaving(true)
    const res = await fetch('/api/org/customers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: customerId, ...formData }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCustomer(updated)
      setEditing(false)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    const res = await fetch(`/api/org/customers?id=${customerId}`, { method: 'DELETE' })
    if (res.ok) router.push('/org/customers')
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">Customer not found.</p>
        <Link href="/org/customers" className="text-sm text-primary hover:underline">Back to customers</Link>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: typeof Building2 }[] = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'contacts', label: 'Contacts', icon: Users },
    { key: 'addresses', label: 'Addresses', icon: MapPin },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Link href="/org/customers" className="rounded p-1.5 hover:bg-muted">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-medium text-foreground">{customer.name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{customer.customer_number}</span>
            {customer.customer_type && <span className="rounded bg-muted px-1.5 py-0.5">{customer.customer_type}</span>}
            {customer.tier && <span className="rounded bg-muted px-1.5 py-0.5">{customer.tier}</span>}
            <span className={`rounded px-1.5 py-0.5 ${
              customer.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-400'
            }`}>
              {customer.status ?? 'active'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
            >
              Edit
            </button>
          )}
          <button onClick={handleDelete} className="rounded p-1.5 hover:bg-muted">
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        editing ? (
          <CustomerForm
            initial={customer}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            saving={saving}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Info card */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 text-[13px] font-semibold text-foreground">Company Information</h3>
              <dl className="grid gap-2 text-xs">
                {([
                  ['Official Name', customer.official_business_name],
                  ['Contact', customer.contact_name],
                  ['Email', customer.contact_email],
                  ['Phone', customer.contact_phone],
                  ['Address', customer.address],
                  ['State', customer.state],
                  ['Website', customer.primary_website],
                  ['Territory', customer.territory],
                ] as [string, string | null][]).map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium text-foreground">{val ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {/* Financial card */}
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 text-[13px] font-semibold text-foreground">Financial</h3>
              <dl className="grid gap-2 text-xs">
                {([
                  ['Payment Terms', customer.payment_terms],
                  ['TIN/EIN', customer.tin_ein],
                  ['W9 Received', customer.w9_received ? 'Yes' : 'No'],
                  ['Contract Signed', customer.doc_signed_contract ? 'Yes' : 'No'],
                  ['Tax Exempt', customer.tax_exempt ? 'Yes' : 'No'],
                ] as [string, string | null][]).map(([label, val]) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium text-foreground">{val ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {/* Notes */}
            {customer.notes && (
              <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
                <h3 className="mb-2 text-[13px] font-semibold text-foreground">Notes</h3>
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">{customer.notes}</p>
              </div>
            )}
          </div>
        )
      )}

      {tab === 'contacts' && (
        <ContactsPanel entityType="customer" entityId={customerId} />
      )}

      {tab === 'addresses' && (
        <AddressesPanel entityType="customer" entityId={customerId} />
      )}
    </div>
  )
}
