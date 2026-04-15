'use client'

/**
 * Wiring Map — auto-generated from design_cables + design_mdf_idf + design_devices.
 *
 * Read-only. No editing. For each MDF/IDF, lists every cable anchored to it and
 * the device on the other end, with cable type, length, and compliance flags
 * (distance limits, missing labels). Exports the full schedule to XLSX/PDF/DOCX
 * via exportInFormat.
 *
 * This is NOT the per-door point-to-point schematic (that lives in
 * `/lib/calculators/wiring-schematic.ts`) — this is the design-wide MDF/IDF
 * tree, used for handoff to installers and AHJ submittal.
 */

import { useMemo, useState } from 'react'
import { Download, Cable as CableIcon, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { C } from './constants'
import { exportInFormat, type ExportFormat } from '@/lib/export-helpers'
import type { DesignDevice, DesignCable, DesignMdfIdf } from '@/types/database'

interface Props {
  designName: string
  devices: DesignDevice[]
  cables: DesignCable[]
  mdfIdfs: DesignMdfIdf[]
}

interface CableRow {
  id: string
  label: string
  cableType: string
  lengthFt: number
  totalLengthFt: number
  fromLabel: string
  toLabel: string
  deviceCategory: string
  overLimit: boolean
  nearLimit: boolean
  warning: string | null
}

interface MdfGroup {
  mdf: DesignMdfIdf
  rows: CableRow[]
  totalFt: number
}

// Copper/fiber distance limits (matches network-checker.ts)
const CABLE_MAX_FT: Record<string, number> = {
  cat6: 328, cat6a: 328, cat5e: 328,
  fiber_om3: 984, fiber_om4: 1312, fiber_sm: 32808,
  '18_2': 500, '22_4': 500, '22_6': 500, '14_2': 500,
  speaker: 200, coax: 500,
}

export function WiringMapView({ designName, devices, cables, mdfIdfs }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(mdfIdfs.map(m => m.id)))

  const groups: MdfGroup[] = useMemo(() => {
    return mdfIdfs.map(mdf => {
      const mdfCables = cables.filter(c => c.mdf_idf_id === mdf.id)
      const rows: CableRow[] = mdfCables.map(c => {
        const fromDev = c.from_device_id ? devices.find(d => d.id === c.from_device_id) : null
        const toDev = c.to_device_id ? devices.find(d => d.id === c.to_device_id) : null
        const otherEnd = fromDev || toDev
        const cableType = c.cable_type || 'cat6'
        const maxFt = CABLE_MAX_FT[cableType] ?? 328
        const lengthFt = c.total_length_ft || c.length_ft || 0
        const overLimit = lengthFt > maxFt
        const nearLimit = !overLimit && lengthFt > maxFt * 0.9
        const warning = overLimit
          ? `Exceeds ${maxFt}ft max for ${cableType}`
          : nearLimit
          ? `${Math.round((lengthFt / maxFt) * 100)}% of ${maxFt}ft max`
          : null
        return {
          id: c.id,
          label: c.label || `${cableType}-${c.id.slice(0, 6)}`,
          cableType,
          lengthFt: c.length_ft || 0,
          totalLengthFt: lengthFt,
          fromLabel: mdf.name,
          toLabel: otherEnd?.label || '— unconnected —',
          deviceCategory: otherEnd?.category || '—',
          overLimit,
          nearLimit,
          warning,
        }
      })
      const totalFt = rows.reduce((s, r) => s + r.totalLengthFt, 0)
      return { mdf, rows, totalFt }
    })
  }, [cables, devices, mdfIdfs])

  const totals = useMemo(() => {
    const rows = groups.flatMap(g => g.rows)
    const byType = new Map<string, { count: number; totalFt: number }>()
    for (const r of rows) {
      const cur = byType.get(r.cableType) || { count: 0, totalFt: 0 }
      cur.count += 1
      cur.totalFt += r.totalLengthFt
      byType.set(r.cableType, cur)
    }
    return {
      cableCount: rows.length,
      totalFt: rows.reduce((s, r) => s + r.totalLengthFt, 0),
      warnings: rows.filter(r => r.overLimit || r.nearLimit).length,
      byType: Array.from(byType.entries()),
    }
  }, [groups])

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleExport(format: ExportFormat) {
    const rows = groups.flatMap(g =>
      g.rows.map(r => ({
        MDF: g.mdf.name,
        Label: r.label,
        'Cable Type': r.cableType,
        'Length (ft)': r.lengthFt,
        'Total w/ Slack (ft)': r.totalLengthFt,
        From: r.fromLabel,
        To: r.toLabel,
        Category: r.deviceCategory,
        Warning: r.warning || '',
      })),
    )
    if (rows.length === 0) return
    const columns = Object.keys(rows[0])
    await exportInFormat(
      `${designName} — Wiring Map`,
      rows,
      columns,
      `${designName.replace(/[^a-z0-9]/gi, '_')}_Wiring_Map.xlsx`,
      format,
    )
  }

  if (mdfIdfs.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, fontSize: 12 }}>
        No MDF/IDF placed on this design yet. Add infrastructure to see the wiring map.
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Wiring Map</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
            Auto-generated from cable + MDF/IDF data. Read-only.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => handleExport('xlsx')} style={exportBtnStyle}>
            <Download size={12} /> XLSX
          </button>
          <button onClick={() => handleExport('pdf')} style={exportBtnStyle}>
            <Download size={12} /> PDF
          </button>
          <button onClick={() => handleExport('docx')} style={exportBtnStyle}>
            <Download size={12} /> DOCX
          </button>
        </div>
      </div>

      {/* Totals */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16, padding: 12,
        background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8,
      }}>
        <Totals label="MDFs" value={String(mdfIdfs.length)} />
        <Totals label="Cables" value={String(totals.cableCount)} />
        <Totals label="Total Ft" value={totals.totalFt.toFixed(0)} />
        {totals.warnings > 0 && (
          <Totals label="Warnings" value={String(totals.warnings)} color="#f59e0b" />
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {totals.byType.map(([type, t]) => (
            <div key={type} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', background: C.bgActive, borderRadius: 4,
              border: `1px solid ${C.borderSubtle}`,
              fontSize: 10, color: C.textMuted,
            }}>
              <span style={{ fontWeight: 700, color: C.text }}>{type}</span>
              <span>{t.count}</span>
              <span style={{ color: C.textDim }}>· {t.totalFt.toFixed(0)}ft</span>
            </div>
          ))}
        </div>
      </div>

      {/* MDF trees */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(g => {
          const isOpen = expanded.has(g.mdf.id)
          const warnCount = g.rows.filter(r => r.overLimit || r.nearLimit).length
          return (
            <div key={g.mdf.id} style={{
              background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
            }}>
              <button
                onClick={() => toggle(g.mdf.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: C.bgActive, border: 'none',
                  borderBottom: isOpen ? `1px solid ${C.border}` : 'none',
                  cursor: 'pointer', fontFamily: 'inherit', color: C.text,
                }}
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <CableIcon size={14} style={{ color: C.accent }} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>{g.mdf.name}</span>
                <span style={{ fontSize: 10, color: C.textMuted }}>
                  {g.rows.length} cables · {g.totalFt.toFixed(0)} ft total
                </span>
                {warnCount > 0 && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '2px 6px', background: 'rgba(245,158,11,0.15)',
                    border: '1px solid rgba(245,158,11,0.4)', borderRadius: 3,
                    fontSize: 9, fontWeight: 700, color: '#f59e0b',
                  }}>
                    <AlertCircle size={10} /> {warnCount}
                  </span>
                )}
                {g.mdf.location_description && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textDim, fontStyle: 'italic' }}>
                    {g.mdf.location_description}
                  </span>
                )}
              </button>

              {isOpen && (
                g.rows.length === 0 ? (
                  <div style={{ padding: '14px 18px', fontSize: 11, color: C.textDim, fontStyle: 'italic' }}>
                    No cables anchored to this MDF.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                        {['Label', 'Type', 'Length', 'w/ Slack', 'To Device', 'Category', 'Status'].map(h => (
                          <th key={h} style={{
                            textAlign: 'left', padding: '8px 12px', fontSize: 9,
                            fontWeight: 700, color: C.textDim, textTransform: 'uppercase',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map(r => (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                          <td style={{ padding: '8px 12px', color: C.text, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', fontSize: 10 }}>{r.label}</td>
                          <td style={{ padding: '8px 12px', color: C.textMuted, fontFamily: 'var(--font-mono, monospace)', fontSize: 10 }}>{r.cableType}</td>
                          <td style={{ padding: '8px 12px', color: C.textMuted, fontFamily: 'var(--font-mono, monospace)', fontSize: 10 }}>{r.lengthFt.toFixed(0)} ft</td>
                          <td style={{ padding: '8px 12px', color: C.text, fontFamily: 'var(--font-mono, monospace)', fontSize: 10 }}>{r.totalLengthFt.toFixed(0)} ft</td>
                          <td style={{ padding: '8px 12px', color: C.text }}>{r.toLabel}</td>
                          <td style={{ padding: '8px 12px', color: C.textDim, fontSize: 10 }}>{r.deviceCategory}</td>
                          <td style={{ padding: '8px 12px', fontSize: 10 }}>
                            {r.overLimit ? (
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>OVER LIMIT</span>
                            ) : r.nearLimit ? (
                              <span style={{ color: '#f59e0b', fontWeight: 700 }}>{r.warning}</span>
                            ) : (
                              <span style={{ color: '#22c55e' }}>OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Totals({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 16, color: color || C.text, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{value}</span>
    </div>
  )
}

const exportBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 10px', fontSize: 10, fontWeight: 600,
  borderRadius: 4, border: `1px solid ${C.border}`,
  background: 'transparent', color: C.text,
  cursor: 'pointer', textTransform: 'uppercase', fontFamily: 'inherit',
}
