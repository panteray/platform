'use client'
/**
 * RightPanel — Device properties panel.
 *
 * Tabs: FoV | Acc | Profile | Rec
 * FoV: merged FoV + Lens — quick controls, DORI, device specs, notes
 * Acc: mount type, environment, license fields
 * Profile: opens DeviceProfilePanel sidebar
 * Rec: recording profile — scene type, camera profile (FPS 1-60, smart codec), lighting, duration, schedule
 *
 * 24-color palette. Only visible when a device is selected on canvas.
 */

import React, { useState, useCallback, useMemo } from 'react'
import { X, Copy, Trash2, ChevronDown, ChevronRight, Settings, MapPinOff, Cctv, Server, Plus } from 'lucide-react'
import { C } from './constants'
import { calculatePpfAtDistance, classifyDori } from '@/lib/calculators'
import { calculateMountRequirements, type MountCalcInput } from '@/lib/calculators/mount-calculator'
import type { DesignDevice, DesignMdfIdf } from '@/types/database'

/* ─── 24 Colors ─── */
const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777',
  '#991b1b', '#9a3412', '#713f12', '#065f46', '#164e63', '#1e3a5f', '#4c1d95', '#831843',
]

/* ─── Mount Types ─── */
const MOUNT_TYPES = ['Ceiling', 'Wall', 'Pole', 'Pendant'] as const

/* ─── Props ─── */
interface Props {
  device: DesignDevice
  onClose: () => void
  onUpdateDevice: (id: string, updates: Record<string, unknown>) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onRemoveFromMap?: (id: string) => void
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
  onConnectToMdf?: (deviceId: string) => void
  cables?: Array<{ id: string; from_device_id?: string | null; to_device_id?: string | null; mdf_idf_id?: string | null; cable_type?: string; length_ft?: number; total_length_ft?: number }>
  selectedImagerIdx?: number | null
  onSelectImager?: (idx: number | null) => void
  onShowSimulatedView?: () => void
  onOpenFovPanel?: () => void
  onOpenDeviceProfile?: () => void
}

type TabId = 'fov' | 'acc' | 'settings' | 'rec'

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
              boxShadow: isActive ? `0 0 8px ${tier.color}40` : 'none',
              transform: isActive ? 'scale(1.04)' : 'none',
              transition: 'all 0.2s',
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

/* ─── Section (collapsible) ─── */
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

/* ─── Button Toggle Group ─── */
function BtnGroup({ options, value, onChange }: {
  options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {options.map(opt => {
        const active = value === opt
        return (
          <button key={opt} onClick={() => onChange(opt)}
            style={{
              flex: 1, padding: '5px 0', fontSize: 9, fontWeight: 600,
              borderRadius: 4, border: `1px solid ${active ? C.accent : C.border}`,
              background: active ? C.accentSubtle : 'transparent',
              color: active ? C.accent : C.textMuted, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: active ? `0 0 8px ${C.accent}20` : 'none',
            }}>{opt}</button>
        )
      })}
    </div>
  )
}

/* ─── Component ─── */
export function RightPanel({
  device, onClose, onUpdateDevice, onDuplicate, onDelete, onRemoveFromMap, scalePxPerFt, mdfIdfs,
  onChangeModel,
  showIrRange = true, onToggleIrRange, hiddenPpfZones, onTogglePpfZone,
  showBlindSpot = false, onToggleBlindSpot,
  onDisconnectCable, onConnectToMdf, cables,
  selectedImagerIdx, onSelectImager,
  onShowSimulatedView,
  onOpenFovPanel, onOpenDeviceProfile,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('fov')
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
  const sensorW = Number(props.sensor_w) || Number(props.sensor_width) || 5.14 // default 1/2.8" (IEC 62676-4 standard)
  const hFov = sensorW > 0 && focalLength > 0
    ? 2 * Math.atan(sensorW / (2 * focalLength)) * (180 / Math.PI)
    : fovAngle

  const handleTabSwitch = (tab: TabId) => {
    setActiveTab(tab)
  }

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
          <button onClick={() => onOpenDeviceProfile?.()} title="Open Device Profile"
            style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 4, borderRadius: 4, marginRight: 'auto' }}>
            <Settings size={14} />
          </button>
          <button onClick={() => onDuplicate(device.id)} title="Duplicate"
            style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4, borderRadius: 4 }}>
            <Copy size={14} />
          </button>
          {onRemoveFromMap && (
            <button onClick={() => onRemoveFromMap(device.id)} title="Remove from map (return to pool)"
              style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', padding: 4, borderRadius: 4 }}>
              <MapPinOff size={14} />
            </button>
          )}
          <button onClick={() => onDelete(device.id)} title="Delete permanently"
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, borderRadius: 4, opacity: 0.5 }}>
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
            background: C.accentSubtle, color: C.accent, letterSpacing: 0.5, textTransform: 'uppercase',
          }}>
            {device.category.replace(/_/g, ' ')}
          </span>
          <span style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>
            {props.vendor ? `${props.vendor} ${props.model || ''}` : 'No model selected'}
          </span>
        </div>

        {/* Change Model */}
        {isCamera && (
          <button onClick={() => onChangeModel?.(device.id)}
            style={{
              marginTop: 6, width: '100%', padding: '5px 10px', fontSize: 10,
              color: C.textDim, background: 'transparent',
              border: `1px dashed ${C.border}`, borderRadius: 4,
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, textAlign: 'left',
            }}>
            Change Model →
          </button>
        )}

        {/* 24-color palette */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 8 }}>
          {COLOR_PALETTE.map(c => (
            <button key={c} onClick={() => onUpdateDevice(device.id, { color_hex: c })}
              style={{
                width: 14, height: 14, borderRadius: 2, background: c, border: 'none', cursor: 'pointer',
                outline: (device as unknown as Record<string, unknown>).color_hex === c ? '2px solid #fff' : 'none',
                outlineOffset: 1, transition: 'transform 0.15s',
              }} />
          ))}
        </div>

        {/* Device status + condition */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 8, color: C.textDim, marginBottom: 2 }}>Status</div>
            <select value={String(props.device_status || 'new')}
              onChange={e => updateProp('device_status', e.target.value)}
              style={{ width: '100%', padding: '3px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 9, fontFamily: 'inherit', outline: 'none' }}>
              <option value="new">New</option>
              <option value="existing_keep">Existing Keep</option>
              <option value="existing_remove">Existing Remove</option>
              <option value="relocate">Relocate</option>
            </select>
          </div>
          {(props.device_status === 'existing_keep' || props.device_status === 'existing_remove' || props.device_status === 'relocate') && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: C.textDim, marginBottom: 2 }}>Condition</div>
              <select value={String(props.device_condition || 'unknown')}
                onChange={e => updateProp('device_condition', e.target.value)}
                style={{ width: '100%', padding: '3px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 9, fontFamily: 'inherit', outline: 'none' }}>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Bar: FoV | Acc | Settings | Rec ── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bgSurface }}>
        {(['fov', 'acc', 'settings', 'rec'] as const).map(tab => {
          const active = activeTab === tab
          const label = tab === 'fov' ? 'FoV' : tab === 'acc' ? 'Acc' : tab === 'settings' ? 'Settings' : 'Rec'
          return (
            <button key={tab} onClick={() => handleTabSwitch(tab)}
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

        {/* ═══ FoV Tab (merged FoV + Lens) ═══ */}
        {activeTab === 'fov' && isCamera && (
          <>
            {/* Open FoV Panel button */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <button onClick={() => onOpenFovPanel?.()} style={{
                width: '100%', padding: '10px 14px', fontSize: 12, fontWeight: 700,
                color: C.accent, background: C.accentSubtle,
                border: `1px solid ${C.accent}40`, borderRadius: 6,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
              }}>Open FoV Panel →</button>
            </div>

            {/* Quick controls */}
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
                            background: active ? C.accentSubtle : 'transparent',
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
              sensorW={sensorW}
              focalLength={focalLength}
              targetDist={targetDist}
            />

            {/* Device Specs (merged from Lens tab) */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>Device Specs</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {([
                  ['Vendor', props.vendor || '—'],
                  ['Model', props.model || '—'],
                  ['Part #', props.partnumber || '—'],
                  ['Form', props.form || '—'],
                  ['Max Res', props.resolution_w ? `${props.resolution_w}x${props.resolution_h}` : (props.resolution ? String(props.resolution) : '—')],
                  ['FPS', props.fps ? `${props.fps}fps` : '—'],
                  ['Focal', props.focal_length ? `${props.focal_length}mm` : '—'],
                  ['Lens', props.focal_type || '—'],
                  ['AOV', props.aov || '—'],
                  ['Sensor', props.sensor_w ? `${props.sensor_w}mm` : '—'],
                  ['IR', props.ir || (props.ir_range ? `${props.ir_range}ft` : '—')],
                  ['NDAA', props.ndaa_compliant === true ? 'Yes' : props.ndaa_compliant === false ? 'No' : '—'],
                  ['Env', props.environment || '—'],
                  ['Codecs', props.codecs || '—'],
                ] as [string, string][]).filter(([, v]) => v !== '—').map(([k, v]) => (
                  <div key={k} style={{ fontSize: 10 }}>
                    <span style={{ color: C.textDim }}>{k}: </span>
                    <span style={{ color: C.text, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* H-FOV / V-FOV computed */}
              {sensorW > 0 && focalLength > 0 && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: C.bgActive, borderRadius: 4, border: `1px solid ${C.border}` }}>
                  <StatRow label="H-FOV" value={hFov.toFixed(1)} unit="°" />
                  <StatRow label="V-FOV" value={(hFov * 0.75).toFixed(1)} unit="°" />
                </div>
              )}
            </div>

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

        {/* FoV tab for non-camera */}
        {activeTab === 'fov' && !isCamera && (
          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>
              FOV settings are only available for camera devices.
            </div>
          </div>
        )}

        {/* ═══ Cabling to Network Closet (shows on FoV tab for cameras) ═══ */}
        {activeTab === 'fov' && isCamera && (() => {
          const connCable = cables?.find(c => c.from_device_id === device.id || c.to_device_id === device.id)
          const connMdf = connCable?.mdf_idf_id ? (mdfIdfs ?? []).find(m => m.id === connCable.mdf_idf_id) : null
          return (
            <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.text, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Cabling to Network Closet
              </div>
              {connCable ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Connection diagram */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: C.bgActive, borderRadius: 6 }}>
                    <div style={{ width: 20, height: 14, borderRadius: 2, border: `1.5px solid ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Cctv size={8} color={C.accent} />
                    </div>
                    <div style={{ flex: 1, height: 0, borderTop: `2px dashed #f97316` }} />
                    <div style={{ width: 20, height: 14, borderRadius: 2, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Server size={8} color="#fff" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                    <span style={{ color: C.textMuted }}>Length: <strong style={{ color: C.text }}>{Math.round(connCable.length_ft || 0)} ft</strong></span>
                    {connMdf && <span style={{ color: C.accent, fontWeight: 600, fontSize: 9 }}>{connMdf.name} →</span>}
                  </div>
                  {onDisconnectCable && (
                    <button onClick={() => onDisconnectCable(device.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '4px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600,
                        border: `1px solid #ef4444`, background: 'rgba(239,68,68,0.06)',
                        color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      <X size={9} /> Disconnect
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {onConnectToMdf && (mdfIdfs ?? []).length > 0 ? (
                    <button
                      onClick={() => onConnectToMdf(device.id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '6px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                        border: `1px solid ${C.accent}40`, background: `${C.accent}10`,
                        color: C.accent, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <Server size={10} /> Connect to Network Closet
                    </button>
                  ) : (
                    <div style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic' }}>
                      {(mdfIdfs ?? []).length === 0 ? 'No MDF/IDF placed — add one first' : 'Not cabled'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* ═══ Acc Tab ═══ */}
        {activeTab === 'acc' && (
          <div>
            {/* Mount Type */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Mount Type</div>
              <BtnGroup
                options={[...MOUNT_TYPES]}
                value={String(props.mount_type || 'Ceiling')}
                onChange={v => updateProp('mount_type', v)}
              />
              <div style={{ marginTop: 6, padding: '6px 8px', background: C.bgActive, borderRadius: 4, border: `1px solid ${C.border}` }}>
                <StatRow label="Install Height" value={installHeight} unit="ft" />
                {installHeight > 12 ? (
                  <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, marginTop: 2, background: 'rgba(239,68,68,0.08)', padding: '3px 6px', borderRadius: 3, border: '1px solid rgba(239,68,68,0.2)' }}>⚠ LIFT REQUIRED — {installHeight}ft install height</div>
                ) : (
                  <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600, marginTop: 2 }}>✓ Standard ladder access</div>
                )}
              </div>
            </div>

            {/* Environment */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Environment</div>
              <BtnGroup
                options={['Indoor', 'Outdoor']}
                value={String(props.environment || 'Indoor')}
                onChange={v => updateProp('environment', v)}
              />
            </div>

            {/* Mount Calculator — auto-generated + editable */}
            {isCamera && (() => {
              const mountInput: MountCalcInput = {
                formFactor: String(props.form || device.category),
                mountType: (String(props.mount_type || 'Ceiling').toLowerCase() as 'ceiling' | 'wall' | 'pole' | 'pendant'),
                environment: (String(props.environment || 'Indoor').toLowerCase() as 'indoor' | 'outdoor' | 'indoor_outdoor'),
              }
              const mountResult = calculateMountRequirements(mountInput, installHeight)
              const customAccessories = (props.custom_accessories || []) as Array<{ name: string; qty: number }>
              return (
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Mount Accessories</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Auto-calculated mounts */}
                    {mountResult.mounts.filter(m => m.compatible).map((m, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 8px', background: C.bgActive, borderRadius: 4, fontSize: 10,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.required ? C.accent : C.textDim, display: 'inline-block' }} />
                          <span style={{ color: C.text, fontWeight: 500 }}>{m.label}</span>
                        </div>
                        <span style={{ fontSize: 8, color: m.required ? C.accent : C.textDim, fontWeight: 600 }}>
                          {m.required ? 'REQ' : 'OPT'}
                        </span>
                      </div>
                    ))}
                    {mountResult.mounts.filter(m => m.compatible).length === 0 && (
                      <div style={{ fontSize: 9, color: C.textDim, fontStyle: 'italic', padding: 4 }}>No mount accessories for this configuration</div>
                    )}

                    {/* Custom accessories — editable */}
                    {customAccessories.map((a, i) => (
                      <div key={`custom-${i}`} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '4px 8px', background: 'rgba(59,130,246,0.06)', borderRadius: 4, fontSize: 10,
                        border: '1px solid rgba(59,130,246,0.15)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                          <input value={a.name} onChange={e => {
                            const updated = [...customAccessories]
                            updated[i] = { ...a, name: e.target.value }
                            updateProp('custom_accessories', updated)
                          }} style={{ background: 'transparent', border: 'none', color: C.text, fontSize: 10, fontWeight: 500, outline: 'none', width: 120 }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <input type="number" min={1} value={a.qty} onChange={e => {
                            const updated = [...customAccessories]
                            updated[i] = { ...a, qty: Math.max(1, Number(e.target.value)) }
                            updateProp('custom_accessories', updated)
                          }} style={{ width: 28, padding: '1px 3px', background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 2, color: C.text, fontSize: 9, fontFamily: 'monospace', outline: 'none', textAlign: 'center' }} />
                          <button onClick={() => {
                            const updated = customAccessories.filter((_, idx) => idx !== i)
                            updateProp('custom_accessories', updated)
                          }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 1, opacity: 0.5 }}>
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add custom accessory button */}
                    <button onClick={() => {
                      const updated = [...customAccessories, { name: 'Custom Item', qty: 1 }]
                      updateProp('custom_accessories', updated)
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                      background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 4,
                      color: C.textDim, fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <Plus size={10} /> Add Accessory
                    </button>
                  </div>
                  {mountResult.liftRequired && (
                    <div style={{ marginTop: 6, fontSize: 9, color: '#ef4444', fontWeight: 700, background: 'rgba(239,68,68,0.08)', padding: '3px 6px', borderRadius: 3, border: '1px solid rgba(239,68,68,0.2)' }}>
                      ⚠ LIFT REQUIRED — {installHeight}ft
                    </div>
                  )}
                </div>
              )
            })()}

            {/* License */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>License</div>
              <EditableRow label="License Type" value={0} unit="" onChange={() => {}} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 10, color: C.textDim }}>License Type</span>
                <select value={String(props.license_type || 'subscription')}
                  onChange={e => updateProp('license_type', e.target.value)}
                  style={{
                    width: 100, padding: '2px 6px', background: C.bgActive,
                    border: `1px solid ${C.border}`, borderRadius: 3,
                    color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none',
                  }}>
                  <option value="subscription">Subscription</option>
                  <option value="perpetual">Perpetual</option>
                  <option value="included">Included</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 10, color: C.textDim }}>SKU</span>
                <input value={String(props.license_sku || '')} placeholder="LIC-..."
                  onChange={e => updateProp('license_sku', e.target.value)}
                  style={{
                    width: 100, padding: '2px 6px', background: C.bgActive,
                    border: `1px solid ${C.border}`, borderRadius: 3,
                    color: C.text, fontSize: 10, fontFamily: 'monospace', outline: 'none', textAlign: 'right',
                  }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 10, color: C.textDim }}>Term</span>
                <select value={String(props.license_term || '1')}
                  onChange={e => updateProp('license_term', e.target.value)}
                  style={{
                    width: 100, padding: '2px 6px', background: C.bgActive,
                    border: `1px solid ${C.border}`, borderRadius: 3,
                    color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none',
                  }}>
                  <option value="1">1 Year</option>
                  <option value="3">3 Year</option>
                  <option value="5">5 Year</option>
                  <option value="10">10 Year</option>
                </select>
              </div>
              <EditableRow label="Annual Cost" value={Number(props.license_annual_cost) || 0} unit="$" step={1} min={0}
                onChange={v => updateProp('license_annual_cost', v)} />
            </div>

            {/* Access Control config — only for door/ACS devices */}
            {['access_control', 'door', 'door_controller', 'card_reader', 'electric_strike', 'maglock'].includes(device.category) && (
              <Section title="Door Configuration" defaultOpen>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Door Type</div>
                    <BtnGroup
                      options={['Standard', 'ADA Auto-Operator', 'Mantrap', 'Mantrap + ADA']}
                      value={String(props.door_type || 'Standard')}
                      onChange={v => updateProp('door_type', v)}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Lock Type</div>
                    <BtnGroup
                      options={['Electric Strike', 'Magnetic Lock', 'Electrified Hardware']}
                      value={String(props.lock_type || 'Electric Strike')}
                      onChange={v => updateProp('lock_type', v)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Reader In</div>
                      <select value={String(props.reader_in || 'proximity')} onChange={e => updateProp('reader_in', e.target.value)}
                        style={{ width: '100%', padding: '3px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 9, fontFamily: 'inherit', outline: 'none' }}>
                        <option value="proximity">Proximity</option><option value="smart_card">Smart Card</option>
                        <option value="biometric">Biometric</option><option value="keypad">Keypad</option>
                        <option value="mobile">Mobile Credential</option>
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Reader Out</div>
                      <select value={String(props.reader_out || 'none')} onChange={e => updateProp('reader_out', e.target.value)}
                        style={{ width: '100%', padding: '3px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 9, fontFamily: 'inherit', outline: 'none' }}>
                        <option value="none">None</option><option value="proximity">Proximity</option><option value="smart_card">Smart Card</option>
                        <option value="biometric">Biometric</option><option value="keypad">Keypad</option>
                        <option value="mobile">Mobile Credential</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.textMuted }}>
                      <input type="checkbox" checked={!!props.rex} onChange={e => updateProp('rex', e.target.checked)} style={{ accentColor: C.accent }} /> REX
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.textMuted }}>
                      <input type="checkbox" checked={!!props.door_contact} onChange={e => updateProp('door_contact', e.target.checked)} style={{ accentColor: C.accent }} /> Door Contact
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.textMuted }}>
                      <input type="checkbox" checked={!!props.auto_operator} onChange={e => updateProp('auto_operator', e.target.checked)} style={{ accentColor: C.accent }} /> Auto-Operator
                    </label>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 3 }}>Controller Assignment</div>
                    <input value={String(props.controller_id || '')} placeholder="Controller device ID"
                      onChange={e => updateProp('controller_id', e.target.value)}
                      style={{ width: '100%', padding: '3px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 9, fontFamily: 'monospace', outline: 'none' }} />
                  </div>
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ═══ Profile Tab ═══ */}
        {activeTab === 'settings' && (
          <div>
            {/* IP Settings */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>IP Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>IP Address</div>
                  <input type="text" value={String(props.ip_address || '')} placeholder="192.168.1.100"
                    onChange={e => updateProp('ip_address', e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', monospace", outline: 'none' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Subnet Mask</div>
                    <input type="text" value={String(props.subnet_mask || '')} placeholder="255.255.255.0"
                      onChange={e => updateProp('subnet_mask', e.target.value)}
                      style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', monospace", outline: 'none' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Gateway</div>
                    <input type="text" value={String(props.gateway || '')} placeholder="192.168.1.1"
                      onChange={e => updateProp('gateway', e.target.value)}
                      style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', monospace", outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>HTTP Port</div>
                    <input type="number" value={String(props.http_port || '')} placeholder="80"
                      onChange={e => updateProp('http_port', Number(e.target.value) || null)}
                      style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', monospace", outline: 'none' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>RTSP Port</div>
                    <input type="number" value={String(props.rtsp_port || '')} placeholder="554"
                      onChange={e => updateProp('rtsp_port', Number(e.target.value) || null)}
                      style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', monospace", outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>MAC Address</div>
                  <input type="text" value={String(props.mac_address || '')} placeholder="00:1A:2B:3C:4D:5E"
                    onChange={e => updateProp('mac_address', e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', monospace", outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Username</div>
                  <input type="text" value={String(props.device_username || '')} placeholder="admin"
                    onChange={e => updateProp('device_username', e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, outline: 'none' }} />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Password</div>
                  <input type="password" value={String(props.device_password || '')} placeholder="••••••••"
                    onChange={e => updateProp('device_password', e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, outline: 'none' }} />
                </div>
              </div>
            </div>

            {/* PoE Settings */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>PoE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Standard</div>
                  <select value={String(props.poe_standard || 'at')}
                    onChange={e => updateProp('poe_standard', e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}>
                    <option value="af">802.3af (15.4W)</option>
                    <option value="at">802.3at (30W)</option>
                    <option value="bt">802.3bt (60W+)</option>
                    <option value="none">Non-PoE</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Max Watts</div>
                  <input type="number" value={Number(props.poe_watts) || (props.poe_standard === 'af' ? 13 : props.poe_standard === 'bt' ? 60 : 25)}
                    onChange={e => updateProp('poe_watts', Number(e.target.value))}
                    placeholder="25"
                    style={{ width: '100%', padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text, fontSize: 11, fontFamily: "'SF Mono', 'Cascadia Code', monospace", outline: 'none' }} />
                </div>
              </div>
              {Number(props.wattage) > 0 && (
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 4 }}>
                  Device spec: {String(props.wattage)}W
                </div>
              )}
            </div>

            {/* Device Profile link */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <button onClick={() => onOpenDeviceProfile?.()} style={{
                width: '100%', padding: '8px 14px', fontSize: 11, fontWeight: 600,
                color: C.accent, background: C.accentSubtle,
                border: `1px solid ${C.accent}40`, borderRadius: 4,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
              }}>Open Device Profile →</button>
              <div style={{ marginTop: 8, fontSize: 9, color: C.textDim, lineHeight: 1.6, textAlign: 'center' }}>
                Device Profile · Installation · Configuration<br />
                Maintenance · Activity Log · Accessories · Notes
              </div>
            </div>
          </div>
        )}

        {/* ═══ Rec Tab — Recording Profile ═══ */}
        {activeTab === 'rec' && (
          <div>
            {/* Scene Type */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Scene Type</div>
              <BtnGroup
                options={['Indoor', 'Outdoor']}
                value={String(props.scene_type || 'Indoor')}
                onChange={v => updateProp('scene_type', v)}
              />
            </div>

            {/* Recording Resolution — filtered by camera's max */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Recording Resolution</div>
              {(() => {
                const maxW = Number(props.resolution_w) || 1920
                const maxH = Number(props.resolution_h) || 1080
                const maxMp = Math.round((maxW * maxH) / 1e6 * 10) / 10
                const allResolutions = [
                  { label: '1080p (2MP)', w: 1920, h: 1080, mp: 2 },
                  { label: '3MP', w: 2048, h: 1536, mp: 3 },
                  { label: '4MP (1440p)', w: 2560, h: 1440, mp: 4 },
                  { label: '5MP', w: 2592, h: 1944, mp: 5 },
                  { label: '4K / 8MP', w: 3840, h: 2160, mp: 8 },
                  { label: '12MP', w: 4000, h: 3000, mp: 12 },
                  { label: '8K / 33MP', w: 7680, h: 4320, mp: 33 },
                ]
                const available = allResolutions.filter(r => r.mp <= maxMp + 0.5)
                const currentRecW = Number(props.recording_resolution_w) || maxW
                const currentRecH = Number(props.recording_resolution_h) || maxH
                const currentKey = `${currentRecW}x${currentRecH}`
                return (
                  <div>
                    <div style={{ fontSize: 9, color: C.textDim, marginBottom: 4 }}>
                      Camera max: <strong style={{ color: C.text }}>{maxW}×{maxH}</strong> ({maxMp}MP)
                    </div>
                    <select value={currentKey}
                      onChange={e => {
                        const [w, h] = e.target.value.split('x').map(Number)
                        updateProp('recording_resolution_w', w)
                        updateProp('recording_resolution_h', h)
                      }}
                      style={{ width: '100%', padding: '5px 8px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none' }}>
                      {available.map(r => (
                        <option key={`${r.w}x${r.h}`} value={`${r.w}x${r.h}`}>{r.label} ({r.w}×{r.h})</option>
                      ))}
                    </select>
                  </div>
                )
              })()}
            </div>

            {/* Camera Profile */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Camera Profile</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <RecField label={`FPS${Number(props.fps) ? ` (max ${props.fps})` : ''}`}>
                  <input type="number" min={1} max={Number(props.fps) || 60}
                    value={Math.min(Number(props.recording_fps) || 30, Number(props.fps) || 60)}
                    onChange={e => updateProp('recording_fps', Math.min(Number(e.target.value), Number(props.fps) || 60))}
                    style={{ width: '100%', padding: '4px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 10, fontFamily: 'monospace', outline: 'none' }} />
                </RecField>
                <RecField label="Sub Stream">
                  <select value={String(props.sub_stream || 'on')} onChange={e => updateProp('sub_stream', e.target.value)}
                    style={{ width: '100%', padding: '4px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none' }}>
                    <option value="on">On</option><option value="off">Off</option>
                  </select>
                </RecField>
                <RecField label="Codec">
                  <select value={String(props.codec || 'H.265')} onChange={e => updateProp('codec', e.target.value)}
                    style={{ width: '100%', padding: '4px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none' }}>
                    <option value="H.264">H.264</option><option value="H.265">H.265</option><option value="MJPEG">MJPEG</option>
                  </select>
                </RecField>
                <RecField label="Sub FPS">
                  <input type="number" min={1} max={60} value={Number(props.sub_fps) || 7}
                    onChange={e => updateProp('sub_fps', Number(e.target.value))}
                    style={{ width: '100%', padding: '4px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 10, fontFamily: 'monospace', outline: 'none' }} />
                </RecField>
                <RecField label="Smart Codec">
                  <select value={String(props.smart_codec || 'off')} onChange={e => updateProp('smart_codec', e.target.value)}
                    style={{ width: '100%', padding: '4px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none' }}>
                    <option value="off">Off</option><option value="wisestream">WiseStream</option><option value="zipstream">Zipstream</option><option value="smart_plus">Smart+</option>
                  </select>
                </RecField>
                <RecField label="Bitrate">
                  <select value={String(props.bitrate_mode || 'cbr')} onChange={e => updateProp('bitrate_mode', e.target.value)}
                    style={{ width: '100%', padding: '4px 6px', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none' }}>
                    <option value="vbr">VBR</option><option value="cbr">CBR</option>
                  </select>
                </RecField>
              </div>
              {/* Link to Device Configuration */}
              <button onClick={() => { onOpenDeviceProfile?.() }} style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px',
                background: 'rgba(43,186,160,0.06)', border: '1px solid rgba(43,186,160,0.2)',
                borderRadius: 5, color: '#2bbaa0', fontSize: 10, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', width: '100%',
              }}>
                <Settings size={12} /> View in Device Configuration
              </button>
            </div>

            {/* Lighting Condition */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Lighting Condition</div>
              <BtnGroup
                options={['Day', 'Night', 'Illuminated']}
                value={String(props.lighting_condition || 'Day')}
                onChange={v => updateProp('lighting_condition', v)}
              />
              {/* 24h timeline */}
              <div style={{ marginTop: 8, display: 'flex', gap: 1 }}>
                {Array.from({ length: 24 }, (_, h) => {
                  const isDaylight = h >= 7 && h <= 19
                  const isTwilight = (h >= 5 && h < 7) || (h > 19 && h <= 21)
                  return (
                    <div key={h} style={{
                      flex: 1, height: 8, borderRadius: 2,
                      background: isDaylight ? '#e8853a' : isTwilight ? '#d4a726' : C.textDim,
                      opacity: isDaylight ? 1 : isTwilight ? 0.6 : 0.3,
                    }} />
                  )
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                {[0, 6, 12, 18, 24].map(h => (
                  <span key={h} style={{ fontSize: 7, color: C.textDim }}>{h}</span>
                ))}
              </div>
            </div>

            {/* Recording Duration */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Recording Duration</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => updateProp('retention_days', Math.max(1, (Number(props.retention_days) || 30) - 1))} style={{
                  width: 24, height: 24, borderRadius: 4, border: `1px solid ${C.border}`,
                  background: C.bgActive, color: C.textDim, cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>−</button>
                <input type="number" value={Number(props.retention_days) || 30} min={1}
                  onChange={e => updateProp('retention_days', Number(e.target.value))}
                  style={{
                    width: 48, padding: '4px 6px', background: C.bgActive,
                    border: `1px solid ${C.border}`, borderRadius: 4,
                    color: C.text, fontSize: 12, fontFamily: 'monospace',
                    textAlign: 'center', outline: 'none', fontWeight: 700,
                  }} />
                <span style={{ fontSize: 11, color: C.textMuted }}>days</span>
                <button onClick={() => updateProp('retention_days', (Number(props.retention_days) || 30) + 1)} style={{
                  width: 24, height: 24, borderRadius: 4, border: `1px solid ${C.border}`,
                  background: C.bgActive, color: C.textDim, cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>+</button>
              </div>
            </div>

            {/* Recording Schedule — Interactive Weekly Grid */}
            <RecordingScheduleGrid
              schedule={(props.recording_schedule_grid || null) as never}
              onChange={grid => updateProp('recording_schedule_grid', grid)}
            />

            {/* ── Storage Estimate (from this camera's recording profile) ── */}
            {isCamera && (() => {
              const recW = Number(props.recording_resolution_w) || Number(props.resolution_w) || 1920
              const recH = Number(props.recording_resolution_h) || Number(props.resolution_h) || 1080
              const recMp = Math.round((recW * recH) / 1e6 * 10) / 10
              const fps = Number(props.recording_fps) || 30
              const codec = String(props.codec || 'H.265')
              const retDays = Number(props.retention_days) || 30
              // Bitrate estimate: base from resolution, adjusted by codec + fps
              const baseMbps = recMp <= 2 ? 2 : recMp <= 4 ? 4 : recMp <= 5 ? 5 : recMp <= 8 ? 8 : recMp <= 12 ? 12 : 16
              const codecMult = codec === 'H.264' ? 1.5 : codec === 'MJPEG' ? 3 : 1.0
              const fpsMult = fps / 30
              const smartMult = props.smart_codec && props.smart_codec !== 'off' ? 0.6 : 1.0
              const bitrateMbps = Math.round(baseMbps * codecMult * fpsMult * smartMult * 10) / 10
              const storageGbPerDay = (bitrateMbps * 3600 * 24) / 8 / 1024
              const totalStorageGb = Math.round(storageGbPerDay * retDays)
              const totalStorageTb = (totalStorageGb / 1024).toFixed(2)
              return (
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Storage Estimate</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <div style={{ padding: '6px 8px', background: C.bgActive, borderRadius: 4, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, fontFamily: 'monospace' }}>{bitrateMbps}</div>
                      <div style={{ fontSize: 8, color: C.textDim }}>Mbps</div>
                    </div>
                    <div style={{ padding: '6px 8px', background: C.bgActive, borderRadius: 4, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, fontFamily: 'monospace' }}>{totalStorageGb < 1024 ? totalStorageGb + ' GB' : totalStorageTb + ' TB'}</div>
                      <div style={{ fontSize: 8, color: C.textDim }}>{retDays}d retention</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 8, color: C.textDim, marginTop: 4 }}>
                    {recW}×{recH} · {codec} · {fps}fps · {props.smart_codec && props.smart_codec !== 'off' ? String(props.smart_codec) : 'no smart codec'}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

      </div>
    </div>
  )
}

/* ─── Rec field helper ─── */
function RecField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>{label}</div>
      {children}
    </div>
  )
}

/* ─── Interactive Weekly Recording Schedule Grid (Hanwha DesignPro style) ─── */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const EVENT_PCTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const
type CellMode = 'continuous' | 'event' | 'none'
type ScheduleGrid = Record<string, Record<string, { mode: CellMode; pct?: number }>>

function initGrid(): ScheduleGrid {
  const g: ScheduleGrid = {}
  for (const d of DAYS) {
    g[d] = {}
    for (let h = 0; h < 24; h++) g[d][h] = { mode: 'continuous' }
  }
  return g
}

function RecordingScheduleGrid({ schedule, onChange }: {
  schedule: ScheduleGrid | null
  onChange: (grid: ScheduleGrid) => void
}) {
  const grid = schedule || initGrid()
  const [paintMode, setPaintMode] = React.useState<CellMode>('continuous')
  const [eventPct, setEventPct] = React.useState(50)
  const isPainting = React.useRef(false)

  const paintCell = (day: string, hour: number) => {
    const next = JSON.parse(JSON.stringify(grid)) as ScheduleGrid
    if (!next[day]) next[day] = {}
    next[day][hour] = paintMode === 'event' ? { mode: 'event', pct: eventPct } : { mode: paintMode }
    onChange(next)
  }

  const cellColor = (mode: CellMode) => mode === 'continuous' ? '#34c77b' : mode === 'event' ? '#f59e0b' : C.bgActive

  React.useEffect(() => {
    const up = () => { isPainting.current = false }
    document.addEventListener('mouseup', up)
    return () => document.removeEventListener('mouseup', up)
  }, [])

  return (
    <div style={{ padding: '10px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>Recording Schedule</div>

      {/* Paint mode selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {([['continuous', 'Continuous', '#34c77b'], ['event', 'Event', '#f59e0b'], ['none', 'No recording', C.textDim]] as const).map(([mode, lbl, clr]) => (
          <button key={mode} onClick={() => setPaintMode(mode as CellMode)}
            style={{
              padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600,
              border: `1.5px solid ${paintMode === mode ? clr : C.border}`,
              background: paintMode === mode ? `${clr}20` : 'transparent',
              color: paintMode === mode ? clr : C.textMuted,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: clr, display: 'inline-block' }} />
            {lbl}
          </button>
        ))}
        {paintMode === 'event' && (
          <select value={eventPct} onChange={e => setEventPct(Number(e.target.value))}
            style={{
              padding: '2px 4px', background: C.bgActive, border: `1px solid ${C.border}`,
              borderRadius: 4, color: C.text, fontSize: 9, fontFamily: 'inherit', outline: 'none',
            }}>
            {EVENT_PCTS.map(p => <option key={p} value={p}>{p}%</option>)}
          </select>
        )}
      </div>

      {/* Hour labels */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 1, paddingLeft: 20 }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{ flex: 1, fontSize: 5, color: C.textDim, textAlign: 'center' }}>
            {h % 3 === 0 ? h : ''}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      <div style={{ userSelect: 'none' }}>
        {DAYS.map(day => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1 }}>
            <span style={{ fontSize: 7, color: C.textDim, width: 18, flexShrink: 0 }}>{day}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const cell = grid[day]?.[h] || { mode: 'continuous' as CellMode }
              return (
                <div
                  key={h}
                  onMouseDown={(e) => { e.preventDefault(); isPainting.current = true; paintCell(day, h) }}
                  onMouseEnter={() => { if (isPainting.current) paintCell(day, h) }}
                  style={{
                    flex: 1, height: 10, borderRadius: 1, cursor: 'pointer',
                    background: cellColor(cell.mode as CellMode),
                    opacity: cell.mode === 'none' ? 0.3 : 0.8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.05s',
                  }}
                  title={`${day} ${h}:00 — ${cell.mode}${cell.pct ? ` ${cell.pct}%` : ''}`}
                >
                  {cell.mode === 'event' && cell.pct && (
                    <span style={{ fontSize: 4, color: '#fff', fontWeight: 700, lineHeight: 1 }}>{cell.pct}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
