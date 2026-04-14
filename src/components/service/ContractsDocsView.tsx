'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import type { GeneratedContract, ContractTemplate } from '@/types/database'
import { CONTRACT_TEMPLATE_TYPE_LABELS } from '@/types/database'

type ContractRow = GeneratedContract & {
  customer?: { id: string; name: string } | null
  template?: { id: string; name: string; type: string } | null
}

export default function ContractsDocsView() {
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([])
  const [form, setForm] = useState({ template_id: '', customer_id: '', title: '' })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/org/contracts/generated')
    if (res.ok) setContracts(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/org/contracts/templates?status=ACTIVE').then(async (r) => { if (r.ok) setTemplates(await r.json()) })
    fetch('/api/org/customers').then(async (r) => { if (r.ok) setCustomers(await r.json()) })
  }, [])

  async function create() {
    if (!form.template_id || !form.customer_id || !form.title) return
    const res = await fetch('/api/org/contracts/generated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const data = await res.json()
      setShowNew(false)
      setForm({ template_id: '', customer_id: '', title: '' })
      window.location.href = `/org/contracts/${data.id}`
    }
  }

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    PENDING_REVIEW: 'bg-yellow-100 text-yellow-700',
    SENT: 'bg-blue-100 text-blue-700',
    PARTIAL_SIGN: 'bg-purple-100 text-purple-700',
    ACTIVE: 'bg-green-100 text-green-700',
    EXPIRED: 'bg-slate-100 text-slate-500',
    CANCELLED: 'bg-red-100 text-red-700',
    AMENDED: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contracts</h1>
          <p className="text-sm text-slate-500">Customer contracts generated from templates</p>
        </div>
        <div className="flex gap-2">
          <Link href="/org/contracts/templates" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">Templates</Link>
          <Link href="/org/contracts/clauses" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">Clauses</Link>
          <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">
            <Plus size={16} /> Generate Contract
          </button>
        </div>
      </div>

      {showNew && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <select value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select Template</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({CONTRACT_TEMPLATE_TYPE_LABELS[t.type]})</option>)}
            </select>
            <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select Customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Contract title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">Create</button>
            <button onClick={() => setShowNew(false)} className="rounded border border-slate-300 px-3 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Contract #</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading...</td></tr>
            ) : contracts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No contracts yet</td></tr>
            ) : contracts.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/org/contracts/${c.id}`} className="text-blue-600 hover:underline">{c.contract_number}</Link>
                </td>
                <td className="px-4 py-3">{c.title}</td>
                <td className="px-4 py-3">{c.customer?.name ?? '—'}</td>
                <td className="px-4 py-3 text-xs">{CONTRACT_TEMPLATE_TYPE_LABELS[c.template_type] ?? c.template_type}</td>
                <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-medium ${statusColors[c.status] ?? ''}`}>{c.status}</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
