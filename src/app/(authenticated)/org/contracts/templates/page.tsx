'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, ArrowLeft } from 'lucide-react'
import type { ContractTemplate } from '@/types/database'
import { CONTRACT_TEMPLATE_TYPES, CONTRACT_TEMPLATE_TYPE_LABELS } from '@/types/database'

export default function ContractTemplatesListPage() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'MSA' as ContractTemplate['type'] })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/org/contracts/templates')
    if (res.ok) setTemplates(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!form.name) return
    const res = await fetch('/api/org/contracts/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const data = await res.json()
      window.location.href = `/org/contracts/templates/${data.id}`
    }
  }

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    ACTIVE: 'bg-green-100 text-green-700',
    ARCHIVED: 'bg-slate-100 text-slate-500',
  }

  return (
    <div className="p-6 space-y-6">
      <Link href="/org/contracts" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16} /> Back to Contracts
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contract Templates</h1>
          <p className="text-sm text-slate-500">Reusable contract templates for generating customer contracts</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">
          <Plus size={16} /> New Template
        </button>
      </div>

      {showNew && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Template name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border border-slate-300 px-3 py-2 text-sm" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ContractTemplate['type'] })} className="rounded border border-slate-300 px-3 py-2 text-sm">
              {CONTRACT_TEMPLATE_TYPES.map((t) => <option key={t} value={t}>{CONTRACT_TEMPLATE_TYPE_LABELS[t]}</option>)}
            </select>
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
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Version</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Loading...</td></tr>
            ) : templates.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No templates yet</td></tr>
            ) : templates.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/org/contracts/templates/${t.id}`} className="text-blue-600 hover:underline">{t.name}</Link>
                </td>
                <td className="px-4 py-3 text-xs">{CONTRACT_TEMPLATE_TYPE_LABELS[t.type]}</td>
                <td className="px-4 py-3 text-xs">v{t.version}</td>
                <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-medium ${statusColors[t.status]}`}>{t.status}</span></td>
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
