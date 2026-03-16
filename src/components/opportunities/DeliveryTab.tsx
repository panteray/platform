'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { OppMaterialTracking, Distributor, Manufacturer } from '@/types/database'
import { CARRIER_OPTIONS, MATERIAL_SHIP_STATUSES, US_STATES } from '@/types/enums'

interface Props { oppId: string }

export function DeliveryTab({ oppId }: Props) {
  const [items, setItems] = useState<OppMaterialTracking[]>([])
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [mRes, dRes, vRes] = await Promise.all([
      fetch(`/api/org/opportunities/${oppId}/materials`),
      fetch('/api/org/distributors'),
      fetch('/api/org/manufacturers'),
    ])
    if (mRes.ok) setItems(await mRes.json())
    if (dRes.ok) setDistributors(await dRes.json())
    if (vRes.ok) setManufacturers(await vRes.json())
    setLoading(false)
  }, [oppId])

  useEffect(() => { load() }, [load])

  async function addRow() {
    const res = await fetch(`/api/org/opportunities/${oppId}/materials`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_description: 'New Item', quantity: 1 }),
    })
    if (res.ok) { const row = await res.json(); setItems((prev) => [...prev, row]) }
  }

  async function patchRow(id: string, field: string, value: unknown) {
    const res = await fetch(`/api/org/opportunities/${oppId}/materials`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: value }),
    })
    if (res.ok) { const updated = await res.json(); setItems((prev) => prev.map((r) => r.id === id ? updated : r)) }
  }

  async function deleteRow(id: string) {
    const res = await fetch(`/api/org/opportunities/${oppId}/materials?id=${id}`, { method: 'DELETE' })
    if (res.ok) setItems((prev) => prev.filter((r) => r.id !== id))
  }

  // Summary calculations
  const total = items.length
  const ordered = items.filter((i) => i.ship_status !== 'NOT_ORDERED').length
  const delivered = items.filter((i) => i.ship_status === 'DELIVERED').length
  const backordered = items.filter((i) => i.ship_status === 'BACKORDERED').length
  const estDates = items.filter((i) => i.ship_status !== 'DELIVERED' && i.estimated_delivery_date).map((i) => i.estimated_delivery_date!)
  const latestEst = estDates.length ? estDates.sort().pop() : null

  const ic = 'h-7 w-full rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring'
  const sc = 'h-7 w-full rounded border border-border bg-background px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring'

  if (loading) return <div className="flex h-32 items-center justify-center"><p className="text-sm text-muted-foreground">Loading delivery data...</p></div>

  return (
    <div className="space-y-4">
      {/* Summary Strip */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Items Total', value: total, color: 'text-foreground' },
          { label: 'Ordered', value: ordered, color: 'text-blue-500' },
          { label: 'Delivered', value: delivered, color: 'text-green-500' },
          { label: 'Backordered', value: backordered, color: 'text-red-500' },
          { label: 'Est Delivery', value: latestEst ? new Date(latestEst).toLocaleDateString() : '—', color: 'text-amber-500' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-3 py-2 min-w-[100px]">
            <p className="text-[10px] font-medium text-muted-foreground">{s.label}</p>
            <p className={`text-base font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Material Tracking Table */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Material Tracking</p>
        <button onClick={addRow} className="inline-flex h-7 items-center gap-1 rounded bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-3 w-3" />Add Item</button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center"><p className="text-sm text-muted-foreground">No material items yet. Add items to track deliveries.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {['Line #','Distributor','Manufacturer','Description','Part #','Qty','Unit $','Ext $','Order #','Tracking #','Carrier','Status','Ordered','Est Delivery','Actual','Ship To','Notes',''].map((h) => (
                  <th key={h} className="px-1.5 py-2 text-left text-[10px] font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-1.5 py-1"><input className={ic} defaultValue={row.line_number ?? ''} onBlur={(e) => patchRow(row.id, 'line_number', e.target.value)} style={{ width: 70 }} /></td>
                  <td className="px-1.5 py-1"><select className={sc} value={row.distributor_id ?? ''} onChange={(e) => patchRow(row.id, 'distributor_id', e.target.value || null)} style={{ width: 110 }}><option value="">—</option>{distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
                  <td className="px-1.5 py-1"><select className={sc} value={row.manufacturer_id ?? ''} onChange={(e) => patchRow(row.id, 'manufacturer_id', e.target.value || null)} style={{ width: 110 }}><option value="">—</option>{manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></td>
                  <td className="px-1.5 py-1"><input className={ic} defaultValue={row.item_description} onBlur={(e) => patchRow(row.id, 'item_description', e.target.value)} style={{ width: 140 }} /></td>
                  <td className="px-1.5 py-1"><input className={ic} defaultValue={row.part_number ?? ''} onBlur={(e) => patchRow(row.id, 'part_number', e.target.value)} style={{ width: 90 }} /></td>
                  <td className="px-1.5 py-1"><input className={ic} type="number" defaultValue={row.quantity} onBlur={(e) => patchRow(row.id, 'quantity', Number(e.target.value) || 1)} style={{ width: 50 }} /></td>
                  <td className="px-1.5 py-1"><input className={ic} type="number" defaultValue={row.unit_cost ?? ''} onBlur={(e) => patchRow(row.id, 'unit_cost', e.target.value === '' ? null : Number(e.target.value))} style={{ width: 70 }} /></td>
                  <td className="px-1.5 py-1"><input className={ic} type="number" defaultValue={row.extended_cost ?? ''} onBlur={(e) => patchRow(row.id, 'extended_cost', e.target.value === '' ? null : Number(e.target.value))} style={{ width: 70 }} /></td>
                  <td className="px-1.5 py-1"><input className={ic} defaultValue={row.order_number ?? ''} onBlur={(e) => patchRow(row.id, 'order_number', e.target.value)} style={{ width: 90 }} placeholder="Disty order #" /></td>
                  <td className="px-1.5 py-1"><input className={ic} defaultValue={row.tracking_number ?? ''} onBlur={(e) => patchRow(row.id, 'tracking_number', e.target.value)} style={{ width: 100 }} /></td>
                  <td className="px-1.5 py-1"><select className={sc} value={row.carrier ?? ''} onChange={(e) => patchRow(row.id, 'carrier', e.target.value || null)} style={{ width: 80 }}><option value="">—</option>{CARRIER_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
                  <td className="px-1.5 py-1"><select className={sc} value={row.ship_status} onChange={(e) => patchRow(row.id, 'ship_status', e.target.value)} style={{ width: 100 }}>{MATERIAL_SHIP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></td>
                  <td className="px-1.5 py-1"><input className={ic} type="date" defaultValue={row.date_ordered ?? ''} onBlur={(e) => patchRow(row.id, 'date_ordered', e.target.value || null)} style={{ width: 110 }} /></td>
                  <td className="px-1.5 py-1"><input className={ic} type="date" defaultValue={row.estimated_delivery_date ?? ''} onBlur={(e) => patchRow(row.id, 'estimated_delivery_date', e.target.value || null)} style={{ width: 110 }} /></td>
                  <td className="px-1.5 py-1"><input className={ic} type="date" defaultValue={row.actual_delivery_date ?? ''} onBlur={(e) => patchRow(row.id, 'actual_delivery_date', e.target.value || null)} style={{ width: 110 }} /></td>
                  <td className="px-1.5 py-1"><input className={ic} defaultValue={row.ship_to_address ?? ''} onBlur={(e) => patchRow(row.id, 'ship_to_address', e.target.value)} style={{ width: 120 }} /></td>
                  <td className="px-1.5 py-1"><input className={ic} defaultValue={row.notes ?? ''} onBlur={(e) => patchRow(row.id, 'notes', e.target.value)} style={{ width: 100 }} /></td>
                  <td className="px-1.5 py-1"><button onClick={() => deleteRow(row.id)} className="rounded p-1 hover:bg-muted"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
