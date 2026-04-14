'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, FileText, TrendingUp } from 'lucide-react'
import type { ServiceContract, ContractStatus } from '@/types/database'
import { ContractBillingModelForm, EMPTY_CONTRACT_FORM, type ContractFormState } from '@/components/psa/ContractBillingModelForm'

type ContractRow = ServiceContract & { customer: { id: string; name: string } | null }

const STATUS_COLORS: Record<ContractStatus, string> = {
  DRAFT: 'bg-neutral-200 text-neutral-700',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  PAUSED: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-neutral-100 text-neutral-500',
  EXPIRED: 'bg-neutral-100 text-neutral-500',
  RENEWED: 'bg-blue-100 text-blue-800',
}

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([])
  const [rmrSummary, setRmrSummary] = useState<{ mrr: number; arr: number; active_count: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ContractFormState>(EMPTY_CONTRACT_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/org/psa/contracts').then(r => r.ok ? r.json() : []),
      fetch('/api/org/customers').then(r => r.ok ? r.json() : []),
      fetch('/api/org/psa/reports/rmr').then(r => r.ok ? r.json() : null),
    ]).then(([cs, custs, rmr]) => {
      setContracts(cs)
      setCustomers((custs ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      setRmrSummary(rmr)
    }).finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function create() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/org/psa/contracts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customer_id: form.customer_id,
        name: form.name,
        billing_model: form.billing_model,
        billing_cycle: form.billing_cycle,
        start_date: form.start_date,
        end_date: form.end_date || null,
        auto_renew: form.auto_renew,
        renewal_notice_days: form.renewal_notice_days,
        annual_escalation_pct: form.annual_escalation_pct,
        block_hours_total: form.block_hours_total ? Number(form.block_hours_total) : null,
        block_rollover_type: form.block_rollover_type,
        block_rollover_cap: form.block_rollover_cap ? Number(form.block_rollover_cap) : null,
        overage_rate: form.overage_rate ? Number(form.overage_rate) : null,
        notes: form.notes || null,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      setError(e.error ?? 'Failed to create contract')
      return
    }
    setShowForm(false)
    setForm(EMPTY_CONTRACT_FORM)
    load()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Service Contracts</h1>
          <p className="text-sm text-muted-foreground">Recurring billing contracts and RMR</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'New Contract'}
        </button>
      </div>

      {rmrSummary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> MRR
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{money(rmrSummary.mrr)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> ARR
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{money(rmrSummary.arr)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <FileText className="h-4 w-4" /> Active Contracts
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{rmrSummary.active_count}</div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Create Contract</h3>
          <ContractBillingModelForm state={form} onChange={setForm} customers={customers} />
          {error && <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500">{error}</div>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_CONTRACT_FORM) }}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={busy || !form.name || !form.customer_id}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create Contract'}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!loading && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Contract #</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Next Bill</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No contracts yet</td></tr>
              )}
              {contracts.map(c => (
                <tr key={c.id} className="border-t border-border hover:bg-accent/40">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/org/psa/contracts/${c.id}`} className="text-primary hover:underline">
                      {c.contract_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">{c.customer?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs uppercase">{c.billing_model.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-xs">{c.billing_cycle}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.next_bill_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
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
