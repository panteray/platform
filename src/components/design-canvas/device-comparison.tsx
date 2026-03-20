'use client'

import React from 'react'
import { C } from './constants'
import { classifyDori, calculatePpfAtDistance } from '@/lib/calculators'
import type { DoriClassification } from '@/lib/calculators'
import type { DesignDevice } from '@/types/database'

interface DeviceComparisonProps {
  devices: DesignDevice[]
  /** IDs of 2-3 devices to compare */
  compareIds: string[]
  /** Reference distance for PPF comparison (ft) */
  referenceDistFt?: number
  onClose?: () => void
  onRemove?: (deviceId: string) => void
}

const DORI_COLORS: Record<DoriClassification, string> = {
  identification: C.green,
  recognition: C.yellow,
  observation: C.orange,
  detection: C.red,
  none: '#78716c',
}

const DORI_LABELS: Record<DoriClassification, string> = {
  identification: 'ID',
  recognition: 'REC',
  observation: 'OBS',
  detection: 'DET',
  none: '—',
}

interface SpecRow {
  label: string
  key: string
  format?: (val: unknown) => string
}

const SPEC_ROWS: SpecRow[] = [
  { label: 'Resolution', key: 'resolution_w', format: (v) => {
    const w = Number(v); if (!w) return '—'
    if (w >= 3840) return `4K (${w}px)`
    const mp = Math.round(w * w * 0.5625 / 1000000)
    return `${mp}MP (${w}px)`
  }},
  { label: 'Sensor', key: 'sensor_width', format: (v) => v ? `${v}mm` : '—' },
  { label: 'Focal Length', key: 'focal_length', format: (v) => v ? `${v}mm` : '—' },
  { label: 'H-FOV', key: 'h_fov', format: (v) => v ? `${Number(v).toFixed(0)}°` : '—' },
  { label: 'Mount Height', key: 'mount_height', format: (v) => v ? `${v} ft` : '—' },
  { label: 'Mount Type', key: 'mount_type', format: (v) => v ? String(v) : '—' },
  { label: 'PoE', key: 'poe_standard', format: (v) => v ? `802.3${v}` : '—' },
  { label: 'Wattage', key: 'poe_watts', format: (v) => v ? `${v}W` : '—' },
  { label: 'FPS', key: 'fps', format: (v) => v ? `${v} fps` : '—' },
  { label: 'Compression', key: 'compression', format: (v) => v ? String(v).toUpperCase() : '—' },
  { label: 'IR Range', key: 'ir_range_ft', format: (v) => v ? `${v} ft` : '—' },
  { label: 'IP Rating', key: 'ip_rating', format: (v) => v ? String(v) : '—' },
  { label: 'NDAA', key: 'ndaa_compliant', format: (v) => v === true ? '✓ Yes' : v === false ? '✗ No' : '—' },
]

/**
 * Device Comparison Panel — side-by-side spec comparison for 2-3 cameras.
 * Matches Hanwha Design Pro's device comparison feature.
 */
export function DeviceComparison({ devices, compareIds, referenceDistFt = 30, onClose, onRemove }: DeviceComparisonProps) {
  const compareDevices = compareIds
    .map((id) => devices.find((d) => d.id === id))
    .filter(Boolean) as DesignDevice[]

  if (compareDevices.length < 2) {
    return (
      <div style={{
        width: 340, background: C.bgPanel, borderLeft: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', height: '100%', padding: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Device Comparison</div>
        <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', padding: '32px 0' }}>
          Select at least 2 cameras to compare.<br />
          Right-click a device → &quot;Add to Compare&quot;
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 12px', color: C.textMuted, cursor: 'pointer', fontSize: 11, marginTop: 8 }}>
            Close
          </button>
        )}
      </div>
    )
  }

  const getProp = (device: DesignDevice, key: string): unknown => {
    const props = (device.properties ?? {}) as Record<string, unknown>
    if (key === 'mount_type') return device.mount_type ?? props.mount_type
    return props[key]
  }

  // Compute PPF at reference distance for each device
  const ppfData = compareDevices.map((d) => {
    const props = (d.properties ?? {}) as Record<string, unknown>
    const resW = (props.resolution_w as number) || 0
    const sensorW = (props.sensor_width as number) || 0
    const focalLength = (props.focal_length as number) || 0
    if (!resW || !sensorW || !focalLength) return null
    const ppf = calculatePpfAtDistance(resW, sensorW, focalLength, referenceDistFt)
    const dori = classifyDori(ppf)
    return { ppf: Math.round(ppf), dori }
  })

  // Find best PPF for highlighting
  const maxPpf = Math.max(...ppfData.map((p) => p?.ppf ?? 0))

  const colWidth = `${Math.floor(100 / compareDevices.length)}%`

  return (
    <div style={{
      width: Math.min(600, compareDevices.length * 180 + 140), background: C.bgPanel,
      borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.bgSurface,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Compare Devices</div>
          <div style={{ fontSize: 10, color: C.textDim }}>{compareDevices.length} cameras</div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14 }}>×</button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
        {/* Device headers */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.bgSurface, zIndex: 1 }}>
          <div style={{ width: 120, flexShrink: 0, padding: '10px 12px', fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: 'uppercase' }}>
            Spec
          </div>
          {compareDevices.map((d, i) => (
            <div key={d.id} style={{ flex: 1, padding: '10px 8px', borderLeft: `1px solid ${C.border}`, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.label || `Camera ${i + 1}`}
              </div>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.category}
              </div>
              {onRemove && (
                <button onClick={() => onRemove(d.id)} style={{ fontSize: 9, color: C.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {/* PPF at reference distance — highlighted row */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: `${C.accent}08` }}>
          <div style={{ width: 120, flexShrink: 0, padding: '10px 12px', fontSize: 10, color: C.accent, fontWeight: 700 }}>
            PPF @ {referenceDistFt}ft
          </div>
          {ppfData.map((p, i) => (
            <div key={i} style={{ flex: 1, padding: '10px 8px', borderLeft: `1px solid ${C.border}` }}>
              {p ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 16, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace",
                    color: p.ppf === maxPpf ? DORI_COLORS[p.dori] : C.textMuted,
                  }}>
                    {p.ppf}
                  </span>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 3,
                    background: `${DORI_COLORS[p.dori]}18`, color: DORI_COLORS[p.dori], fontWeight: 600,
                  }}>
                    {DORI_LABELS[p.dori]}
                  </span>
                  {p.ppf === maxPpf && ppfData.filter(Boolean).length > 1 && (
                    <span style={{ fontSize: 8, color: C.green, fontWeight: 700 }}>★ Best</span>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: 10, color: C.textDim }}>—</span>
              )}
            </div>
          ))}
        </div>

        {/* Spec rows */}
        {SPEC_ROWS.map((spec, ri) => (
          <div key={spec.key} style={{
            display: 'flex', borderBottom: `1px solid ${C.borderSubtle}`,
            background: ri % 2 === 0 ? 'transparent' : `${C.bgSurface}60`,
          }}>
            <div style={{ width: 120, flexShrink: 0, padding: '7px 12px', fontSize: 10, color: C.textDim, fontWeight: 600 }}>
              {spec.label}
            </div>
            {compareDevices.map((d) => {
              const val = getProp(d, spec.key)
              const formatted = spec.format ? spec.format(val) : (val != null ? String(val) : '—')
              return (
                <div key={d.id} style={{ flex: 1, padding: '7px 8px', borderLeft: `1px solid ${C.borderSubtle}`, fontSize: 11, color: formatted === '—' ? C.textDim : C.text, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {formatted}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
