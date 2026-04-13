'use client'

import { useState, useMemo } from 'react'
import { Plus, Trash2, Download, Save } from 'lucide-react'
import { C } from './constants'

// ── Types ──

interface LineItem {
  id: string
  category: string
  name: string
  vendor: string
  quantity: number
  unitType: string
  rate: number
  discountPct: number
  isInternalOnly: boolean
}

interface QuoteConfig {
  contractTermMonths: number
  yearlyIncreasePct: number
  onboardingFee: number
  markupPct: number
}

// ── Categories ──

const CATEGORIES = ['MSP', 'NMS', 'MDM', 'SAAS', 'CYB', 'Tools', 'One-Time', 'Labor']

const PRESET_SERVICES = [
  { category: 'MSP', name: 'Server Managed Services', vendor: '', rate: 0, unitType: 'monthly' },
  { category: 'MSP', name: 'Workstation Managed Services', vendor: '', rate: 0, unitType: 'monthly' },
  { category: 'MSP', name: 'Cloud Storage (per TB)', vendor: '', rate: 0, unitType: 'monthly' },
  { category: 'MSP', name: 'Block Hours', vendor: '', rate: 120, unitType: 'hourly' },
  { category: 'NMS', name: 'Network Management Services', vendor: '', rate: 0, unitType: 'monthly' },
  { category: 'MDM', name: 'Mobile Device Management', vendor: '', rate: 0, unitType: 'monthly' },
  { category: 'SAAS', name: 'SAAS Backup', vendor: '', rate: 0, unitType: 'monthly' },
  { category: 'CYB', name: 'MDR (Managed Detection & Response)', vendor: '', rate: 0, unitType: 'monthly' },
  { category: 'CYB', name: 'Endpoint Protection', vendor: 'Sentinel One', rate: 3.50, unitType: 'monthly' },
  { category: 'Tools', name: 'RMM Platform', vendor: 'Ninja One', rate: 3.60, unitType: 'monthly' },
  { category: 'Tools', name: 'Backup Agent', vendor: 'Ninja One', rate: 0, unitType: 'monthly' },
  { category: 'Labor', name: 'System Administrator', vendor: '', rate: 120, unitType: 'hourly' },
  { category: 'One-Time', name: 'Onboarding Fee', vendor: '', rate: 0, unitType: 'one-time' },
]

// ── Props ──

interface Props {
  designId: string
  designName: string
  oppNumber?: string
  customerName?: string
}

// ── Component ──

export function SoftwareCanvas({ designId, designName, oppNumber, customerName }: Props) {
  const [items, setItems] = useState<LineItem[]>([])
  const [config, setConfig] = useState<QuoteConfig>({
    contractTermMonths: 36,
    yearlyIncreasePct: 5,
    onboardingFee: 0,
    markupPct: 0,
  })
  const [customerNotes, setCustomerNotes] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  // ── Calculations ──

  const totals = useMemo(() => {
    const recurring = items.filter(i => !i.isInternalOnly && i.unitType !== 'one-time')
    const oneTime = items.filter(i => !i.isInternalOnly && i.unitType === 'one-time')
    const internal = items.filter(i => i.isInternalOnly)

    const monthlyRecurring = recurring.reduce((s, i) => {
      const discounted = i.rate * (1 - i.discountPct / 100)
      const marked = discounted * (1 + config.markupPct / 100)
      return s + i.quantity * marked
    }, 0)

    const mrr = monthlyRecurring
    const arr = mrr * 12
    const year1 = arr + config.onboardingFee + oneTime.reduce((s, i) => s + i.quantity * i.rate, 0)
    const year2 = arr * (1 + config.yearlyIncreasePct / 100)
    const year3 = year2 * (1 + config.yearlyIncreasePct / 100)
    const tcv = year1 + year2 * Math.max(0, Math.floor(config.contractTermMonths / 12) - 1)
      + (config.contractTermMonths >= 36 ? year3 : 0)

    const internalMonthlyCost = internal.reduce((s, i) => s + i.quantity * i.rate, 0)

    return { mrr, arr, year1, year2, year3, tcv, internalMonthlyCost, oneTimeTotal: oneTime.reduce((s, i) => s + i.quantity * i.rate, 0) }
  }, [items, config])

  // ── Handlers ──

  const addItem = (preset?: typeof PRESET_SERVICES[number]) => {
    const item: LineItem = {
      id: crypto.randomUUID(),
      category: preset?.category || 'MSP',
      name: preset?.name || 'New Service',
      vendor: preset?.vendor || '',
      quantity: 1,
      unitType: preset?.unitType || 'monthly',
      rate: preset?.rate || 0,
      discountPct: 0,
      isInternalOnly: preset?.category === 'Tools',
    }
    setItems(prev => [...prev, item])
    setShowPresets(false)
  }

  const updateItem = (id: string, updates: Partial<LineItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const exportQuote = async () => {
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, BorderStyle, ShadingType } = await import('docx')
    const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
    const borders = { top: border, bottom: border, left: border, right: border }
    const margins = { top: 60, bottom: 60, left: 80, right: 80 }

    const customerItems = items.filter(i => !i.isInternalOnly)
    const colWidths = [1200, 2800, 800, 1200, 800, 1200, 1360]
    const headers = ['Category', 'Description', 'Qty', 'Price', 'Disc %', 'Monthly', 'Annual']

    const headerRow = new TableRow({ children: headers.map((h, hi) => new TableCell({
      borders, width: { size: colWidths[hi], type: WidthType.DXA }, margins,
      shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: 'Arial', size: 16 })] })],
    })) })

    const dataRows = customerItems.map(item => {
      const monthly = item.quantity * item.rate * (1 - item.discountPct / 100)
      return new TableRow({ children: [
        new TableCell({ borders, width: { size: colWidths[0], type: WidthType.DXA }, margins, children: [new Paragraph({ children: [new TextRun({ text: item.category, font: 'Arial', size: 16 })] })] }),
        new TableCell({ borders, width: { size: colWidths[1], type: WidthType.DXA }, margins, children: [new Paragraph({ children: [new TextRun({ text: item.name, font: 'Arial', size: 16 })] })] }),
        new TableCell({ borders, width: { size: colWidths[2], type: WidthType.DXA }, margins, children: [new Paragraph({ children: [new TextRun({ text: String(item.quantity), font: 'Arial', size: 16 })] })] }),
        new TableCell({ borders, width: { size: colWidths[3], type: WidthType.DXA }, margins, children: [new Paragraph({ children: [new TextRun({ text: `$${item.rate.toFixed(2)}`, font: 'Arial', size: 16 })] })] }),
        new TableCell({ borders, width: { size: colWidths[4], type: WidthType.DXA }, margins, children: [new Paragraph({ children: [new TextRun({ text: item.discountPct > 0 ? `${item.discountPct}%` : '', font: 'Arial', size: 16 })] })] }),
        new TableCell({ borders, width: { size: colWidths[5], type: WidthType.DXA }, margins, children: [new Paragraph({ children: [new TextRun({ text: `$${monthly.toFixed(2)}`, font: 'Arial', size: 16 })] })] }),
        new TableCell({ borders, width: { size: colWidths[6], type: WidthType.DXA }, margins, children: [new Paragraph({ children: [new TextRun({ text: `$${(monthly * 12).toFixed(2)}`, font: 'Arial', size: 16 })] })] }),
      ] })
    })

    const doc = new Document({
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Managed Services Quote', font: 'Arial' })] }),
          new Paragraph({ children: [new TextRun({ text: `${customerName || 'Customer'} — ${oppNumber || designName}`, font: 'Arial', size: 22, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString()} | Term: ${config.contractTermMonths} months | Annual Increase: ${config.yearlyIncreasePct}%`, font: 'Arial', size: 18, color: '888888' })] }),
          new Paragraph({ children: [] }),
          new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: colWidths, rows: [headerRow, ...dataRows] }),
          new Paragraph({ children: [] }),
          new Paragraph({ children: [new TextRun({ text: `MRR: $${totals.mrr.toFixed(2)} | ARR: $${totals.arr.toFixed(2)} | TCV: $${totals.tcv.toFixed(2)}`, font: 'Arial', size: 20, bold: true })] }),
          ...(customerNotes ? [new Paragraph({ children: [] }), new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Notes', font: 'Arial' })] }), new Paragraph({ children: [new TextRun({ text: customerNotes, font: 'Arial', size: 20 })] })] : []),
        ],
      }],
    })
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${customerName || 'Quote'}_MSP_Quote.docx`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Select input style ──
  const selStyle: React.CSSProperties = { padding: '4px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none' }
  const numStyle: React.CSSProperties = { ...selStyle, width: 60, fontFamily: 'monospace', textAlign: 'right' }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Software Canvas</div>
          <div style={{ fontSize: 11, color: C.textDim }}>Managed services quoting — {customerName || designName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportQuote} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Download size={13} /> Export DOCX
          </button>
        </div>
      </div>

      {/* Config row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 12, background: C.bgPanel, borderRadius: 8, border: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {([
          ['contractTermMonths', 'Term (months)', [12, 24, 36, 48, 60]],
          ['yearlyIncreasePct', 'Yearly Increase %', [0, 3, 5, 7, 10]],
        ] as [keyof QuoteConfig, string, number[]][]).map(([key, label, options]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: C.textDim }}>{label}:</span>
            <select value={config[key]} onChange={e => setConfig(prev => ({ ...prev, [key]: Number(e.target.value) }))} style={selStyle}>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: C.textDim }}>Markup %:</span>
          <input type="number" value={config.markupPct} onChange={e => setConfig(prev => ({ ...prev, markupPct: Number(e.target.value) }))} style={numStyle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: C.textDim }}>Onboarding $:</span>
          <input type="number" value={config.onboardingFee} onChange={e => setConfig(prev => ({ ...prev, onboardingFee: Number(e.target.value) }))} style={numStyle} />
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {([
          ['MRR', totals.mrr, C.accent],
          ['ARR', totals.arr, '#22c55e'],
          ['TCV', totals.tcv, '#3b82f6'],
          ['Internal Cost', totals.internalMonthlyCost, C.textDim],
        ] as [string, number, string][]).map(([label, value, color]) => (
          <div key={label} style={{ padding: '10px 12px', background: C.bgPanel, borderRadius: 6, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'monospace' }}>${value.toFixed(0)}</div>
            <div style={{ fontSize: 8, color: C.textDim }}>{label === 'Internal Cost' ? '/mo' : label === 'MRR' ? '/mo' : label === 'ARR' ? '/yr' : `${config.contractTermMonths}mo`}</div>
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => addItem()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: C.accent, color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={12} /> Add Line Item
        </button>
        <button onClick={() => setShowPresets(!showPresets)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 10, fontWeight: 600, color: C.text, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={12} /> From Presets
        </button>
      </div>

      {/* Preset selector */}
      {showPresets && (
        <div style={{ marginBottom: 12, padding: 12, background: C.bgPanel, borderRadius: 8, border: `1px solid ${C.accent}30`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {PRESET_SERVICES.map((p, i) => (
            <button key={i} onClick={() => addItem(p)} style={{
              padding: '6px 8px', background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 4,
              fontSize: 9, color: C.text, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              {p.vendor && <span style={{ color: C.textDim }}> ({p.vendor})</span>}
            </button>
          ))}
        </div>
      )}

      {/* Line items table */}
      {items.length > 0 && (
        <div style={{ borderRadius: 6, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ background: C.bgSurface, borderBottom: `1px solid ${C.border}` }}>
                {['Cat', 'Service', 'Vendor', 'Qty', 'Rate', 'Disc%', 'Monthly', 'Internal', ''].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: C.textDim, fontSize: 8, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const monthly = item.quantity * item.rate * (1 - item.discountPct / 100)
                return (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}`, background: item.isInternalOnly ? 'rgba(59,130,246,0.03)' : undefined }}>
                    <td style={{ padding: '4px 8px' }}>
                      <select value={item.category} onChange={e => updateItem(item.id, { category: e.target.value })} style={{ ...selStyle, width: 60 }}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <input value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} style={{ ...selStyle, width: '100%' }} />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <input value={item.vendor} onChange={e => updateItem(item.id, { vendor: e.target.value })} style={{ ...selStyle, width: 80 }} placeholder="Vendor" />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <input type="number" value={item.quantity} min={1} onChange={e => updateItem(item.id, { quantity: Number(e.target.value) })} style={numStyle} />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <input type="number" value={item.rate} step={0.01} onChange={e => updateItem(item.id, { rate: Number(e.target.value) })} style={numStyle} />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <input type="number" value={item.discountPct} min={0} max={100} onChange={e => updateItem(item.id, { discountPct: Number(e.target.value) })} style={{ ...numStyle, width: 40 }} />
                    </td>
                    <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontWeight: 600, color: C.text }}>${monthly.toFixed(2)}</td>
                    <td style={{ padding: '4px 8px' }}>
                      <input type="checkbox" checked={item.isInternalOnly} onChange={e => updateItem(item.id, { isInternalOnly: e.target.checked })} style={{ accentColor: C.accent }} />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2, opacity: 0.4 }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', background: C.bgPanel, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>No line items yet</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Add services from presets or create custom line items</div>
        </div>
      )}

      {/* Customer notes */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, marginBottom: 4 }}>Customer Notes</div>
        <textarea value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} rows={3} placeholder="Contract terms, special conditions, SLA details..."
          style={{ width: '100%', padding: '8px 10px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
      </div>
    </div>
  )
}
