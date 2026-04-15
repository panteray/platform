'use client'

// PartsPanel — add/list parts with barcode scanner integration.
// Barcode scanner fills part_number or serial_number depending on which button was tapped.

import { useState } from 'react'
import { Plus, X, ScanLine } from 'lucide-react'
import type { PsaTicketPart } from '@/types/database'
import { BarcodeScanner } from '@/components/field-ops/BarcodeScanner'

type Props = {
  ticketId: string
  parts: PsaTicketPart[]
  onReload: () => void
}

type ScanTarget = 'part' | 'serial' | null

export function PartsPanel({ ticketId, parts, onReload }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [partNumber, setPartNumber] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [cost, setCost] = useState('')
  const [serial, setSerial] = useState('')
  const [scanTarget, setScanTarget] = useState<ScanTarget>(null)

  async function submit() {
    if (!description.trim()) return
    await fetch(`/api/org/psa/tickets/${ticketId}/parts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        part_number: partNumber || null,
        description,
        quantity: parseFloat(quantity) || 1,
        cost: cost ? parseFloat(cost) : null,
        serial_number: serial || null,
      }),
    })
    setPartNumber(''); setDescription(''); setQuantity('1'); setCost(''); setSerial('')
    setShowForm(false)
    onReload()
  }

  function handleScanned(code: string) {
    if (scanTarget === 'part') setPartNumber(code)
    if (scanTarget === 'serial') setSerial(code)
    setScanTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-500">{parts.length} part{parts.length === 1 ? '' : 's'} used</div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
        >
          {showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showForm ? 'Cancel' : 'Add Part'}
        </button>
      </div>

      {showForm && (
        <div className="border border-neutral-200 rounded p-4 grid grid-cols-2 gap-3">
          <div className="relative">
            <input
              placeholder="Part #"
              value={partNumber}
              onChange={e => setPartNumber(e.target.value)}
              className="w-full px-3 py-1.5 pr-9 border border-neutral-300 rounded text-sm"
            />
            <button
              type="button"
              onClick={() => setScanTarget('part')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
              title="Scan barcode"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <input
              placeholder="Serial #"
              value={serial}
              onChange={e => setSerial(e.target.value)}
              className="w-full px-3 py-1.5 pr-9 border border-neutral-300 rounded text-sm"
            />
            <button
              type="button"
              onClick={() => setScanTarget('serial')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
              title="Scan serial"
            >
              <ScanLine className="w-4 h-4" />
            </button>
          </div>
          <input placeholder="Description *" value={description} onChange={e => setDescription(e.target.value)}
            className="col-span-2 px-3 py-1.5 border border-neutral-300 rounded text-sm" />
          <input type="number" step="1" placeholder="Quantity" value={quantity} onChange={e => setQuantity(e.target.value)}
            className="px-3 py-1.5 border border-neutral-300 rounded text-sm" />
          <input type="number" step="0.01" placeholder="Cost" value={cost} onChange={e => setCost(e.target.value)}
            className="px-3 py-1.5 border border-neutral-300 rounded text-sm" />
          <button onClick={submit} className="col-span-2 px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            Save Part
          </button>
        </div>
      )}

      {parts.length === 0 ? (
        <div className="text-center text-sm text-neutral-500 py-8">No parts logged</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500 border-b border-neutral-200">
              <th className="py-2 font-medium">Part #</th>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium">Qty</th>
              <th className="py-2 font-medium">Cost</th>
              <th className="py-2 font-medium">Serial #</th>
            </tr>
          </thead>
          <tbody>
            {parts.map(p => (
              <tr key={p.id} className="border-b border-neutral-100">
                <td className="py-2 font-mono text-xs">{p.part_number ?? '—'}</td>
                <td className="py-2">{p.description}</td>
                <td className="py-2">{p.quantity}</td>
                <td className="py-2 font-mono">{p.cost != null ? `$${Number(p.cost).toFixed(2)}` : '—'}</td>
                <td className="py-2 font-mono text-xs">{p.serial_number ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <BarcodeScanner
        open={scanTarget !== null}
        onClose={() => setScanTarget(null)}
        onDetected={handleScanned}
      />
    </div>
  )
}
