'use client'
/**
 * MdfRightPanel — IPVM-style MDF/IDF cabling panel.
 *
 * Shows when an MDF/IDF node is selected on the canvas:
 *   - MDF name + color badge
 *   - Service loop input
 *   - Connected devices list with cable lengths
 *   - Cable type per connection
 *   - Disconnect button per device
 *   - Total cable length summary
 *   - Notes field
 *   - Delete + Draw Cable actions
 */

import React, { useState, useCallback } from 'react'
import { X, Trash2, Cable, Unplug, Pencil, Copy, MapPin, StickyNote } from 'lucide-react'
import { C } from './constants'
import type { DesignDevice, DesignMdfIdf, DesignCable } from '@/types/database'

/* ─── MDF Color Cycling ─── */
const MDF_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#14b8a6']

/* ─── Props ─── */
interface Props {
  mdf: DesignMdfIdf
  cables: DesignCable[]
  devices: DesignDevice[]
  scalePxPerFt: number
  onClose: () => void
  onDelete: (id: string) => void
  onUpdateMdf: (id: string, updates: Record<string, unknown>) => void
  onDisconnectDevice: (cableId: string) => void
  onStartCableFromMdf: (mdfId: string) => void
}

/* ─── Helpers ─── */
function getMdfColor(mdf: DesignMdfIdf, allMdfs?: DesignMdfIdf[]) {
  return mdf.color_hex || MDF_COLORS[0]
}

function getCablesForMdf(mdf: DesignMdfIdf, cables: DesignCable[]): DesignCable[] {
  return cables.filter(cb =>
    cb.mdf_idf_id === mdf.id ||
    cb.from_device_id === mdf.id ||
    cb.to_device_id === mdf.id
  )
}

function getConnectedDeviceId(cable: DesignCable, mdfId: string): string | null {
  if (cable.from_device_id === mdfId) return cable.to_device_id
  if (cable.to_device_id === mdfId) return cable.from_device_id
  // If linked via mdf_idf_id, use from_device_id as the device
  return cable.from_device_id
}

/* ─── Cable Type Labels ─── */
const CABLE_TYPES: Record<string, string> = {
  cat6: 'Cat6', cat6a: 'Cat6a', cat5e: 'Cat5e',
  fiber_om3: 'Fiber OM3', fiber_om4: 'Fiber OM4', fiber_sm: 'Fiber SM',
  '18_2': '18/2', '22_4': '22/4', '22_6': '22/6', '14_2': '14/2',
  speaker: 'Speaker Wire', coax: 'Coax', other: 'Other',
}

/* ─── Component ─── */
export function MdfRightPanel({
  mdf, cables, devices, scalePxPerFt,
  onClose, onDelete, onUpdateMdf, onDisconnectDevice, onStartCableFromMdf,
}: Props) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(mdf.name)
  const [serviceLoop, setServiceLoop] = useState(mdf.service_loop_ft || 10)
  const [notes, setNotes] = useState(mdf.notes || '')

  const mdfCables = getCablesForMdf(mdf, cables)
  const mdfColor = getMdfColor(mdf)

  // Calculate estimated cable distances for devices without explicit cables
  const getEstimatedDistance = useCallback((device: DesignDevice) => {
    const dx = device.position_x - mdf.position_x
    const dy = device.position_y - mdf.position_y
    return Math.sqrt(dx * dx + dy * dy) / (scalePxPerFt || 10)
  }, [mdf, scalePxPerFt])

  // Total cable lengths — use length_ft only (total_length_ft includes service loop from DB, causes double-count)
  const totalCableLength = mdfCables.reduce((sum, cb) => sum + (cb.length_ft || 0), 0)
  const totalWithServiceLoop = totalCableLength + (mdfCables.length * serviceLoop)

  const handleNameSave = () => {
    setEditingName(false)
    if (nameInput.trim() && nameInput !== mdf.name) {
      onUpdateMdf(mdf.id, { name: nameInput.trim() })
    }
  }

  const handleServiceLoopChange = (val: number) => {
    const clamped = Math.max(0, Math.min(50, val))
    setServiceLoop(clamped)
    onUpdateMdf(mdf.id, { service_loop_ft: clamped })
  }

  const handleNotesSave = () => {
    if (notes !== (mdf.notes || '')) {
      onUpdateMdf(mdf.id, { notes })
    }
  }

  // Copy cable schedule to clipboard
  const handleCopySchedule = useCallback(() => {
    const lines = [`${mdf.name} — Cable Schedule`, '']
    lines.push(`Service Loop: ${serviceLoop} ft`)
    lines.push('')
    lines.push('Device | Cable Type | Length (ft) | Total w/ Loop')
    lines.push('--- | --- | --- | ---')
    for (const cb of mdfCables) {
      const devId = getConnectedDeviceId(cb, mdf.id)
      const dev = devices.find(d => d.id === devId)
      const devLabel = dev?.label || devId || 'Unknown'
      const len = cb.length_ft || 0
      const cType = CABLE_TYPES[cb.cable_type] || cb.cable_type || 'Cat6'
      lines.push(`${devLabel} | ${cType} | ${Math.round(len)} | ${Math.round(len + serviceLoop)}`)
    }
    lines.push('')
    lines.push(`Total: ${Math.round(totalCableLength)} ft (${Math.round(totalWithServiceLoop)} ft with service loops)`)
    navigator.clipboard.writeText(lines.join('\n'))
  }, [mdf, mdfCables, devices, serviceLoop, totalCableLength, totalWithServiceLoop])

  return (
    <div style={{
      width: 300, height: '100%', background: C.bgSurface,
      borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: 'inherit',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        borderBottom: `1px solid ${C.border}`, minHeight: 44,
      }}>
        {/* Color badge */}
        <div style={{
          width: 12, height: 12, borderRadius: 3,
          background: mdfColor, flexShrink: 0,
        }} />

        {/* Name */}
        {editingName ? (
          <input
            autoFocus
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={e => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') setEditingName(false) }}
            style={{
              flex: 1, background: C.bgActive, border: `1px solid ${C.accent}40`,
              borderRadius: 4, padding: '2px 6px', color: C.text,
              fontSize: 13, fontWeight: 700, outline: 'none', fontFamily: 'inherit',
            }}
          />
        ) : (
          <div
            style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text, cursor: 'pointer' }}
            onClick={() => setEditingName(true)}
            title="Click to rename"
          >
            {mdf.name || 'MDF'} <Pencil size={10} style={{ opacity: 0.4, marginLeft: 2 }} />
          </div>
        )}

        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.textMuted,
          cursor: 'pointer', padding: 2,
        }}><X size={16} /></button>
      </div>

      {/* ── Scrollable Content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Color selector */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.textDim, marginBottom: 6 }}>Color</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {MDF_COLORS.map(clr => (
              <button key={clr} onClick={() => onUpdateMdf(mdf.id, { color_hex: clr })}
                style={{
                  width: 22, height: 22, borderRadius: '50%', background: clr,
                  border: mdfColor === clr ? '2.5px solid #fff' : '1.5px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', boxShadow: mdfColor === clr ? `0 0 0 1.5px ${clr}` : 'none',
                  transition: 'all 0.15s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Location */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.textDim, marginBottom: 4 }}>
            <MapPin size={10} /> Position
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>
            X: {Math.round(mdf.position_x)} · Y: {Math.round(mdf.position_y)}
          </div>
          {mdf.location_description && (
            <div style={{ fontSize: 11, color: C.text, marginTop: 4 }}>
              {mdf.location_description}
            </div>
          )}
        </div>

        {/* Service Loop */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Service Loop</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="range" min={0} max={50} step={1} value={serviceLoop}
              onChange={e => handleServiceLoopChange(Number(e.target.value))}
              style={{
                flex: 1, height: 4, appearance: 'none', background: C.bgActive,
                borderRadius: 2, outline: 'none', cursor: 'pointer', accentColor: mdfColor,
              }}
            />
            <div style={{
              display: 'flex', alignItems: 'center',
              background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4,
            }}>
              <input
                type="number" value={serviceLoop} min={0} max={50}
                onChange={e => handleServiceLoopChange(Number(e.target.value))}
                style={{
                  width: 40, textAlign: 'center', background: 'transparent',
                  border: 'none', color: C.text, fontFamily: 'monospace',
                  fontSize: 11, outline: 'none', padding: '3px 0',
                }}
              />
              <span style={{ fontSize: 9, color: C.textDim, paddingRight: 4 }}>ft</span>
            </div>
          </div>
        </div>

        {/* Connected Devices */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>
              Connected Devices ({mdfCables.length})
            </div>
            <button
              onClick={handleCopySchedule}
              title="Copy cable schedule to clipboard"
              style={{
                background: 'none', border: 'none', color: C.textMuted,
                cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 9,
              }}
            >
              <Copy size={10} /> Copy
            </button>
          </div>

          {mdfCables.length === 0 ? (
            <div style={{
              padding: '16px 0', textAlign: 'center', fontSize: 11, color: C.textDim,
            }}>
              No devices connected.
              <br />
              <span style={{ fontSize: 10 }}>Use the Cable tool to connect devices to this MDF.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {mdfCables.map(cb => {
                const devId = getConnectedDeviceId(cb, mdf.id)
                const dev = devices.find(d => d.id === devId)
                const cableLen = cb.length_ft || (dev ? getEstimatedDistance(dev) : 0)
                const totalLen = cableLen + serviceLoop
                const cType = CABLE_TYPES[cb.cable_type] || cb.cable_type || 'Cat6'

                return (
                  <div key={cb.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 8px', background: C.bgActive,
                    borderRadius: 4, border: `1px solid ${C.border}`,
                  }}>
                    {/* Color dot */}
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: mdfColor, flexShrink: 0,
                    }} />

                    {/* Device info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 600, color: C.text,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {dev?.label || 'Unknown Device'}
                      </div>
                      <div style={{
                        display: 'flex', gap: 6, fontSize: 9, color: C.textDim, marginTop: 1,
                      }}>
                        <span>{cType}</span>
                        <span>·</span>
                        <span>{Math.round(cableLen)} ft</span>
                        <span>·</span>
                        <span style={{ color: C.textMuted }}>
                          {Math.round(totalLen)} ft total
                        </span>
                      </div>
                    </div>

                    {/* Disconnect button */}
                    <button
                      onClick={() => onDisconnectDevice(cb.id)}
                      title="Disconnect"
                      style={{
                        background: 'none', border: 'none', color: C.textDim,
                        cursor: 'pointer', padding: 3, borderRadius: 3,
                        display: 'flex',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.background = '#ef444415' }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.background = 'none' }}
                    >
                      <Unplug size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Cable Summary */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Cable Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.textMuted }}>Cables</span>
              <span style={{ color: C.text, fontWeight: 600, fontFamily: 'monospace' }}>{mdfCables.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.textMuted }}>Total Cable</span>
              <span style={{ color: C.text, fontWeight: 600, fontFamily: 'monospace' }}>{Math.round(totalCableLength)} ft</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.textMuted }}>Service Loops ({mdfCables.length} × {serviceLoop} ft)</span>
              <span style={{ color: C.text, fontWeight: 600, fontFamily: 'monospace' }}>{mdfCables.length * serviceLoop} ft</span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              paddingTop: 4, borderTop: `1px solid ${C.borderSubtle}`,
              fontWeight: 700,
            }}>
              <span style={{ color: C.text }}>Grand Total</span>
              <span style={{ color: mdfColor, fontFamily: 'monospace' }}>{Math.round(totalWithServiceLoop)} ft</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>
            <StickyNote size={10} /> Notes
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleNotesSave}
            placeholder="Add notes about this MDF/IDF..."
            rows={3}
            style={{
              width: '100%', background: C.bgActive, border: `1px solid ${C.border}`,
              borderRadius: 4, padding: '6px 8px', color: C.text, fontSize: 11,
              resize: 'vertical', fontFamily: 'inherit', outline: 'none',
              minHeight: 48,
            }}
          />
        </div>
      </div>

      {/* ── Actions Footer ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <button
          onClick={() => onStartCableFromMdf(mdf.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '8px 0', background: `${mdfColor}15`, border: `1px solid ${mdfColor}40`,
            borderRadius: 6, color: mdfColor, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Cable size={12} /> Draw Cable
        </button>
        <button
          onClick={() => onDelete(mdf.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '8px 0', background: '#ef444415', border: `1px solid #ef444440`,
            borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  )
}
