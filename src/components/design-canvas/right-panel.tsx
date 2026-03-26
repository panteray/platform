'use client'
/**
 * RightPanel — Device properties panel (Hanwha DesignPro style).
 *
 * Layout matches Hanwha exactly:
 *   Camera image + model name
 *   Focal length: slider + input
 *   Target distance: slider + input
 *   Installation height: slider + input
 *   Tilt angle: slider + input
 *   Camera rotation: slider + input
 *   FOV angle: slider + input
 *   Notes
 *   Actions (Duplicate / Delete)
 */

import React, { useState, useCallback, useMemo } from 'react'
import { X, Copy, Trash2, Cable, ChevronDown, ChevronRight, AlertTriangle, Eye, EyeOff, Crosshair, Lock, Unlock } from 'lucide-react'
import { C } from './constants'
import { calculatePpfAtDistance, classifyDori } from '@/lib/calculators'
import { BlindSpotDiagram } from './blind-spot-diagram'
import type { DesignDevice, DesignMdfIdf } from '@/types/database'

/* ─── 48 Color Palette ─── */
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

/* ─── Read-only Stat Row ─── */
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

/* ─── Axis-style real-time DORI feedback ─── */
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
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Quality at Target</span>
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
              transition: 'all 0.15s',
            }}>
              {tier.label}
              {hasSensor && (
                <div style={{ fontSize: 7, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>
                  {tier.threshold}+
                </div>
              )}
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

  // Compute hFov and blind spot for diagram
  const sensorW = Number(props.sensor_w) || Number(props.sensor_width) || 0
  const hFov = sensorW > 0 && focalLength > 0
    ? 2 * Math.atan(sensorW / (2 * focalLength)) * (180 / Math.PI)
    : fovAngle
  const vFovHalf = (hFov * 0.75 / 2) * Math.PI / 180
  const tiltRad = tiltAngle * Math.PI / 180
  const lowerAngle = tiltRad + vFovHalf
  const blindSpotFt = lowerAngle < Math.PI / 2 ? installHeight * Math.tan(Math.PI / 2 - lowerAngle) : 0

  // Compute nearest MDF distance for cable auto-populate
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
      {/* ── Header (IPVM-style) ── */}
      <div style={{
        padding: '14px 16px 10px', borderBottom: `1px solid ${C.border}`,
      }}>
        {/* Top row: name + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: C.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {device.label || 'Device'}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 3,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                background: `${C.accent}20`, color: C.accent, letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>
                {device.category.replace(/_/g, ' ')}
              </span>
              {props.resolution_w ? (
                <span style={{ fontSize: 10, color: C.textDim }}>
                  {String(props.resolution_w)}×{String(props.resolution_h || '?')}
                </span>
              ) : null}
            </div>
          </div>
          {/* Action icons */}
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => onDuplicate(device.id)} title="Duplicate"
              style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4, borderRadius: 4 }}>
              <Copy size={14} />
            </button>
            <button onClick={() => onDelete(device.id)} title="Delete"
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, borderRadius: 4 }}>
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} title="Close"
              style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4, borderRadius: 4 }}>
              <X size={14} />
            </button>
          </div>
        </div>
        {/* Model selector link (IPVM-style) */}
        {isCamera && (
          <button onClick={() => onChangeModel?.(device.id)}
            style={{
              marginTop: 8, width: '100%', padding: '6px 10px', fontSize: 10,
              color: C.accent, background: `${C.accent}08`, border: `1px dashed ${C.accent}40`,
              borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              textAlign: 'left',
            }}>
            {String(props.model_name || 'Select Model →')}
          </button>
        )}
      </div>

      {/* ── Properties ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Label */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Label</div>
          <input value={device.label || ''} placeholder="Device label"
            onChange={e => onUpdateDevice(device.id, { label: e.target.value })}
            style={{
              width: '100%', padding: '6px 10px', background: C.bgActive,
              border: `1px solid ${C.border}`, borderRadius: 4,
              color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none',
            }} />
        </div>

        {/* Device Status */}
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Status</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {['New', 'Existing Keep', 'Existing Remove', 'Relocate'].map(s => {
              const active = (props.status || 'New') === s
              return (
                <button key={s} onClick={() => updateProp('status', s)}
                  style={{
                    padding: '4px 8px', fontSize: 9, fontWeight: 600,
                    borderRadius: 3, border: `1px solid ${active ? C.accent : C.border}`,
                    background: active ? `${C.accent}20` : 'transparent',
                    color: active ? C.accent : C.textMuted, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>{s}</button>
              )
            })}
          </div>
          {/* Condition — only for existing devices */}
          {String(props.status || '').includes('Existing') && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Condition</div>
              <div style={{ display: 'flex', gap: 3 }}>
                {['Good', 'Fair', 'Poor', 'Unknown'].map(c => {
                  const condColors: Record<string, string> = { Good: '#22c55e', Fair: '#eab308', Poor: '#ef4444', Unknown: '#6b7280' }
                  const active = (props.condition || 'Unknown') === c
                  return (
                    <button key={c} onClick={() => updateProp('condition', c)}
                      style={{
                        flex: 1, padding: '3px 0', fontSize: 8, fontWeight: 600,
                        borderRadius: 3, border: `1px solid ${active ? condColors[c] : C.border}`,
                        background: active ? `${condColors[c]}20` : 'transparent',
                        color: active ? condColors[c] : C.textMuted, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}>{c}</button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        {/* ── Color Picker ── */}
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Color</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {COLOR_PALETTE.map(c => (
              <button key={c} onClick={() => onUpdateDevice(device.id, { color_hex: c })}
                style={{
                  width: 16, height: 16, borderRadius: 3, background: c, border: 'none', cursor: 'pointer',
                  outline: (device as unknown as Record<string, unknown>).color_hex === c ? '2px solid #fff' : 'none',
                  outlineOffset: 1,
                }} />
            ))}
          </div>
        </div>

        {/* ── Multi-Sensor Lock + Head Controls (IPVM-style) ── */}
        {(device.category === 'multisensor_quad' || device.category === 'multisensor_dual') && (
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
            {/* Lock Camera toggle — IPVM: locks position so only imagers rotate */}
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
              <button
                onClick={() => updateProp('locked', !props.locked)}
                style={{
                  padding: '2px 8px', fontSize: 9, fontWeight: 600,
                  background: props.locked ? '#22c55e20' : 'transparent',
                  border: `1px solid ${props.locked ? '#22c55e' : C.border}`,
                  borderRadius: 3, color: props.locked ? '#22c55e' : C.textMuted,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {props.locked ? 'Unlock' : 'Lock'}
              </button>
            </div>
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
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: sensorColors[i], display: 'inline-block',
                            }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: sensorColors[i] }}>
                              S{i + 1}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <input
                              type="number"
                              value={Math.round(normalizedAngle)}
                              min={0} max={360} step={1}
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
                              }}
                            />
                            <span style={{ fontSize: 9, color: C.textDim }}>°</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          value={normalizedAngle}
                          min={0} max={360} step={1}
                          onChange={e => {
                            const newAngles = [...angles]
                            newAngles[i] = Number(e.target.value)
                            updateProp('sensor_angles', newAngles)
                          }}
                          style={{ width: '100%', accentColor: sensorColors[i], height: 12 }}
                        />
                      </div>
                    )
                  })}
                  {/* Reset to default arrangement */}
                  <button
                    onClick={() => updateProp('sensor_angles', defaultAngles)}
                    style={{
                      padding: '4px 0', fontSize: 9, fontWeight: 600,
                      background: 'transparent', border: `1px solid ${C.border}`,
                      borderRadius: 3, color: C.textMuted, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Reset to Default Layout
                  </button>
                </div>
              )
            })()}
          </div>
        )}

        {/* Camera-specific sections */}
        {isCamera && (
          <>
            {/* ── Mount Type + Height ── */}
            <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Mount Type</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {MOUNT_TYPES.map(mt => {
                  const active = (props.mount_type || 'Ceiling') === mt
                  return (
                    <button key={mt} onClick={() => updateProp('mount_type', mt)}
                      style={{
                        flex: 1, padding: '5px 0', fontSize: 9, fontWeight: 600,
                        borderRadius: 4, border: `1px solid ${active ? C.accent : C.border}`,
                        background: active ? `${C.accent}20` : 'transparent',
                        color: active ? C.accent : C.textMuted, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}>
                      {mt}
                    </button>
                  )
                })}
              </div>
              {/* Mount Height (read-only from canvas) */}
              <div style={{
                marginTop: 8, padding: '6px 10px', background: C.bgActive,
                borderRadius: 4, border: `1px solid ${C.border}`,
              }}>
                <StatRow label="Mount Height" value={installHeight} unit="ft" />
                {/* Mount Calculator Output */}
                {installHeight > 12 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4, marginTop: 4,
                    padding: '4px 8px', borderRadius: 4,
                    background: '#f59e0b15', border: '1px solid #f59e0b30',
                  }}>
                    <AlertTriangle size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b' }}>LIFT REQUIRED — {installHeight}ft</span>
                  </div>
                )}
                {installHeight <= 12 && (
                  <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, marginTop: 2 }}>✓ Standard ladder access</div>
                )}
              </div>
            </div>

            {/* ── Multi-Sensor Imager Navigation (IPVM-style) ── */}
            {(device.category === 'multisensor_quad' || device.category === 'multisensor_dual') && (() => {
              const imagerCount = device.category === 'multisensor_quad' ? 4 : 2
              const perImagerProps = (props.per_imager_props as Array<{ distance?: number; hfov?: number; color?: string }>) || []

              if (selectedImagerIdx !== null && selectedImagerIdx !== undefined) {
                // Per-imager detail view
                const ip = perImagerProps[selectedImagerIdx] || {}
                const imagerDist = ip.distance || targetDist
                const imagerHfov = ip.hfov || fovAngle
                const sensorDefaultColors = ['#3b82f6', '#22c55e', '#f97316', '#a855f7']
                const imagerColor = ip.color || sensorDefaultColors[selectedImagerIdx % sensorDefaultColors.length]

                const updateImagerProp = (key: string, value: unknown) => {
                  const arr = [...(perImagerProps.length >= imagerCount ? perImagerProps : Array.from({ length: imagerCount }, (_, i) => perImagerProps[i] || {}))]
                  arr[selectedImagerIdx] = { ...arr[selectedImagerIdx], [key]: value }
                  updateProp('per_imager_props', arr)
                }

                return (
                  <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
                    <button
                      onClick={() => onSelectImager?.(null)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: C.accent, fontSize: 10, fontWeight: 600,
                        padding: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      ◄ Multi-Imager
                    </button>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                      Imager {selectedImagerIdx + 1}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: C.textMuted }}>Target Distance</span>
                        <input type="number" value={imagerDist} min={1} max={500}
                          onChange={e => updateImagerProp('distance', Number(e.target.value))}
                          style={{ width: 60, padding: '2px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: C.textMuted }}>FOV Angle</span>
                        <input type="number" value={imagerHfov} min={5} max={360}
                          onChange={e => updateImagerProp('hfov', Number(e.target.value))}
                          style={{ width: 60, padding: '2px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, textAlign: 'right' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: C.textMuted }}>Color</span>
                        <input type="color" value={imagerColor}
                          onChange={e => updateImagerProp('color', e.target.value)}
                          style={{ width: 28, height: 20, padding: 0, border: `1px solid ${C.border}`, borderRadius: 3, cursor: 'pointer' }}
                        />
                      </div>
                    </div>
                  </div>
                )
              }

              // Imager list view
              return (
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Imagers</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {Array.from({ length: imagerCount }, (_, i) => {
                      const ip = perImagerProps[i] || {}
                      const dist = ip.distance || targetDist
                      const sensorDefaultColors = ['#3b82f6', '#22c55e', '#f97316', '#a855f7']
                      const color = ip.color || sensorDefaultColors[i % sensorDefaultColors.length]
                      return (
                        <button key={i}
                          onClick={() => onSelectImager?.(i)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '6px 8px', background: C.bgHover, border: `1px solid ${C.border}`,
                            borderRadius: 4, cursor: 'pointer', width: '100%',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: C.text }}>Imager {i + 1}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 9, color: C.textDim, fontFamily: 'monospace' }}>{dist}ft</span>
                            <span style={{ fontSize: 10, color: C.accent }}>→</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* ── Canvas Readout (read-only values from canvas state) ── */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Canvas State</div>
              <div style={{
                padding: '6px 10px', background: C.bgActive,
                borderRadius: 4, border: `1px solid ${C.border}`,
              }}>
                <StatRow label="Focal Length" value={focalLength} unit="mm" />
                <StatRow label="Target Distance" value={targetDist} unit="ft" />
                <StatRow label="FOV Angle" value={fovAngle} unit="°" />
                <StatRow label="Tilt Angle" value={tiltAngle} unit="°" />
                <StatRow label="Rotation" value={rotation} unit="°" />
              </div>
            </div>

            {/* DORI at target distance — Axis-style real-time feedback */}
            <DoriFeedback
              resolutionW={Number(props.resolution_w) || 0}
              sensorW={Number(props.sensor_w) || Number(props.sensor_width) || 0}
              focalLength={focalLength}
              targetDist={targetDist}
            />

            {/* ── Simulated View button ── */}
            {Number(props.resolution_w) > 0 && sensorW > 0 && focalLength > 0 && onShowSimulatedView && (
              <div style={{ padding: '6px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
                <button
                  onClick={onShowSimulatedView}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 4, cursor: 'pointer',
                    background: 'none', border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.accent }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border }}
                >
                  <Eye size={12} />
                  Simulated View
                </button>
              </div>
            )}

            {/* ── Advanced Lens / IR ── */}
            <Section title="Advanced Lens / IR">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* IR Range Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Crosshair size={12} style={{ color: '#ef4444' }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.text }}>IR Range Line</span>
                    {props.ir_range ? (
                      <span style={{ fontSize: 9, color: C.textDim, fontFamily: 'monospace' }}>
                        {String(props.ir_range)}ft
                      </span>
                    ) : null}
                  </div>
                  <button
                    onClick={() => onToggleIrRange?.(!showIrRange)}
                    style={{
                      width: 36, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
                      background: showIrRange ? '#ef4444' : C.bgActive,
                      position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2,
                      left: showIrRange ? 20 : 2,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  </button>
                </div>

                {/* PPF Zone Visibility */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.text, marginBottom: 4 }}>PPF Zones</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {[
                      { zone: 'inspection', label: 'Inspection', color: '#8b5cf6', ppf: '305+ PPF' },
                      { zone: 'identification', label: 'Identification', color: '#22c55e', ppf: '76–304 PPF' },
                      { zone: 'recognition', label: 'Recognition / LPR', color: '#eab308', ppf: '38–75 PPF' },
                      { zone: 'observation', label: 'Observation', color: '#f97316', ppf: '19–37 PPF' },
                      { zone: 'detection', label: 'Detection', color: '#ef4444', ppf: '8–18 PPF' },
                      { zone: 'monitor', label: 'Monitor', color: '#6b7280', ppf: '4–7 PPF' },
                    ].map(z => {
                      const hidden = hiddenPpfZones?.has(z.zone) ?? false
                      return (
                        <button
                          key={z.zone}
                          onClick={() => onTogglePpfZone?.(z.zone)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                            background: hidden ? 'transparent' : `${z.color}10`,
                            border: `1px solid ${hidden ? C.border : z.color + '30'}`,
                            borderRadius: 4, cursor: 'pointer', width: '100%',
                            fontFamily: 'inherit',
                          }}
                        >
                          {hidden ? <EyeOff size={10} style={{ color: C.textDim }} /> : <Eye size={10} style={{ color: z.color }} />}
                          <div style={{
                            width: 8, height: 8, borderRadius: 2,
                            background: hidden ? C.bgActive : z.color,
                            opacity: hidden ? 0.5 : 1,
                          }} />
                          <span style={{ fontSize: 9, fontWeight: 600, color: hidden ? C.textDim : z.color, flex: 1, textAlign: 'left' }}>
                            {z.label}
                          </span>
                          <span style={{ fontSize: 8, color: C.textDim, fontFamily: 'monospace' }}>{z.ppf}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Blind Spot Analysis ── */}
            <Section title="Blind Spot Analysis">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <BlindSpotDiagram
                  installHeight={Number(props.install_height) || 9}
                  tiltAngle={Number(props.tilt_angle) || 0}
                  blindSpotFt={blindSpotFt}
                  targetDistFt={targetDist}
                  vFov={hFov * 0.75}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <StatRow label="Blind Spot" value={blindSpotFt > 0 ? `${Math.round(blindSpotFt * 10) / 10}` : '0'} unit="ft" color="#f97316" />
                  <button
                    onClick={() => onToggleBlindSpot?.(!showBlindSpot)}
                    style={{
                      width: 36, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
                      background: showBlindSpot ? '#f97316' : C.bgActive,
                      position: 'relative', transition: 'background 0.15s',
                    }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2,
                      left: showBlindSpot ? 20 : 2, transition: 'left 0.15s',
                    }} />
                  </button>
                </div>
              </div>
            </Section>

            {/* ── Device Specs (read-only, always open) ── */}
            <Section title="Device Specs" defaultOpen>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {[
                  ['Vendor', props.vendor || '—'],
                  ['Model', props.model || '—'],
                  ['Part #', props.partnumber || '—'],
                  ['Max Res', props.resolution_w ? `${props.resolution_w}×${props.resolution_h}` : (props.resolution ? String(props.resolution) : '—')],
                  ['FPS', props.fps ? `${props.fps}fps` : '—'],
                  ['PoE', props.poe_standard || '—'],
                  ['Power', props.wattage ? `${props.wattage}W` : (props.max_power ? `${props.max_power}W` : '—')],
                  ['NDAA', props.ndaa_compliant === true ? '✓ Yes' : props.ndaa_compliant === false ? '✗ No' : '—'],
                  ['Sensor', props.sensor_size ? `${props.sensor_size}"` : '—'],
                  ['IR Range', props.ir_range ? `${props.ir_range}ft` : '—'],
                  ['IP Rating', props.ip_rating || '—'],
                ].map(([k, v]) => (
                  <div key={k as string} style={{ fontSize: 10 }}>
                    <span style={{ color: C.textDim }}>{k as string}: </span>
                    <span style={{ color: C.text, fontWeight: 600, fontFamily: 'monospace' }}>{v as string}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Wiring ── */}
            <Section title="Wiring">
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
                {onDisconnectCable && (
                  <button
                    onClick={() => onDisconnectCable(device.id)}
                    style={{
                      marginTop: 6, padding: '4px 8px', fontSize: 10,
                      background: 'transparent', border: '1px solid #ef4444',
                      borderRadius: 3, color: '#ef4444', cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: 500,
                    }}
                  >Disconnect</button>
                )}
              </div>
            </Section>

            {/* ── Recording / Programming ── */}
            <Section title="Recording">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Codec */}
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
                            color: active ? C.accent : C.textMuted, cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}>{c}</button>
                      )
                    })}
                  </div>
                </div>
                {/* Recording Mode */}
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
                            color: active ? C.accent : C.textMuted, cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}>{m}</button>
                      )
                    })}
                  </div>
                </div>
                {/* FPS + Retention */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>FPS</div>
                    <input type="number" value={Number(props.recording_fps) || 15}
                      onChange={e => updateProp('recording_fps', Number(e.target.value))}
                      style={{
                        width: '100%', padding: '4px 8px', background: C.bgActive,
                        border: `1px solid ${C.border}`, borderRadius: 3,
                        color: C.text, fontSize: 10, fontFamily: 'monospace', outline: 'none',
                      }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Retention (days)</div>
                    <input type="number" value={Number(props.retention_days) || 30}
                      onChange={e => updateProp('retention_days', Number(e.target.value))}
                      style={{
                        width: '100%', padding: '4px 8px', background: C.bgActive,
                        border: `1px solid ${C.border}`, borderRadius: 3,
                        color: C.text, fontSize: 10, fontFamily: 'monospace', outline: 'none',
                      }} />
                  </div>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ── Access Control Panel ── */}
        {['access_control', 'door', 'door_controller', 'card_reader', 'electric_strike', 'maglock'].includes(device.category) && (
          <>
            <Section title="Door Configuration" defaultOpen>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Door Type */}
                <div>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Door Type</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {['Standard', 'ADA Auto-Operator', 'Mantrap', 'Mantrap + ADA'].map(t => {
                      const active = (props.door_type || 'Standard') === t
                      return (
                        <button key={t} onClick={() => updateProp('door_type', t)}
                          style={{
                            padding: '3px 6px', fontSize: 8, fontWeight: 600,
                            borderRadius: 3, border: `1px solid ${active ? C.accent : C.border}`,
                            background: active ? `${C.accent}20` : 'transparent',
                            color: active ? C.accent : C.textMuted, cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}>{t}</button>
                      )
                    })}
                  </div>
                </div>
                {/* Lock Type */}
                <div>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Lock Type</div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['Electric Strike', 'Magnetic Lock', 'Electrified Hardware'].map(t => {
                      const active = (props.lock_type || 'Electric Strike') === t
                      return (
                        <button key={t} onClick={() => updateProp('lock_type', t)}
                          style={{
                            flex: 1, padding: '3px 0', fontSize: 8, fontWeight: 600,
                            borderRadius: 3, border: `1px solid ${active ? C.accent : C.border}`,
                            background: active ? `${C.accent}20` : 'transparent',
                            color: active ? C.accent : C.textMuted, cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}>{t}</button>
                      )
                    })}
                  </div>
                </div>
                {/* Reader In / Reader Out */}
                {[
                  { key: 'reader_in_type', label: 'Reader In' },
                  { key: 'reader_out_type', label: 'Reader Out' },
                ].map(r => (
                  <div key={r.key}>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>{r.label}</div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {(r.key === 'reader_out_type' ? ['None'] : []).concat(['Proximity', 'Smart Card', 'Biometric', 'Keypad', 'Mobile']).map(t => {
                        const active = (props[r.key] || (r.key === 'reader_out_type' ? 'None' : 'Proximity')) === t
                        return (
                          <button key={t} onClick={() => updateProp(r.key, t)}
                            style={{
                              padding: '3px 6px', fontSize: 8, fontWeight: 600,
                              borderRadius: 3, border: `1px solid ${active ? C.accent : C.border}`,
                              background: active ? `${C.accent}20` : 'transparent',
                              color: active ? C.accent : C.textMuted, cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}>{t}</button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {/* Boolean toggles: REX, Door Contact, Auto-Operator */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { key: 'rex', label: 'REX' },
                    { key: 'door_contact', label: 'Door Contact' },
                    { key: 'auto_operator', label: 'Auto-Operator' },
                  ].map(toggle => {
                    const on = props[toggle.key] === true
                    return (
                      <button key={toggle.key} onClick={() => updateProp(toggle.key, !on)}
                        style={{
                          flex: 1, padding: '4px 0', fontSize: 8, fontWeight: 600,
                          borderRadius: 3, border: `1px solid ${on ? '#22c55e' : C.border}`,
                          background: on ? '#22c55e20' : 'transparent',
                          color: on ? '#22c55e' : C.textMuted, cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}>{toggle.label}: {on ? 'Yes' : 'No'}</button>
                    )
                  })}
                </div>
              </div>
            </Section>

            {/* Wiring for access control */}
            <Section title="Wiring">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { key: 'cable_type', label: 'Cable Type', ph: 'Cat6, 22/4…' },
                  { key: 'controller_assignment', label: 'Controller', ph: 'CTRL-001' },
                  { key: 'cable_length', label: 'Cable Length (ft)', ph: '125' },
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
                {onDisconnectCable && (
                  <button
                    onClick={() => onDisconnectCable(device.id)}
                    style={{
                      marginTop: 6, padding: '4px 8px', fontSize: 10,
                      background: 'transparent', border: '1px solid #ef4444',
                      borderRadius: 3, color: '#ef4444', cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: 500,
                    }}
                  >Disconnect</button>
                )}
              </div>
            </Section>
          </>
        )}
        {/* Notes */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Notes</div>
          <textarea
            value={String(props.notes || '')}
            placeholder="Add notes..."
            onChange={e => updateProp('notes', e.target.value)}
            style={{
              width: '100%', minHeight: 60, padding: '6px 10px', background: C.bgActive,
              border: `1px solid ${C.border}`, borderRadius: 4,
              color: C.text, fontSize: 11, fontFamily: 'inherit',
              resize: 'vertical', outline: 'none',
            }}
          />
        </div>

        {/* Position + Auto Cable Distance */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Position</div>
           <div style={{ display: 'flex', gap: 8, fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>
            <span>X: {device.position_x}</span>
            <span>Y: {device.position_y}</span>
          </div>

          {/* Auto cable distance to nearest MDF/IDF */}
          {mdfIdfs && mdfIdfs.length > 0 && (() => {
            let nearest = Infinity
            let nearestName = ''
            for (const node of mdfIdfs) {
              const dx = device.position_x - node.position_x
              const dy = device.position_y - node.position_y
              const distPx = Math.sqrt(dx * dx + dy * dy)
              const distFt = distPx / (scalePxPerFt || 10)
              if (distFt < nearest) { nearest = distFt; nearestName = node.name || 'MDF/IDF' }
            }
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 8px', background: C.bgActive, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <Cable size={12} style={{ color: C.accent, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.textDim }}>Est. cable to {nearestName}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>
                    {Math.round(nearest)} ft
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
