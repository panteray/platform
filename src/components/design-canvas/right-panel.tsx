'use client'
/**
 * RightPanel — Device properties panel (DesignPro pattern).
 *
 * Tabs: FoV | Acc | Lens | License
 * FoV: editable label, model, focal/distance/height/tilt/rotation, DORI
 * Acc: mount type, environment, wiring, recording
 * Lens: device specs from library
 * License: placeholder
 */

import React, { useState, useCallback, useMemo } from 'react'
import { X, Copy, Trash2, Cable, ChevronDown, ChevronRight, Lock, Unlock } from 'lucide-react'
import { C } from './constants'
import { calculatePpfAtDistance, classifyDori } from '@/lib/calculators'
import type { DesignDevice, DesignMdfIdf } from '@/types/database'

/* ─── Color Palette ─── */
const COLOR_PALETTE = [
  '#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#8b5cf6','#ec4899',
  '#dc2626','#ea580c','#ca8a04','#16a34a','#0891b2','#2563eb','#7c3aed','#db2777',
]

/* ─── Collapsible Section ─── */
function Section({ title, defaultOpen = false, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', background: 'none', border: 'none',
        color: C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left',
      }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div style={{ padding: '0 16px 10px' }}>{children}</div>}
    </div>
  )
}

/* ─── Mount Types ─── */
const MOUNT_TYPES = ['Ceiling', 'Wall', 'Pole', 'Pendant'] as const

/* ─── Props ─── */
interface Props {
  device: DesignDevice
  onClose: () => void
  onUpdateDevice: (id: string, updates: Record<string, unknown>) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  scalePxPerFt: number
  onChangeModel?: (id: string) => void
  mdfIdfs?: DesignMdfIdf[]
  showIrRange?: boolean
  onToggleIrRange?: (show: boolean) => void
  hiddenPpfZones?: Set<string>
  onTogglePpfZone?: (zone: string) => void
  showBlindSpot?: boolean
  onToggleBlindSpot?: (show: boolean) => void
  onDisconnectCable?: (deviceId: string) => void
  selectedImagerIdx?: number | null
  onSelectImager?: (idx: number | null) => void
  onShowSimulatedView?: () => void
}

/* ─── Stat Row ─── */
function StatRow({ label, value, unit, color }: {
  label: string; value: string | number; unit?: string; color?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 10, color: C.textDim }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'monospace', color: color || C.text }}>
        {value}{unit ? <span style={{ fontSize: 9, color: C.textDim, marginLeft: 2 }}>{unit}</span> : null}
      </span>
    </div>
  )
}

/* ─── Editable Row ─── */
function EditableRow({ label, value, unit, onChange, step = 1, min }: {
  label: string; value: number; unit: string; onChange: (v: number) => void; step?: number; min?: number
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 10, color: C.textDim }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <input type="number" value={value} step={step} min={min}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: 56, padding: '2px 6px', background: C.bgActive,
            border: `1px solid ${C.border}`, borderRadius: 3,
            color: C.text, fontSize: 11, fontFamily: 'monospace',
            outline: 'none', textAlign: 'right',
          }} />
        <span style={{ fontSize: 9, color: C.textDim, width: 16 }}>{unit}</span>
      </div>
    </div>
  )
}

/* ─── DORI Feedback ─── */
function DoriFeedback({ resolutionW, sensorW, focalLength, targetDist }: {
  resolutionW: number; sensorW: number; focalLength: number; targetDist: number
}) {
  const hasSensor = resolutionW > 0 && sensorW > 0 && focalLength > 0
  const ppf = hasSensor ? calculatePpfAtDistance(resolutionW, sensorW, focalLength, targetDist) : 0
  const dori = hasSensor ? classifyDori(ppf) : 'none'

  const tiers = [
    { key: 'monitor', label: 'MON', color: '#6b7280', threshold: 4 },
    { key: 'detection', label: 'DET', color: '#ef4444', threshold: 8 },
    { key: 'observation', label: 'OBS', color: '#f97316', threshold: 19 },
    { key: 'recognition', label: 'REC', color: '#eab308', threshold: 38 },
    { key: 'identification', label: 'ID', color: '#22c55e', threshold: 76 },
    { key: 'inspection', label: 'INS', color: '#8b5cf6', threshold: 305 },
  ]

  return (
    <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>DORI at Target</span>
        {hasSensor && (
          <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: C.accent }}>
            {Math.round(ppf)} PPF
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
        {tiers.map(tier => {
          const isActive = hasSensor && dori === tier.key
          const isMet = hasSensor && ppf >= tier.threshold
          return (
            <div key={tier.key} style={{
              padding: '6px 4px', textAlign: 'center', borderRadius: 4,
              background: isActive ? `${tier.color}30` : isMet ? `${tier.color}10` : 'transparent',
              border: `1px solid ${isActive ? tier.color : isMet ? `${tier.color}30` : C.border}`,
              fontSize: 8, fontWeight: 600,
              color: isActive ? tier.color : isMet ? `${tier.color}90` : C.textDim,
              lineHeight: 1.2,
            }}>
              {tier.label}
              {hasSensor && <div style={{ fontSize: 7, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{tier.threshold}+</div>}
            </div>
          )
        })}
      </div>
      {!hasSensor && (
        <div style={{ fontSize: 9, color: C.textDim, marginTop: 4, fontStyle: 'italic' }}>
          Set sensor specs for DORI analysis
        </div>
      )}
    </div>
  )
}

/* ─── Component ─── */
export function RightPanel({
  device, onClose, onUpdateDevice, onDuplicate, onDelete, scalePxPerFt, mdfIdfs,
  onChangeModel,
  showIrRange = true, onToggleIrRange, hiddenPpfZones, onTogglePpfZone,
  showBlindSpot = false, onToggleBlindSpot,
  onDisconnectCable,
  selectedImagerIdx, onSelectImager,
  onShowSimulatedView,
}: Props) {
  const [activeTab, setActiveTab] = useState<'fov' | 'acc' | 'lens' | 'license'>('fov')
  const props = useMemo(() => (device.properties ?? {}) as Record<string, unknown>, [device.properties])
  const isCamera = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'].includes(device.category)

  const updateProp = useCallback((key: string, value: unknown) => {
    onUpdateDevice(device.id, { properties: { ...props, [key]: value } })
  }, [device.id, props, onUpdateDevice])

  const focalLength = Number(props.focal_length) || 4
  const targetDist = Number(props.target_distance) || 30
  const installHeight = Number(props.install_height) || 9
  const tiltAngle = Number(props.tilt_angle) || 0
  const fovAngle = Number(props.fov_angle) || 90
  const rotation = device.rotation || 0
  const sensorW = Number(props.sensor_w) || Number(props.sensor_width) || 0
  const hFov = sensorW > 0 && focalLength > 0
    ? 2 * Math.atan(sensorW / (2 * focalLength)) * (180 / Math.PI)
    : fovAngle

  // Check if cable is connected to this device
  const hasCableConnected = !!(props.cable_type || props.switch_assignment || props.port_assignment)

  // Est cable distance
  const estCableFt = (() => {
    if (!mdfIdfs || mdfIdfs.length === 0) return 0
    let nearest = Infinity
    for (const node of mdfIdfs) {
      const dx = device.position_x - node.position_x
      const dy = device.position_y - node.position_y
      const distPx = Math.sqrt(dx * dx + dy * dy)
      const distFt = distPx / (scalePxPerFt || 10)
      if (distFt < nearest) nearest = distFt
    }
    return nearest === Infinity ? 0 : Math.round(nearest)
  })()

  return (
    <div style={{
      width: 280, height: '100%', background: C.bgPanel,
      borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', 'Segoe UI', sans-serif", overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${C.border}` }}>
        {/* Actions row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginBottom: 6 }}>
          <button onClick={() => onDuplicate(device.id)} title="Duplicate"
            style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Copy size={14} />
          </button>
          <button onClick={() => onDelete(device.id)} title="Remove from canvas"
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Trash2 size={14} />
          </button>
          <button onClick={onClose} title="Close"
            style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <X size={14} />
          </button>
        </div>

        {/* Editable device name */}
        <input
          value={device.label || ''}
          placeholder="Device name"
          onChange={e => onUpdateDevice(device.id, { label: e.target.value })}
          style={{
            width: '100%', fontSize: 14, fontWeight: 700, color: C.text,
            background: 'transparent', border: 'none', borderBottom: `1px solid ${C.borderSubtle}`,
            padding: '2px 0 4px', outline: 'none', fontFamily: 'inherit',
          }}
        />

        {/* Model name + category */}
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
            background: `${C.accent}20`, color: C.accent, letterSpacing: 0.5, textTransform: 'uppercase',
          }}>
            {device.category.replace(/_/g, ' ')}
          </span>
          <span style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>
            {props.vendor ? `${props.vendor} ${props.model || ''}` : 'No model selected'}
          </span>
        </div>

        {/* Select Model link */}
        {isCamera && (
          <button onClick={() => onChangeModel?.(device.id)}
            style={{
              marginTop: 6, width: '100%', padding: '5px 10px', fontSize: 10,
              color: C.accent, background: `${C.accent}08`, border: `1px dashed ${C.accent}40`,
              borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              textAlign: 'left',
            }}>
            Change Model →
          </button>
        )}

        {/* Floating color bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 8 }}>
          {COLOR_PALETTE.map(c => (
            <button key={c} onClick={() => onUpdateDevice(device.id, { color_hex: c })}
              style={{
                width: 14, height: 14, borderRadius: 2, background: c, border: 'none', cursor: 'pointer',
                outline: (device as unknown as Record<string, unknown>).color_hex === c ? '2px solid #fff' : 'none',
                outlineOffset: 1,
              }} />
          ))}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bgSurface }}>
        {(['fov', 'acc', 'lens', 'license'] as const).map(tab => {
          const active = activeTab === tab
          const label = tab === 'fov' ? 'FoV' : tab === 'acc' ? 'Acc' : tab === 'lens' ? 'Lens' : 'License'
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 11, fontWeight: active ? 600 : 400,
                color: active ? C.accent : C.textMuted,
                borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
                background: 'none', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ═══ FoV Tab ═══ */}
        {activeTab === 'fov' && isCamera && (
          <>
            {/* Editable camera parameters (DesignPro pattern) */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <EditableRow label="Focal Length" value={focalLength} unit="mm" step={0.1} min={0.1}
                onChange={v => updateProp('focal_length', v)} />
              <EditableRow label="Target Distance" value={targetDist} unit="ft" min={1}
                onChange={v => updateProp('target_distance', v)} />
              <EditableRow label="Install Height" value={installHeight} unit="ft" min={1}
                onChange={v => updateProp('install_height', v)} />
              <EditableRow label="Tilt Angle" value={tiltAngle} unit="°" min={-90}
                onChange={v => updateProp('tilt_angle', v)} />
              <EditableRow label="Rotation" value={rotation} unit="°"
                onChange={v => onUpdateDevice(device.id, { rotation: v })} />
              {device.category === 'fisheye' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                  <span style={{ fontSize: 10, color: C.textDim }}>Fisheye View</span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[180, 360].map(v => {
                      const active = (Number(props.fisheye_view) || 180) === v
                      return (
                        <button key={v} onClick={() => updateProp('fisheye_view', v)}
                          style={{
                            padding: '2px 8px', fontSize: 10, fontWeight: 600,
                            borderRadius: 3, border: `1px solid ${active ? C.accent : C.border}`,
                            background: active ? `${C.accent}20` : 'transparent',
                            color: active ? C.accent : C.textMuted, cursor: 'pointer', fontFamily: 'inherit',
                          }}>{v}°</button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* DORI feedback */}
            <DoriFeedback
              resolutionW={Number(props.resolution_w) || 0}
              sensorW={Number(props.sensor_w) || Number(props.sensor_width) || 0}
              focalLength={focalLength}
              targetDist={targetDist}
            />

            {/* Multi-sensor controls */}
            {(device.category === 'multisensor_quad' || device.category === 'multisensor_dual') && (
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
                {/* Lock Camera toggle */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8, padding: '6px 8px', background: props.locked ? '#22c55e15' : C.bgActive,
                  borderRadius: 4, border: `1px solid ${props.locked ? '#22c55e40' : C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {props.locked ? <Lock size={12} style={{ color: '#22c55e' }} /> : <Unlock size={12} style={{ color: C.textMuted }} />}
                    <span style={{ fontSize: 10, fontWeight: 600, color: props.locked ? '#22c55e' : C.textMuted }}>
                      {props.locked ? 'Camera Locked' : 'Lock Camera'}
                    </span>
                  </div>
                  <button onClick={() => updateProp('locked', !props.locked)}
                    style={{
                      padding: '2px 8px', fontSize: 9, fontWeight: 600,
                      background: props.locked ? '#22c55e20' : 'transparent',
                      border: `1px solid ${props.locked ? '#22c55e' : C.border}`,
                      borderRadius: 3, color: props.locked ? '#22c55e' : C.textMuted,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    {props.locked ? 'Unlock' : 'Lock'}
                  </button>
                </div>
                {/* Sensor heads */}
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  Sensor Heads ({device.category === 'multisensor_quad' ? 4 : 2})
                </div>
                {(() => {
                  const sensorCount = device.category === 'multisensor_quad' ? 4 : 2
                  const base = rotation
                  const defaultAngles = device.category === 'multisensor_quad'
                    ? [base, base + 90, base + 180, base + 270]
                    : [base - 45, base + 45]
                  const angles = (props.sensor_angles as number[] | undefined) || defaultAngles
                  const sensorColors = ['#3b82f6', '#22c55e', '#f97316', '#a855f7']
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {Array.from({ length: sensorCount }, (_, i) => {
                        const angle = angles[i] ?? defaultAngles[i]
                        const normalizedAngle = ((angle % 360) + 360) % 360
                        return (
                          <div key={i} style={{
                            padding: '6px 8px', background: C.bgActive, borderRadius: 4,
                            border: `1px solid ${sensorColors[i]}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: sensorColors[i], display: 'inline-block' }} />
                              <span style={{ fontSize: 10, fontWeight: 700, color: sensorColors[i] }}>S{i + 1}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <input type="number" value={Math.round(normalizedAngle)} min={0} max={360} step={1}
                                onChange={e => {
                                  const newAngles = [...angles]
                                  newAngles[i] = Number(e.target.value)
                                  updateProp('sensor_angles', newAngles)
                                }}
                                style={{
                                  width: 44, padding: '2px 4px', background: C.bgPanel,
                                  border: `1px solid ${C.border}`, borderRadius: 3,
                                  color: C.text, fontSize: 10, fontFamily: 'monospace',
                                  outline: 'none', textAlign: 'right',
                                }} />
                              <span style={{ fontSize: 9, color: C.textDim }}>°</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Notes */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Notes</div>
              <textarea
                value={String(props.notes || '')} placeholder="Add notes..."
                onChange={e => updateProp('notes', e.target.value)}
                style={{
                  width: '100%', minHeight: 50, padding: '6px 10px', background: C.bgActive,
                  border: `1px solid ${C.border}`, borderRadius: 4,
                  color: C.text, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                }}
              />
            </div>
          </>
        )}

        {/* FoV tab for non-camera devices */}
        {activeTab === 'fov' && !isCamera && (
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>
              FOV settings are only available for camera devices.
            </div>
          </div>
        )}

        {/* ═══ Acc Tab ═══ */}
        {activeTab === 'acc' && (
          <div style={{ padding: '0' }}>
            {/* Mount Type */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Mount Type</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {MOUNT_TYPES.map(mt => {
                  const active = (props.mount_type || 'Ceiling') === mt
                  return (
                    <button key={mt} onClick={() => updateProp('mount_type', mt)}
                      style={{
                        flex: 1, padding: '5px 0', fontSize: 9, fontWeight: 600,
                        borderRadius: 4, border: `1px solid ${active ? C.accent : C.border}`,
                        background: active ? `${C.accent}20` : 'transparent',
                        color: active ? C.accent : C.textMuted, cursor: 'pointer', fontFamily: 'inherit',
                      }}>{mt}</button>
                  )
                })}
              </div>
              {/* Height warning */}
              <div style={{ marginTop: 6, padding: '4px 8px', background: C.bgActive, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <StatRow label="Install Height" value={installHeight} unit="ft" />
                {installHeight > 12 ? (
                  <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>⚠ Lift required — {installHeight}ft</div>
                ) : (
                  <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, marginTop: 2 }}>✓ Standard ladder access</div>
                )}
              </div>
            </div>

            {/* Environment */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Environment</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {['Indoor', 'Outdoor'].map(env => {
                  const active = (props.environment || 'Indoor') === env
                  return (
                    <button key={env} onClick={() => updateProp('environment', env)}
                      style={{
                        flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 600,
                        borderRadius: 4, border: `1px solid ${active ? C.accent : C.border}`,
                        background: active ? `${C.accent}20` : 'transparent',
                        color: active ? C.accent : C.textMuted, cursor: 'pointer', fontFamily: 'inherit',
                      }}>{env}</button>
                  )
                })}
              </div>
            </div>

            {/* PoE / Power */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <StatRow label="PoE Standard" value={String(props.poe_standard || '-')} />
              <StatRow label="Wattage" value={props.wattage ? `${props.wattage}` : '-'} unit="W" />
            </div>

            {/* Wiring */}
            <Section title="Wiring" defaultOpen={hasCableConnected}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { key: 'cable_type', label: 'Cable Type', ph: 'Cat6, Cat6a…' },
                  { key: 'switch_assignment', label: 'Switch', ph: 'SW-01' },
                  { key: 'port_assignment', label: 'Port', ph: 'Port 1' },
                  { key: 'cable_length', label: 'Cable Length (ft)', ph: estCableFt > 0 ? `~${estCableFt} (auto)` : '125' },
                ].map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>{f.label}</div>
                    <input value={String(props[f.key] || '')} placeholder={f.ph}
                      onChange={e => updateProp(f.key, e.target.value)}
                      style={{
                        width: '100%', padding: '4px 8px', background: C.bgActive,
                        border: `1px solid ${C.border}`, borderRadius: 3,
                        color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none',
                      }} />
                  </div>
                ))}
                {/* Est cable to MDF — only show when cable is connected */}
                {hasCableConnected && estCableFt > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: C.bgActive, borderRadius: 4, border: `1px solid ${C.border}` }}>
                    <Cable size={12} style={{ color: C.accent, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: C.textDim }}>Est. cable to MDF</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{estCableFt} ft</div>
                    </div>
                  </div>
                )}
                {onDisconnectCable && (
                  <button onClick={() => onDisconnectCable(device.id)}
                    style={{
                      marginTop: 4, padding: '4px 8px', fontSize: 10,
                      background: 'transparent', border: '1px solid #ef4444',
                      borderRadius: 3, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                    }}>Disconnect</button>
                )}
              </div>
            </Section>

            {/* Recording */}
            {isCamera && (
              <Section title="Recording">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Codec</div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {['H.264', 'H.264+', 'H.265'].map(c => {
                        const active = (props.codec || 'H.265') === c
                        return (
                          <button key={c} onClick={() => updateProp('codec', c)}
                            style={{
                              flex: 1, padding: '3px 0', fontSize: 9, fontWeight: 500,
                              borderRadius: 3, border: `1px solid ${active ? C.accent : C.border}`,
                              background: active ? `${C.accent}20` : 'transparent',
                              color: active ? C.accent : C.textMuted, cursor: 'pointer', fontFamily: 'inherit',
                            }}>{c}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Recording Mode</div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {['Continuous', 'Motion', 'Motion+Obj', 'None'].map(m => {
                        const active = (props.recording_mode || 'Continuous') === m
                        return (
                          <button key={m} onClick={() => updateProp('recording_mode', m)}
                            style={{
                              flex: 1, padding: '3px 0', fontSize: 8, fontWeight: 500,
                              borderRadius: 3, border: `1px solid ${active ? C.accent : C.border}`,
                              background: active ? `${C.accent}20` : 'transparent',
                              color: active ? C.accent : C.textMuted, cursor: 'pointer', fontFamily: 'inherit',
                            }}>{m}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>FPS</div>
                      <input type="number" value={Number(props.recording_fps) || 15}
                        onChange={e => updateProp('recording_fps', Number(e.target.value))}
                        style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 10, fontFamily: 'monospace', outline: 'none' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Retention (days)</div>
                      <input type="number" value={Number(props.retention_days) || 30}
                        onChange={e => updateProp('retention_days', Number(e.target.value))}
                        style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 10, fontFamily: 'monospace', outline: 'none' }} />
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* Access Control config */}
            {['access_control', 'door', 'door_controller', 'card_reader', 'electric_strike', 'maglock'].includes(device.category) && (
              <Section title="Door Configuration" defaultOpen>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Door Type</div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {['Standard', 'ADA Auto-Operator', 'Mantrap', 'Mantrap + ADA'].map(t => {
                        const active = (props.door_type || 'Standard') === t
                        return (
                          <button key={t} onClick={() => updateProp('door_type', t)}
                            style={{
                              padding: '3px 6px', fontSize: 8, fontWeight: 600, borderRadius: 3,
                              border: `1px solid ${active ? C.accent : C.border}`,
                              background: active ? `${C.accent}20` : 'transparent',
                              color: active ? C.accent : C.textMuted, cursor: 'pointer', fontFamily: 'inherit',
                            }}>{t}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Lock Type</div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {['Electric Strike', 'Magnetic Lock', 'Electrified Hardware'].map(t => {
                        const active = (props.lock_type || 'Electric Strike') === t
                        return (
                          <button key={t} onClick={() => updateProp('lock_type', t)}
                            style={{
                              flex: 1, padding: '3px 0', fontSize: 8, fontWeight: 600, borderRadius: 3,
                              border: `1px solid ${active ? C.accent : C.border}`,
                              background: active ? `${C.accent}20` : 'transparent',
                              color: active ? C.accent : C.textMuted, cursor: 'pointer', fontFamily: 'inherit',
                            }}>{t}</button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ═══ Lens Tab ═══ */}
        {activeTab === 'lens' && (
          <div style={{ padding: '10px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>Device Specifications</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
              {([
                ['Vendor', props.vendor || '—'],
                ['Model', props.model || '—'],
                ['Part #', props.partnumber || '—'],
                ['Form', props.form || '—'],
                ['Max Res', props.resolution_w ? `${props.resolution_w}x${props.resolution_h}` : (props.resolution ? String(props.resolution) : '—')],
                ['FPS', props.fps ? `${props.fps}fps` : '—'],
                ['Focal Length', props.focal_length ? `${props.focal_length}mm` : '—'],
                ['Lens Type', props.focal_type || '—'],
                ['AOV', props.aov || '—'],
                ['Sensor', props.sensor_w ? `${props.sensor_w}mm` : '—'],
                ['PoE', props.poe_standard || '—'],
                ['Power', props.wattage ? `${props.wattage}W` : '—'],
                ['IR', props.ir || (props.ir_range ? `${props.ir_range}ft` : '—')],
                ['NDAA', props.ndaa_compliant === true ? 'Yes' : props.ndaa_compliant === false ? 'No' : '—'],
                ['Environment', props.environment || '—'],
                ['Codecs', props.codecs || '—'],
                ['IP Rating', props.ip_rating || '—'],
                ['Low Light', props.super_low_light === true ? 'Yes' : props.super_low_light === false ? 'No' : '—'],
              ] as [string, string][]).filter(([, v]) => v !== '—').map(([k, v]) => (
                <div key={k} style={{ fontSize: 10 }}>
                  <span style={{ color: C.textDim }}>{k}: </span>
                  <span style={{ color: C.text, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* H-FOV / V-FOV computed */}
            {sensorW > 0 && focalLength > 0 && (
              <div style={{ marginTop: 12, padding: '8px 10px', background: C.bgActive, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <StatRow label="H-FOV" value={hFov.toFixed(1)} unit="°" />
                <StatRow label="V-FOV" value={(hFov * 0.75).toFixed(1)} unit="°" />
              </div>
            )}
          </div>
        )}

        {/* ═══ License Tab ═══ */}
        {activeTab === 'license' && (
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 12 }}>License & Analytics</div>
            <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 11 }}>
              License and analytics configuration coming soon.
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
