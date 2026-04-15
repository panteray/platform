'use client'

/**
 * Door Schedule Modal — table view of all ACS devices on a design with
 * real-time compliance findings and XLSX/PDF/DOCX export.
 *
 * Reads device.properties for door construction, lock, occupancy, fire_rated,
 * electrification, reader/output/REX config, and runs `evaluateCompatibility`
 * per row. Clicking a row selects the device on the canvas.
 */

import React, { useMemo, useState } from 'react'
import { X, Download, AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  evaluateCompatibility,
  DOOR_TYPE_LABELS,
  ELECTRIFICATION_LABELS,
  OCCUPANCY_LABELS,
  type DoorType as ComplianceDoorType,
  type ElectrificationType,
  type OccupancyType,
} from '@/lib/door-compliance/compatibility-data'
import { exportInFormat, type ExportFormat } from '@/lib/export-helpers'
import type { DesignDevice } from '@/types/database'

const ACS_CATEGORIES = new Set([
  'access_control',
  'door',
  'door_controller',
  'card_reader',
  'electric_strike',
  'maglock',
])

function inferElectrification(lockType: string): ElectrificationType {
  if (lockType === 'Magnetic Lock') return 'surface_maglock'
  if (lockType === 'Electrified Hardware') return 'electric_latch_retraction'
  return 'electrified_trim'
}

interface Props {
  designName: string
  devices: DesignDevice[]
  onClose: () => void
  onSelectDevice: (id: string) => void
}

interface Row {
  device: DesignDevice
  label: string
  construction: ComplianceDoorType
  electrification: ElectrificationType
  occupancy: OccupancyType
  fireRated: boolean
  lockType: string
  readerIn: string
  readerOut: string
  rex: boolean
  contact: boolean
  controller: string
  critical: number
  warnings: number
  advisory: number
  summary: 'critical' | 'warning' | 'ok'
}

export function DoorScheduleModal({ designName, devices, onClose, onSelectDevice }: Props) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'ok'>('all')

  const rows: Row[] = useMemo(() => {
    const acs = devices.filter(d => ACS_CATEGORIES.has(d.category))
    return acs.map(d => {
      const p = (d.properties ?? {}) as Record<string, unknown>
      const lockType = String(p.lock_type || 'Electric Strike')
      const construction = (String(p.door_construction || 'single') as ComplianceDoorType)
      const electrification = (String(
        p.electrification || inferElectrification(lockType),
      ) as ElectrificationType)
      const occupancy = (String(p.occupancy || 'business') as OccupancyType)
      const fireRated = !!p.fire_rated
      const findings = evaluateCompatibility(construction, fireRated, electrification, occupancy, false)
      const critical = findings.flags.filter(f => f.level === 'critical').length
      const warnings = findings.flags.filter(f => f.level === 'warning').length
      const advisory = findings.flags.filter(f => f.level === 'advisory').length
      const summary: Row['summary'] = critical > 0 ? 'critical' : warnings > 0 ? 'warning' : 'ok'
      return {
        device: d,
        label: d.label || d.id.slice(0, 8),
        construction,
        electrification,
        occupancy,
        fireRated,
        lockType,
        readerIn: String(p.reader_in || '—'),
        readerOut: String(p.reader_out || 'none'),
        rex: !!p.rex,
        contact: !!p.door_contact,
        controller: String(p.controller_id || ''),
        critical,
        warnings,
        advisory,
        summary,
      }
    })
  }, [devices])

  const visible = rows.filter(r => filter === 'all' || r.summary === filter)

  const totals = useMemo(() => ({
    all: rows.length,
    critical: rows.filter(r => r.summary === 'critical').length,
    warning: rows.filter(r => r.summary === 'warning').length,
    ok: rows.filter(r => r.summary === 'ok').length,
  }), [rows])

  async function handleExport(format: ExportFormat) {
    const exportRows = rows.map(r => ({
      'Label': r.label,
      'Construction': DOOR_TYPE_LABELS[r.construction],
      'Lock': r.lockType,
      'Electrification': ELECTRIFICATION_LABELS[r.electrification],
      'Occupancy': OCCUPANCY_LABELS[r.occupancy],
      'Fire Rated': r.fireRated ? 'Yes' : 'No',
      'Reader In': r.readerIn,
      'Reader Out': r.readerOut,
      'REX': r.rex ? 'Yes' : 'No',
      'Contact': r.contact ? 'Yes' : 'No',
      'Controller': r.controller,
      'Critical': r.critical,
      'Warnings': r.warnings,
      'Advisory': r.advisory,
    }))
    const columns = Object.keys(exportRows[0] ?? { Label: '' })
    await exportInFormat(
      `${designName} — Door Schedule`,
      exportRows,
      columns,
      `${designName.replace(/[^a-z0-9]/gi, '_')}_Door_Schedule.xlsx`,
      format,
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0, 0, 0, 0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 1400, maxHeight: '90vh',
        background: '#0f1419', border: '1px solid #1f2937',
        borderRadius: 8, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #1f2937',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e5e7eb' }}>Door Schedule</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {totals.all} doors · {totals.critical} critical · {totals.warning} warnings · {totals.ok} compliant
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 20px', borderBottom: '1px solid #1f2937', gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'critical', 'warning', 'ok'] as const).map(f => {
              const active = filter === f
              const count = f === 'all' ? totals.all : totals[f]
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '5px 10px', fontSize: 10, fontWeight: 600,
                  borderRadius: 4, border: `1px solid ${active ? '#3b82f6' : '#374151'}`,
                  background: active ? '#3b82f620' : 'transparent',
                  color: active ? '#60a5fa' : '#9ca3af', cursor: 'pointer',
                  textTransform: 'uppercase',
                }}>
                  {f} ({count})
                </button>
              )
            })}
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

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
          {visible.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
              {rows.length === 0
                ? 'No ACS devices placed on this design yet.'
                : 'No doors match the current filter.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#0f1419' }}>
                <tr style={{ borderBottom: '1px solid #1f2937' }}>
                  {['', 'Label', 'Construction', 'Lock', 'Electrification', 'Occupancy', 'Fire', 'Reader In', 'Reader Out', 'REX', 'DPS', 'Controller', 'Findings'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 8px', fontSize: 9,
                      fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(r => {
                  const Icon =
                    r.summary === 'critical' ? AlertOctagon :
                    r.summary === 'warning' ? AlertTriangle : CheckCircle2
                  const color =
                    r.summary === 'critical' ? '#dc2626' :
                    r.summary === 'warning' ? '#d97706' : '#16a34a'
                  return (
                    <tr
                      key={r.device.id}
                      onClick={() => { onSelectDevice(r.device.id); onClose() }}
                      style={{
                        borderBottom: '1px solid #1f2937',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1f293780')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '8px', width: 24 }}>
                        <Icon size={14} color={color} />
                      </td>
                      <td style={{ padding: '8px', color: '#e5e7eb', fontWeight: 600 }}>{r.label}</td>
                      <td style={{ padding: '8px', color: '#d1d5db' }}>{DOOR_TYPE_LABELS[r.construction]}</td>
                      <td style={{ padding: '8px', color: '#d1d5db' }}>{r.lockType}</td>
                      <td style={{ padding: '8px', color: '#d1d5db' }}>{ELECTRIFICATION_LABELS[r.electrification]}</td>
                      <td style={{ padding: '8px', color: '#d1d5db' }}>{OCCUPANCY_LABELS[r.occupancy]}</td>
                      <td style={{ padding: '8px', color: r.fireRated ? '#f59e0b' : '#6b7280' }}>
                        {r.fireRated ? 'Yes' : '—'}
                      </td>
                      <td style={{ padding: '8px', color: '#d1d5db' }}>{r.readerIn}</td>
                      <td style={{ padding: '8px', color: '#d1d5db' }}>{r.readerOut}</td>
                      <td style={{ padding: '8px', color: r.rex ? '#10b981' : '#6b7280' }}>{r.rex ? '✓' : '—'}</td>
                      <td style={{ padding: '8px', color: r.contact ? '#10b981' : '#6b7280' }}>{r.contact ? '✓' : '—'}</td>
                      <td style={{ padding: '8px', color: '#9ca3af', fontFamily: 'monospace', fontSize: 10 }}>
                        {r.controller || '—'}
                      </td>
                      <td style={{ padding: '8px', color }}>
                        {r.critical > 0 && <span>{r.critical}C </span>}
                        {r.warnings > 0 && <span>{r.warnings}W </span>}
                        {r.advisory > 0 && <span style={{ color: '#7c3aed' }}>{r.advisory}A</span>}
                        {r.critical + r.warnings + r.advisory === 0 && <span style={{ color: '#16a34a' }}>OK</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const exportBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 10px', fontSize: 10, fontWeight: 600,
  borderRadius: 4, border: '1px solid #374151',
  background: 'transparent', color: '#d1d5db',
  cursor: 'pointer', textTransform: 'uppercase',
}
