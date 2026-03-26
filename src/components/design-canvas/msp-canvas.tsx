'use client'

import { useState } from 'react'
import { C } from './constants'

interface MspLineItem {
  id: string
  category: 'msp' | 'cybersecurity' | 'backup' | 'voip' | 'other'
  name: string
  description: string
  qty: number
  unit_price: number
  billing_cycle: 'monthly' | 'annual' | 'one_time'
}

interface MspCanvasProps {
  designId: string
  onSave?: (lines: MspLineItem[]) => void
}

const CATEGORIES = [
  { value: 'msp', label: 'MSP / Managed IT', color: '#3b82f6' },
  { value: 'cybersecurity', label: 'Cybersecurity', color: '#ef4444' },
  { value: 'backup', label: 'Backup / DR', color: '#22c55e' },
  { value: 'voip', label: 'VoIP / UCaaS', color: '#8b5cf6' },
  { value: 'other', label: 'Other', color: '#64748b' },
]

export function MspCanvas({ designId, onSave }: MspCanvasProps) {
  const [lines, setLines] = useState<MspLineItem[]>([])

  function addLine(category: MspLineItem['category']) {
    setLines((prev) => [...prev, {
      id: crypto.randomUUID(),
      category,
      name: '',
      description: '',
      qty: 1,
      unit_price: 0,
      billing_cycle: 'monthly',
    }])
  }

  function updateLine(id: string, field: string, value: unknown) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l))
  }

  function deleteLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  const monthlyTotal = lines
    .filter((l) => l.billing_cycle === 'monthly')
    .reduce((sum, l) => sum + l.qty * l.unit_price, 0)
  const annualTotal = lines
    .filter((l) => l.billing_cycle === 'annual')
    .reduce((sum, l) => sum + l.qty * l.unit_price, 0)
  const oneTimeTotal = lines
    .filter((l) => l.billing_cycle === 'one_time')
    .reduce((sum, l) => sum + l.qty * l.unit_price, 0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      {/* Category add bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', marginRight: 8 }}>Add Service:</span>
        {CATEGORIES.map((cat) => (
          <button key={cat.value} onClick={() => addLine(cat.value as MspLineItem['category'])}
            style={{ padding: '3px 8px', fontSize: 9, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
              background: 'transparent', color: cat.color, border: `1px solid ${cat.color}40` }}>
            + {cat.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: C.textDim }}>MRR: <span style={{ fontWeight: 600, color: C.green }}>${monthlyTotal.toLocaleString()}</span></span>
        <span style={{ fontSize: 10, color: C.textDim, marginLeft: 12 }}>ARR: <span style={{ fontWeight: 600, color: C.text }}>${annualTotal.toLocaleString()}</span></span>
        <span style={{ fontSize: 10, color: C.textDim, marginLeft: 12 }}>NRC: <span style={{ fontWeight: 600, color: C.text }}>${oneTimeTotal.toLocaleString()}</span></span>
      </div>

      {/* Line items table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Category', 'Service Name', 'Description', 'Qty', 'Unit Price', 'Billing', 'Total', ''].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: C.textDim }}>Add services using the categories above</td></tr>
            )}
            {lines.map((line) => {
              const catInfo = CATEGORIES.find((c) => c.value === line.category)
              return (
                <tr key={line.id} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: catInfo?.color, background: `${catInfo?.color}15`, padding: '2px 6px', borderRadius: 3 }}>
                      {catInfo?.label}
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input value={line.name} onChange={(e) => updateLine(line.id, 'name', e.target.value)}
                      placeholder="Service name" style={{ width: 150, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, outline: 'none' }} />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input value={line.description} onChange={(e) => updateLine(line.id, 'description', e.target.value)}
                      placeholder="Description" style={{ width: 160, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, outline: 'none' }} />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input type="number" value={line.qty} onChange={(e) => updateLine(line.id, 'qty', Number(e.target.value))}
                      style={{ width: 50, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace", outline: 'none', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input type="number" value={line.unit_price} onChange={(e) => updateLine(line.id, 'unit_price', Number(e.target.value))}
                      style={{ width: 80, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace", outline: 'none', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <select value={line.billing_cycle} onChange={(e) => updateLine(line.id, 'billing_cycle', e.target.value)}
                      style={{ background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 10, outline: 'none' }}>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                      <option value="one_time">One-Time</option>
                    </select>
                  </td>
                  <td style={{ padding: '6px 10px', fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace", fontWeight: 600, color: C.text }}>
                    ${(line.qty * line.unit_price).toLocaleString()}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <button onClick={() => deleteLine(line.id)}
                      style={{ fontSize: 10, color: C.red, background: 'transparent', border: 'none', cursor: 'pointer' }}>Del</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
