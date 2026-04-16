'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileText, Trash2, Plus, ExternalLink } from 'lucide-react'

interface SubDocument {
  id: string
  doc_type: string
  doc_name: string
  storage_url: string | null
  issued_date: string | null
  expires_at: string | null
  policy_number: string | null
  carrier: string | null
  coverage_amount: number | null
  is_active: boolean
  notes: string | null
  created_at: string
}

const DOC_TYPES = ['license', 'coi', 'w9', 'bond', 'umbrella', 'auto', 'workers_comp', 'other'] as const

export function SubDocumentsTab({ subId }: { subId: string }) {
  const [docs, setDocs] = useState<SubDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({
    doc_type: 'license',
    doc_name: '',
    storage_url: '',
    issued_date: '',
    expires_at: '',
    policy_number: '',
    carrier: '',
    coverage_amount: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/org/subcontractors/${subId}/documents`)
    if (res.ok) setDocs(await res.json())
    setLoading(false)
  }, [subId])

  useEffect(() => { load() }, [subId, load])

  async function create() {
    if (!form.doc_name) return
    const body: Record<string, unknown> = {
      doc_type: form.doc_type,
      doc_name: form.doc_name,
      storage_url: form.storage_url || null,
      issued_date: form.issued_date || null,
      expires_at: form.expires_at || null,
      policy_number: form.policy_number || null,
      carrier: form.carrier || null,
      coverage_amount: form.coverage_amount ? Number(form.coverage_amount) : null,
      notes: form.notes || null,
    }
    const res = await fetch(`/api/org/subcontractors/${subId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setShowNew(false)
      setForm({ doc_type: 'license', doc_name: '', storage_url: '', issued_date: '', expires_at: '', policy_number: '', carrier: '', coverage_amount: '', notes: '' })
      load()
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this document?')) return
    await fetch(`/api/org/subcontractors/${subId}/documents?doc_id=${id}`, { method: 'DELETE' })
    load()
  }

  function expiryBadge(d: SubDocument) {
    if (!d.expires_at) return null
    const exp = new Date(d.expires_at)
    const now = new Date()
    const days = Math.floor((exp.getTime() - now.getTime()) / 86400000)
    if (days < 0) return <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Expired</span>
    if (days < 30) return <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">{days}d left</span>
    return <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Valid</span>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Compliance documents, insurance, licenses, bonds</div>
        <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
          <Plus size={14} /> Add Document
        </button>
      </div>

      {showNew && (
        <div className="rounded border border-border bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Type</label>
              <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-sm">
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Document Name</label>
              <input value={form.doc_name} onChange={(e) => setForm({ ...form, doc_name: e.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-medium text-muted-foreground">Storage URL (paste link to uploaded file)</label>
              <input value={form.storage_url} onChange={(e) => setForm({ ...form, storage_url: e.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Issued Date</label>
              <input type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Expires</label>
              <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Policy/License #</label>
              <input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Carrier/Issuer</label>
              <input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Coverage Amount</label>
              <input type="number" value={form.coverage_amount} onChange={(e) => setForm({ ...form, coverage_amount: e.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">Save</button>
            <button onClick={() => setShowNew(false)} className="rounded border border-border px-3 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="rounded border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No documents uploaded yet
        </div>
      ) : (
        <div className="rounded border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Issued</th>
                <th className="px-3 py-2 text-left">Expires</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-xs uppercase">{d.doc_type}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-muted-foreground" />
                      <span>{d.doc_name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">{d.issued_date ? new Date(d.issued_date).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2 text-xs">{d.expires_at ? new Date(d.expires_at).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2">{expiryBadge(d)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {d.storage_url && (
                        <a href={d.storage_url} target="_blank" rel="noreferrer" className="rounded border border-border p-1 hover:bg-muted">
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button onClick={() => remove(d.id)} className="rounded border border-red-300 p-1 text-red-600 hover:bg-red-50">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
