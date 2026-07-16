'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Inbox } from 'lucide-react'
import type { Opportunity } from '@/types/database'
import { OppStatus, OPP_STATUS_LABELS } from '@/types/enums'

type OppRow = Opportunity & { customers?: { name?: string } | null }

export default function OrderEntryPage() {
  const [opps, setOpps] = useState<OppRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ship_hold' | 'ready'>('all')

  useEffect(() => {
    fetch('/api/org/opportunities').then(async (r) => {
      if (r.ok) {
        const rows: OppRow[] = await r.json()
        setOpps(rows.filter((o) => o.status === OppStatus.ORDER_ENTRY || o.status === OppStatus.SHIP_HOLD))
      }
      setLoading(false)
    })
  }, [])

  const filtered = opps.filter((o) => {
    if (filter === 'ship_hold') return o.status === OppStatus.SHIP_HOLD
    if (filter === 'ready') return o.status === OppStatus.ORDER_ENTRY
    return true
  })

  const counts = {
    all: opps.length,
    ship_hold: opps.filter((o) => o.status === OppStatus.SHIP_HOLD).length,
    ready: opps.filter((o) => o.status === OppStatus.ORDER_ENTRY).length,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Order Entry</h1>
          <p className="text-sm text-muted-foreground">Signed opportunities awaiting docs and PM handoff</p>
        </div>
      </div>

      <div className="flex gap-2">
        {([
          ['all', 'All', counts.all],
          ['ready', 'Ready for PM', counts.ready],
          ['ship_hold', 'Ship Hold', counts.ship_hold],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === key
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading order entry queue...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No opportunities in this queue.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Opp #</th>
                <th className="px-3 py-2 font-semibold">Customer</th>
                <th className="px-3 py-2 font-semibold">Project</th>
                <th className="px-3 py-2 font-semibold">PO #</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Ship Hold Cleared</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs">{o.opp_number ?? '—'}</td>
                  <td className="px-3 py-2">{o.customers?.name ?? o.customer_name ?? '—'}</td>
                  <td className="px-3 py-2">{o.project_name ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{o.po_number ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${o.status === OppStatus.SHIP_HOLD ? 'bg-amber-500/20 text-amber-700' : 'bg-primary/10 text-primary'}`}>
                      {OPP_STATUS_LABELS[o.status as OppStatus] ?? o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {o.ship_hold_cleared_at ? new Date(o.ship_hold_cleared_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/org/opportunities/${o.id}`} className="text-xs font-medium text-primary hover:underline">
                      Open →
                    </Link>
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
