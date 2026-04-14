'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, FileText, Play, Pause, X as XIcon } from 'lucide-react'
import type { ServiceContract, ContractLineItem, ContractEvent, ContractStatus } from '@/types/database'
import { BlockTimeLedger } from '@/components/psa/BlockTimeLedger'

type ContractDetail = ServiceContract & {
  customer: { id: string; name: string } | null
  line_items: ContractLineItem[]
  events: ContractEvent[]
  invoices: Array<{ id: string; invoice_number: string; status: string; total: number; issued_at: string }>
}

const STATUS_COLORS: Record<ContractStatus, string> = {
  DRAFT: 'bg-neutral-200 text-neutral-700',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  PAUSED: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-neutral-100 text-neutral-500',
  EXPIRED: 'bg-neutral-100 text-neutral-500',
  RENEWED: 'bg-blue-100 text-blue-800',
}

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [contract, setContract] = useState<ContractDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [addingLine, setAddingLine] = useState(false)
  const [lineDesc, setLineDesc] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [lineRate, setLineRate] = useState('0')

  const load = useCallback(() => {
    fetch(`/api/org/psa/contracts/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setContract(d))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  if (!contract) return <div className="p-6 text-sm text-red-500">Contract not found</div>

  const monthlyTotal = contract.line_items.reduce((s, l) => s + Number(l.monthly_amount ?? 0), 0)

  async function setStatus(status: ContractStatus) {
    setBusy(true)
    await fetch(`/api/org/psa/contracts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setBusy(false)
    load()
  }

  async function billNow() {
    setBusy(true)
    const res = await fetch(`/api/org/psa/contracts/${id}/bill-now`, { method: 'POST' })
    setBusy(false)
    if (res.ok) {
      const inv = await res.json()
      window.location.href = `/org/psa/invoices/${inv.id}`
    } else {
      const e = await res.json().catch(() => ({}))
      alert(e.error ?? 'Failed to bill')
    }
  }

  async function addLine() {
    if (!lineDesc.trim()) return
    setBusy(true)
    await fetch(`/api/org/psa/contracts/${id}/line-items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        description: lineDesc,
        quantity: Number(lineQty) || 1,
        unit_rate: Number(lineRate) || 0,
      }),
    })
    setBusy(false)
    setLineDesc(''); setLineQty('1'); setLineRate('0'); setAddingLine(false)
    load()
  }

  async function removeLine(lineId: string) {
    setBusy(true)
    await fetch(`/api/org/psa/contracts/${id}/line-items?line_id=${lineId}`, { method: 'DELETE' })
    setBusy(false)
    load()
  }

  return (
    <div className="space-y-6 p-6">
      <Link href="/org/psa/contracts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to contracts
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">{contract.contract_number}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[contract.status]}`}>
              {contract.status}
            </span>
          </div>
          <p className="mt-1 text-base font-medium">{contract.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {contract.customer?.name ?? '—'} • {contract.billing_model.replace(/_/g, ' ')} • {contract.billing_cycle}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {contract.status === 'DRAFT' && (
            <button onClick={() => setStatus('ACTIVE')} disabled={busy}
              className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              <Play className="h-4 w-4" /> Activate
            </button>
          )}
          {contract.status === 'ACTIVE' && (
            <>
              <button onClick={billNow} disabled={busy || contract.line_items.length === 0}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <FileText className="h-4 w-4" /> Bill Now
              </button>
              <button onClick={() => setStatus('PAUSED')} disabled={busy}
                className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
                <Pause className="h-4 w-4" /> Pause
              </button>
              <button onClick={() => setStatus('CANCELLED')} disabled={busy}
                className="flex items-center gap-1 rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10">
                <XIcon className="h-4 w-4" /> Cancel
              </button>
            </>
          )}
          {contract.status === 'PAUSED' && (
            <button onClick={() => setStatus('ACTIVE')} disabled={busy}
              className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              <Play className="h-4 w-4" /> Resume
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Monthly" value={money(monthlyTotal)} />
        <Stat label="Annualized" value={money(monthlyTotal * 12)} />
        <Stat label="Start" value={contract.start_date} small />
        <Stat label="Next Bill" value={contract.next_bill_date ?? '—'} small />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Line Items</h3>
          {!addingLine && (
            <button onClick={() => setAddingLine(true)}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 w-20 text-right">Qty</th>
              <th className="px-4 py-2 w-28 text-right">Rate</th>
              <th className="px-4 py-2 w-28 text-right">Monthly</th>
              <th className="px-4 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {contract.line_items.length === 0 && !addingLine && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">No line items</td></tr>
            )}
            {contract.line_items.map(l => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-4 py-2">{l.description}</td>
                <td className="px-4 py-2 text-right tabular-nums">{Number(l.quantity).toFixed(2)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(Number(l.unit_rate))}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{money(Number(l.monthly_amount))}</td>
                <td className="px-4 py-2">
                  <button onClick={() => removeLine(l.id)} disabled={busy} className="text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {addingLine && (
              <tr className="border-t border-border bg-muted/30">
                <td className="px-4 py-2">
                  <input value={lineDesc} onChange={e => setLineDesc(e.target.value)} autoFocus
                    placeholder="Description" className="w-full rounded border border-border bg-background px-2 py-1 text-sm" />
                </td>
                <td className="px-4 py-2">
                  <input type="number" step="0.01" value={lineQty} onChange={e => setLineQty(e.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-right text-sm" />
                </td>
                <td className="px-4 py-2">
                  <input type="number" step="0.01" value={lineRate} onChange={e => setLineRate(e.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-right text-sm" />
                </td>
                <td className="px-4 py-2 text-right text-sm tabular-nums">
                  {money((Number(lineQty) || 0) * (Number(lineRate) || 0))}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={addLine} disabled={busy || !lineDesc.trim()}
                      className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Save</button>
                    <button onClick={() => setAddingLine(false)} className="rounded border border-border px-2 py-1 text-xs">✕</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {contract.billing_model === 'BLOCK_TIME' && (
        <BlockTimeLedger contract={contract} events={contract.events} onDebited={load} />
      )}

      {contract.invoices.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold">Invoices</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Invoice #</th>
                <th className="px-4 py-2">Issued</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {contract.invoices.map(i => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/org/psa/invoices/${i.id}`} className="text-primary hover:underline">{i.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{i.issued_at}</td>
                  <td className="px-4 py-2 text-xs">{i.status}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(Number(i.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold">Activity</h3></div>
        <div className="divide-y divide-border">
          {contract.events.map(e => (
            <div key={e.id} className="px-4 py-2 text-sm">
              <span className="font-medium">{e.event_type}</span>
              <span className="ml-2 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${small ? 'text-base' : 'text-2xl'}`}>{value}</div>
    </div>
  )
}
