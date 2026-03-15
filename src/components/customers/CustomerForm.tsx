'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { CustomerType, CustomerTier } from '@/types/enums'

interface CustomerFormProps {
  initial?: Partial<{
    name: string
    official_business_name: string
    customer_type: string
    tier: string
    contact_name: string
    contact_email: string
    contact_phone: string
    address: string
    state: string
    primary_website: string
    territory: string
    payment_terms: string
    notes: string
  }>
  onSave: (data: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  saving?: boolean
}

export function CustomerForm({ initial, onSave, onCancel, saving }: CustomerFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    official_business_name: initial?.official_business_name ?? '',
    customer_type: initial?.customer_type ?? '',
    tier: initial?.tier ?? '',
    contact_name: initial?.contact_name ?? '',
    contact_email: initial?.contact_email ?? '',
    contact_phone: initial?.contact_phone ?? '',
    address: initial?.address ?? '',
    state: initial?.state ?? '',
    primary_website: initial?.primary_website ?? '',
    territory: initial?.territory ?? '',
    payment_terms: initial?.payment_terms ?? '',
    notes: initial?.notes ?? '',
  })

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: Record<string, unknown> = { ...form }
    if (!payload.customer_type) payload.customer_type = null
    if (!payload.tier) payload.tier = null
    await onSave(payload)
  }

  const inputCls = 'h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
  const labelCls = 'text-xs font-medium text-muted-foreground'

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {initial?.name ? 'Edit Customer' : 'New Customer'}
        </h3>
        <button type="button" onClick={onCancel} className="rounded p-1 hover:bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelCls}>Company Name *</label>
          <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} required autoComplete="organization" />
        </div>
        <div>
          <label className={labelCls}>Official Business Name</label>
          <input className={inputCls} value={form.official_business_name} onChange={(e) => set('official_business_name', e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select className={inputCls} value={form.customer_type} onChange={(e) => set('customer_type', e.target.value)}>
            <option value="">Select...</option>
            {Object.values(CustomerType).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Tier</label>
          <select className={inputCls} value={form.tier} onChange={(e) => set('tier', e.target.value)}>
            <option value="">Select...</option>
            {Object.values(CustomerTier).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Contact Name</label>
          <input className={inputCls} value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label className={labelCls}>Contact Email</label>
          <input className={inputCls} type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label className={labelCls}>Contact Phone</label>
          <input className={inputCls} value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} autoComplete="tel" />
        </div>
        <div>
          <label className={labelCls}>Address</label>
          <input className={inputCls} value={form.address} onChange={(e) => set('address', e.target.value)} autoComplete="street-address" />
        </div>
        <div>
          <label className={labelCls}>State</label>
          <input className={inputCls} value={form.state} onChange={(e) => set('state', e.target.value)} autoComplete="address-level1" />
        </div>
        <div>
          <label className={labelCls}>Website</label>
          <input className={inputCls} value={form.primary_website} onChange={(e) => set('primary_website', e.target.value)} autoComplete="url" />
        </div>
        <div>
          <label className={labelCls}>Territory</label>
          <input className={inputCls} value={form.territory} onChange={(e) => set('territory', e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label className={labelCls}>Payment Terms</label>
          <input className={inputCls} value={form.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} autoComplete="off" placeholder="e.g. Net 30" />
        </div>
      </div>

      <div className="mt-4">
        <label className={labelCls}>Notes</label>
        <textarea
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          rows={2}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : (initial?.name ? 'Save Changes' : 'Create Customer')}
        </button>
      </div>
    </form>
  )
}
