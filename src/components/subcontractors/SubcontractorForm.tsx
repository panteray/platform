'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { US_STATES, SUB_TYPES } from '@/types/enums'

interface SubcontractorFormProps {
  onSave: (data: Record<string, unknown>) => Promise<void>
  onCancel: () => void
  saving?: boolean
}

export function SubcontractorForm({ onSave, onCancel, saving }: SubcontractorFormProps) {
  const [form, setForm] = useState({ name: '', type: '', contact_email: '', region_state: '' })
  function set(key: string, value: string) { setForm((prev) => ({ ...prev, [key]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: Record<string, unknown> = { ...form }
    if (!payload.type) payload.type = null
    if (!payload.region_state) payload.region_state = null
    await onSave(payload)
  }

  const inputCls = 'h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
  const labelCls = 'text-[11px] font-medium text-muted-foreground'

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Quick Add Subcontractor</h3>
        <button type="button" onClick={onCancel} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1">
          <label className={labelCls}>Name *</label>
          <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} required autoComplete="organization" />
        </div>
        <div className="min-w-[100px] flex-1">
          <label className={labelCls}>Type</label>
          <select className={inputCls} value={form.type} onChange={(e) => set('type', e.target.value)}>
            <option value="">—</option>
            {SUB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="min-w-[160px] flex-1">
          <label className={labelCls}>Contact Email</label>
          <input className={inputCls} type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} autoComplete="off" />
        </div>
        <div className="min-w-[100px] flex-1">
          <label className={labelCls}>State</label>
          <select className={inputCls} value={form.region_state} onChange={(e) => set('region_state', e.target.value)}>
            <option value="">—</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" disabled={saving || !form.name.trim()} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {saving ? 'Saving...' : 'Create'}
        </button>
      </div>
    </form>
  )
}
