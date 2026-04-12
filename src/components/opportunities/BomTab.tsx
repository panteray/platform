'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Download, Package } from 'lucide-react'
import { exportBom, exportBomWithPricing } from '@/lib/export-helpers'
import type { Design } from '@/types/database'

interface BomItem {
  category: string; manufacturer: string; model: string; qty: number; unitCost: number
}

interface Props { oppId: string }

export function BomTab({ oppId }: Props) {
  const [designId, setDesignId] = useState<string | null>(null)
  const [items, setItems] = useState<BomItem[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Fetch designs for this opp, then fetch BOM from first design
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const dRes = await fetch('/api/org/designs')
      if (!dRes.ok) return
      const { designs } = await dRes.json()
      const oppDesign = (designs ?? []).find((d: Design) => d.opp_id === oppId)
      if (!oppDesign) { setLoading(false); return }
      setDesignId(oppDesign.id)

      const bRes = await fetch(`/api/org/designs/${oppDesign.id}/export/bom`, { method: 'POST' })
      if (!bRes.ok) return
      const bom = await bRes.json()
      setItems(bom.items ?? [])
    } finally { setLoading(false) }
  }, [oppId])

  useEffect(() => { load() }, [load])

  const total = useMemo(() => items.reduce((s, i) => s + i.qty * i.unitCost, 0), [items])
  const totalQty = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items])

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading BOM...</div>
  if (!designId) return <div className="p-8 text-center text-sm text-muted-foreground">No design linked to this opportunity. Create a design first.</div>
  if (items.length === 0) return <div className="p-8 text-center text-sm text-muted-foreground">No devices on the design canvas. Place devices to generate a BOM.</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-semibold text-foreground">{items.length} line items · {totalQty} devices</div>
          {total > 0 && <div className="text-xs text-muted-foreground">Total: ${total.toLocaleString()}</div>}
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { setExporting(true); await exportBom(designId); setExporting(false) }}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export XLSX
          </button>
          <button onClick={async () => { setExporting(true); await exportBomWithPricing(designId); setExporting(false) }}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Package className="h-3.5 w-3.5" /> Export with Pricing
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Category</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Manufacturer</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Model</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Unit Cost</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border hover:bg-accent/30 transition-colors">
                <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase">
                    {item.category.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{item.manufacturer || '—'}</td>
                <td className="px-3 py-2 text-xs font-medium">{item.model || '—'}</td>
                <td className="px-3 py-2 text-xs text-right font-mono font-semibold">{item.qty}</td>
                <td className="px-3 py-2 text-xs text-right font-mono">{item.unitCost > 0 ? `$${item.unitCost.toLocaleString()}` : '—'}</td>
                <td className="px-3 py-2 text-xs text-right font-mono font-semibold">{item.unitCost > 0 ? `$${(item.qty * item.unitCost).toLocaleString()}` : '—'}</td>
              </tr>
            ))}
          </tbody>
          {total > 0 && (
            <tfoot>
              <tr className="bg-muted/30 font-semibold">
                <td colSpan={4} className="px-3 py-2 text-xs text-right">Grand Total</td>
                <td className="px-3 py-2 text-xs text-right font-mono">{totalQty}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-xs text-right font-mono">${total.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
