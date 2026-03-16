'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { US_STATES } from '@/types/enums'
interface Props { onSave: (data: Record<string, unknown>) => Promise<void>; onCancel: () => void; saving?: boolean }
export function DistributorForm({ onSave, onCancel, saving }: Props) {
  const [form, setForm] = useState({ name: '', account_number: '', rep_name: '', rep_email: '', state: '' })
  function set(key: string, value: string) { setForm((p) => ({ ...p, [key]: value })) }
  async function handleSubmit(e: React.FormEvent) { e.preventDefault(); const p: Record<string, unknown> = { ...form }; if (!p.state) p.state = null; await onSave(p) }
  const ic = 'h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring'
  const lc = 'text-[11px] font-medium text-muted-foreground'
  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">Quick Add Distributor</h3><button type="button" onClick={onCancel} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1"><label className={lc}>Name *</label><input className={ic} value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
        <div className="min-w-[120px] flex-1"><label className={lc}>Account #</label><input className={ic} value={form.account_number} onChange={(e) => set('account_number', e.target.value)} /></div>
        <div className="min-w-[120px] flex-1"><label className={lc}>Rep Name</label><input className={ic} value={form.rep_name} onChange={(e) => set('rep_name', e.target.value)} /></div>
        <div className="min-w-[160px] flex-1"><label className={lc}>Rep Email</label><input className={ic} type="email" value={form.rep_email} onChange={(e) => set('rep_email', e.target.value)} /></div>
        <div className="min-w-[80px] flex-1"><label className={lc}>State</label><select className={ic} value={form.state} onChange={(e) => set('state', e.target.value)}><option value="">—</option>{US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        <button type="submit" disabled={saving || !form.name.trim()} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{saving ? 'Saving...' : 'Create'}</button>
      </div>
    </form>
  )
}
