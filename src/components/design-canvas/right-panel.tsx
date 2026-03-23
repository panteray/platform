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

import React, { useState, useCallback, useEffect } from 'react'
import { X, Copy, Trash2, Cable, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { C } from './constants'
import type { DesignDevice, DesignMdfIdf } from '@/types/database'

/* ─── 48 Color Palette ─── */
const COLOR_PALETTE = [
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e',
  '#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1','#8b5cf6',
  '#a855f7','#d946ef','#ec4899','#f43f5e','#dc2626','#ea580c',
  '#d97706','#ca8a04','#65a30d','#16a34a','#0d9488','#0891b2',
  '#0284c7','#2563eb','#4f46e5','#7c3aed','#9333ea','#c026d3',
  '#db2777','#e11d48','#991b1b','#9a3412','#92400e','#854d0e',
  '#3f6212','#166534','#115e59','#155e75','#075985','#1e40af',
  '#3730a3','#5b21b6','#6b21a8','#86198f','#9d174d','#9f1239',
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
}

/* ─── Slider+Input Combo (Hanwha pattern) ─── */
function ParamRow({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])

  const commit = (v: number) => {
    const clamped = Math.max(min, Math.min(max, v))
    setLocal(clamped)
    onChange(clamped)
  }

  return (
    <div style={{ padding: '8px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</div>
      <input type="range" min={min} max={max} step={step} value={local}
        onChange={e => setLocal(Number(e.target.value))}
        onMouseUp={() => commit(local)}
        onTouchEnd={() => commit(local)}
        style={{
          width: '100%', height: 4, appearance: 'none', background: C.bgActive,
          borderRadius: 2, outline: 'none', cursor: 'pointer',
          accentColor: C.accent,
        }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 6,
          overflow: 'hidden',
        }}>
          <button onClick={() => commit(local - step)}
            style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>−</button>
          <input type="number" value={local} step={step} min={min} max={max}
            onChange={e => setLocal(Number(e.target.value))}
            onBlur={() => commit(local)}
            onKeyDown={e => { if (e.key === 'Enter') commit(local) }}
            style={{
              width: 60, textAlign: 'center', background: 'transparent',
              border: 'none', borderLeft: `1px solid ${C.border}`,
              borderRight: `1px solid ${C.border}`,
              color: C.text, fontFamily: "monospace",
              outline: 'none', padding: '4px 0',
            }} />
          <span style={{ padding: '0 6px', fontSize: 10, color: C.textDim, minWidth: 20 }}>{unit}</span>
          <button onClick={() => commit(local + step)}
            style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>+</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Elevation View SVG (side-profile) ─── */
function ElevationDiagram({ installHeight, tiltAngle, targetDist, fovAngle }: {
  installHeight: number; tiltAngle: number; targetDist: number; fovAngle: number
}) {
  const W = 248, H = 140
  const PAD_L = 30, PAD_R = 14, PAD_T = 14, PAD_B = 22
  const drawW = W - PAD_L - PAD_R
  const drawH = H - PAD_T - PAD_B

  // Scale to fit: max of installHeight and targetDist
  const personH = 5.5 // ft
  const maxVert = Math.max(installHeight, personH) * 1.15
  const maxHoriz = Math.max(targetDist, 5) * 1.1
  const scaleX = drawW / maxHoriz
  const scaleY = drawH / maxVert

  const groundY = PAD_T + drawH
  const camX = PAD_L
  const camY = groundY - installHeight * scaleY

  // Target point
  const targetX = PAD_L + targetDist * scaleX
  const targetY = groundY

  // FOV cone from side view (using vertical FOV ≈ fovAngle * 0.75)
  const vFovHalf = (fovAngle * 0.75 / 2) * Math.PI / 180
  const tiltRad = tiltAngle * Math.PI / 180
  const coneLen = targetDist * scaleX

  // Upper and lower edges of FOV cone
  const upperAngle = tiltRad - vFovHalf
  const lowerAngle = tiltRad + vFovHalf
  const cone1X = camX + Math.cos(upperAngle) * coneLen
  const cone1Y = camY + Math.sin(upperAngle) * coneLen
  const cone2X = camX + Math.cos(lowerAngle) * coneLen
  const cone2Y = camY + Math.sin(lowerAngle) * coneLen

  // Person silhouette at target
  const personTop = groundY - personH * scaleY

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', borderRadius: 4, background: C.bgActive }}>
      {/* Grid lines */}
      <line x1={PAD_L} y1={groundY} x2={W - PAD_R} y2={groundY} stroke={C.border} strokeWidth={1.5} />
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={groundY} stroke={C.border} strokeWidth={0.5} strokeDasharray="3,3" />

      {/* FOV cone (translucent triangle) */}
      <polygon
        points={`${camX},${camY} ${cone1X},${Math.min(cone1Y, groundY)} ${cone2X},${Math.min(cone2Y, groundY)}`}
        fill={C.accent} opacity={0.12} stroke={C.accent} strokeWidth={0.5} strokeOpacity={0.4}
      />

      {/* Cone center line (dashed) */}
      <line x1={camX} y1={camY} x2={targetX} y2={groundY}
        stroke={C.accent} strokeWidth={0.5} strokeDasharray="4,3" opacity={0.5} />

      {/* Camera icon (small rect + triangle) */}
      <rect x={camX - 6} y={camY - 4} width={12} height={8} rx={1.5}
        fill={C.accent} stroke="none" />
      <polygon points={`${camX + 6},${camY - 2} ${camX + 10},${camY} ${camX + 6},${camY + 2}`}
        fill={C.accent} />

      {/* Person silhouette at target distance */}
      <line x1={targetX} y1={groundY} x2={targetX} y2={personTop}
        stroke="#22c55e" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={targetX} cy={personTop - 3} r={3} fill="#22c55e" />

      {/* Height dimension line (left side) */}
      <line x1={PAD_L - 8} y1={groundY} x2={PAD_L - 8} y2={camY}
        stroke={C.textDim} strokeWidth={0.5} markerStart="url(#arrowUp)" markerEnd="url(#arrowDown)" />
      <text x={2} y={(groundY + camY) / 2 + 3} fontSize={7} fill={C.textMuted}
        fontFamily="'IBM Plex Mono', monospace" textAnchor="start">
        {installHeight}ft
      </text>

      {/* Distance label (bottom) */}
      <line x1={camX} y1={groundY + 10} x2={targetX} y2={groundY + 10}
        stroke={C.textDim} strokeWidth={0.5} />
      <text x={(camX + targetX) / 2} y={groundY + 18} fontSize={7} fill={C.textMuted}
        fontFamily="'IBM Plex Mono', monospace" textAnchor="middle">
        {targetDist}ft
      </text>

      {/* Person height label */}
      <text x={targetX + 8} y={(groundY + personTop) / 2 + 3} fontSize={6.5} fill="#22c55e"
        fontFamily="'IBM Plex Mono', monospace">
        {personH}ft
      </text>

      {/* Tilt label */}
      {tiltAngle !== 0 && (
        <text x={camX + 16} y={camY - 8} fontSize={7} fill={C.accent}
          fontFamily="'IBM Plex Mono', monospace">
          {tiltAngle}°
        </text>
      )}
    </svg>
  )
}

/* ─── Component ─── */
export function RightPanel({ device, onClose, onUpdateDevice, onDuplicate, onDelete, scalePxPerFt, mdfIdfs }: Props) {
  const props = (device.properties ?? {}) as Record<string, unknown>
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

  return (
    <div style={{
      width: 280, height: '100%', background: C.bgPanel,
      borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', 'Segoe UI', sans-serif", overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {device.label || 'Device'}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
            {device.category.replace(/_/g, ' ').toUpperCase()}
            {props.resolution_w ? ` • ${props.resolution_w}×${props.resolution_h || '?'}` : ''}
          </div>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
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

        {/* Camera-specific sections */}
        {isCamera && (
          <>
            {/* ── Mount Type ── */}
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
              {installHeight > 12 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4, marginTop: 6,
                  padding: '4px 8px', borderRadius: 4,
                  background: '#f59e0b15', border: '1px solid #f59e0b30',
                }}>
                  <AlertTriangle size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#f59e0b' }}>LIFT REQUIRED — {installHeight}ft</span>
                </div>
              )}
            </div>

          {/* Camera-specific sliders */}
            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="Focal Length" value={focalLength}
                min={1} max={300} step={0.5} unit="mm"
                onChange={v => updateProp('focal_length', v)} />
            </div>

            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="Target Distance" value={targetDist}
                min={1} max={500} step={1} unit="ft"
                onChange={v => updateProp('target_distance', v)} />
            </div>

            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="Installation Height" value={installHeight}
                min={1} max={60} step={0.5} unit="ft"
                onChange={v => updateProp('install_height', v)} />
            </div>

            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="Tilt Angle" value={tiltAngle}
                min={-90} max={90} step={1} unit="°"
                onChange={v => updateProp('tilt_angle', v)} />
            </div>

            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="FOV Angle" value={fovAngle}
                min={5} max={180} step={1} unit="°"
                onChange={v => updateProp('fov_angle', v)} />
            </div>

            <div style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
              <ParamRow label="Camera Rotation" value={rotation}
                min={0} max={360} step={1} unit="°"
                onChange={v => onUpdateDevice(device.id, { rotation: v })} />
            </div>

            {/* DORI at target distance */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>Quality at Target</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                {['Detection', 'Observation', 'Recognition', 'Identification'].map((tier, i) => {
                  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e']
                  return (
                    <div key={tier} style={{
                      padding: '6px 4px', textAlign: 'center', borderRadius: 4,
                      background: `${colors[i]}15`, border: `1px solid ${colors[i]}30`,
                      fontSize: 8, fontWeight: 600, color: colors[i], lineHeight: 1.2,
                    }}>
                      {tier[0]}
                    </div>
                  )
                })}
              </div>

              {/* PPF Quality Reference Chart */}
              <div style={{ marginTop: 8 }}>
                {[
                  { ppf: '100+', label: 'Facial Recognition', color: '#22c55e' },
                  { ppf: '76–99', label: 'Identification', color: '#22c55e' },
                  { ppf: '38–75', label: 'Recognition / LPR', color: '#eab308' },
                  { ppf: '19–37', label: 'Observation', color: '#f97316' },
                  { ppf: '8–18', label: 'Detection', color: '#ef4444' },
                  { ppf: '4–7', label: 'Monitor (general)', color: '#ef444480' },
                  { ppf: '0–3', label: 'Monitor Only', color: '#ef444450' },
                ].map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '2px 6px', fontSize: 8, borderRadius: 2,
                    background: i === 0 ? `${row.color}15` : 'transparent',
                  }}>
                    <span style={{ color: row.color, fontWeight: 600, fontFamily: 'monospace', width: 36 }}>{row.ppf}</span>
                    <span style={{ color: C.textDim, flex: 1, textAlign: 'right' }}>{row.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Elevation View (side-profile SVG) ── */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>Elevation View</div>
              <ElevationDiagram
                installHeight={installHeight}
                tiltAngle={tiltAngle}
                targetDist={targetDist}
                fovAngle={fovAngle}
              />
            </div>

            {/* ── Device Specs (read-only) ── */}
            <Section title="Device Specs">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {[
                  ['Sensor', props.sensor_size ? `${props.sensor_size}"` : '—'],
                  ['IR Range', props.ir_range ? `${props.ir_range}ft` : '—'],
                  ['PoE', props.poe_standard || '—'],
                  ['Max Power', props.max_power ? `${props.max_power}W` : '—'],
                  ['IP Rating', props.ip_rating || '—'],
                  ['Max Res', props.resolution_w ? `${props.resolution_w}×${props.resolution_h}` : '—'],
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

      {/* ── Actions Footer ── */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        borderTop: `1px solid ${C.border}`,
      }}>
        <button onClick={() => onDuplicate(device.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '8px 0', background: C.bgActive, border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.text, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <Copy size={12} /> Duplicate
        </button>
        <button onClick={() => onDelete(device.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '8px 0', background: '#ef444415', border: `1px solid #ef444440`,
            borderRadius: 6, color: C.red, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  )
}
