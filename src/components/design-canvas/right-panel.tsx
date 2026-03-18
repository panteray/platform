'use client'

import { useState, useCallback } from 'react'
import { C, COLORS_16, COLORS_48, PPF_CHART } from './constants'
import { Section, Field, SliderField, SubLabel } from './section'
import { ActionIcons } from './icons'
import { calculateMountRequirements, type MountCalcOutput } from '@/lib/calculators'
import type { DesignDevice, DesignZone } from '@/types/database'

interface RightPanelProps {
  device: DesignDevice | null
  onClose: () => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  onUpdateDevice?: (id: string, updates: Partial<DesignDevice>) => void
  onChangeModel?: (deviceId: string, category: string) => void
  selectedZone?: DesignZone | null
  onUpdateZone?: (id: string, updates: Record<string, unknown>) => void
  onDeleteZone?: (id: string) => void
  onCloseZone?: () => void
  zones?: DesignZone[]
}

/** Extract typed property from device.properties JSONB */
function prop<T>(device: DesignDevice, key: string, fallback: T): T {
  const p = device.properties as Record<string, unknown> | null
  if (!p || p[key] === undefined || p[key] === null) return fallback
  return p[key] as T
}

/** Merge a single key into properties JSONB */
function mergeProps(device: DesignDevice, key: string, value: unknown): Record<string, unknown> {
  const existing = (device.properties ?? {}) as Record<string, unknown>
  return { ...existing, [key]: value }
}

/** Manufacturer-aware smart codec label */
function getSmartCodecLabel(manufacturer: string): string {
  switch (manufacturer.toLowerCase()) {
    case 'axis': return 'Zipstream (Med)'
    case 'hanwha': return 'WiseStream III'
    case 'hikvision': return 'H.265+'
    case 'dahua': return 'Smart Codec'
    default: return 'Smart Codec'
  }
}

/** Check if category is CCTV-type */
function isCctv(cat: string): boolean {
  return ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'].includes(cat)
}

/** Check if category is ACS-type */
function isAcs(cat: string): boolean {
  return ['access_control', 'door', 'door_controller', 'card_reader', 'electric_strike', 'maglock', 'intercom'].includes(cat)
}

/** Check if category is Network-type */
function isNetwork(cat: string): boolean {
  return ['network', 'switch', 'access_switch', 'rack', 'nvr', 'router', 'firewall', 'wireless_ap', 'bridge', 'server', 'monitor', 'patch_panel'].includes(cat)
}

export function RightPanel({
  device,
  onClose,
  onDuplicate,
  onDelete,
  onUpdateDevice,
  onChangeModel,
  selectedZone,
  onUpdateZone,
  onDeleteZone,
  onCloseZone,
  zones = [],
}: RightPanelProps) {
  // ---- Zone Editor (takes priority when zone selected) ----
  if (selectedZone && !device) {
    const z = selectedZone
    return (
      <div style={{
        width: 300, height: '100%', background: C.bgPanel, borderLeft: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '8px 12px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: z.color }}>Zone Properties</span>
          <button onClick={() => onCloseZone?.()} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 2 }}>
            {ActionIcons.close}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Name */}
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
            <input
              defaultValue={z.name}
              key={z.id + '-zname'}
              onBlur={(e) => {
                if (e.target.value !== z.name) onUpdateZone?.(z.id, { name: e.target.value })
              }}
              style={{
                width: '100%', background: C.bgActive, border: `1px solid ${C.border}`,
                borderRadius: 4, padding: '5px 8px', color: C.text, fontSize: 13,
                fontWeight: 600, fontFamily: 'inherit', outline: 'none',
              }}
            />

            {/* Color picker */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {COLORS_16.map((c) => (
                <div
                  key={c}
                  onClick={() => onUpdateZone?.(z.id, { color: c })}
                  style={{
                    width: 18, height: 18, borderRadius: 4, background: c, cursor: 'pointer',
                    border: z.color === c ? '2px solid white' : '2px solid transparent',
                    transition: 'all 0.1s',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Position & Size */}
          <Section title="Position & Size" defaultOpen={true}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>X</div>
                <input type="number" defaultValue={z.x} key={z.id + '-zx'}
                  onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== z.x) onUpdateZone?.(z.id, { x: v }) }}
                  style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 6px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Y</div>
                <input type="number" defaultValue={z.y} key={z.id + '-zy'}
                  onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v !== z.y) onUpdateZone?.(z.id, { y: v }) }}
                  style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 6px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Width</div>
                <input type="number" defaultValue={z.width} key={z.id + '-zw'}
                  onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0 && v !== z.width) onUpdateZone?.(z.id, { width: v }) }}
                  style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 6px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.textDim, marginBottom: 2 }}>Height</div>
                <input type="number" defaultValue={z.height} key={z.id + '-zh'}
                  onBlur={(e) => { const v = parseInt(e.target.value); if (!isNaN(v) && v > 0 && v !== z.height) onUpdateZone?.(z.id, { height: v }) }}
                  style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 6px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }}
                />
              </div>
            </div>
          </Section>
        </div>

        {/* Actions footer */}
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
          <button onClick={() => onDeleteZone?.(z.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '6px 0', fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
              color: C.red, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 4, cursor: 'pointer',
            }}
          >
            {ActionIcons.trash} <span>Delete Zone</span>
          </button>
        </div>
      </div>
    )
  }

  if (!device) {
    return (
      <div style={{ width: 300, height: '100%', background: C.bgPanel, borderLeft: `1px solid ${C.border}`, padding: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: C.textDim }}>Select a device on the canvas to view its properties.</span>
      </div>
    )
  }

  const d = device
  const cat = d.category
  const p = (d.properties ?? {}) as Record<string, unknown>
  const manufacturer = String(p.manufacturer || '')
  const model = String(p.model || d.label)
  const channels = (p.channels as number) || 1

  // ---- Save helpers ----
  const saveField = useCallback((key: string, value: unknown) => {
    onUpdateDevice?.(d.id, { [key]: value })
  }, [d.id, onUpdateDevice])

  const saveProp = useCallback((key: string, value: unknown) => {
    onUpdateDevice?.(d.id, { properties: mergeProps(d, key, value) })
  }, [d, onUpdateDevice])

  const saveFieldFromBlur = useCallback((key: string, value: string) => {
    // Determine if this is a top-level field or a property
    const topLevel = ['label', 'mount_type', 'color_hex', 'rotation', 'status', 'condition', 'asset_type', 'billing_type', 'recurring_cost']
    if (topLevel.includes(key)) {
      saveField(key, value)
    } else {
      saveProp(key, value)
    }
  }, [saveField, saveProp])

  const saveSlider = useCallback((key: string, value: number) => {
    const topLevel = ['rotation', 'recurring_cost']
    if (topLevel.includes(key)) {
      saveField(key, value)
    } else {
      saveProp(key, value)
    }
  }, [saveField, saveProp])

  // PPF data
  const ppf = prop(d, 'ppf', 0)
  const ppfColor = ppf >= 76 ? C.green : ppf >= 38 ? C.yellow : ppf > 0 ? C.red : C.textDim

  return (
    <div style={{
      width: 300, height: '100%', background: C.bgPanel, borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 10, color: C.accent }}>Properties</span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 2 }}>
          {ActionIcons.close}
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Label + Color + Model — always visible */}
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
          <input
            defaultValue={d.label}
            key={d.id + '-label'}
            onBlur={(e) => {
              if (e.target.value !== d.label) saveField('label', e.target.value)
            }}
            style={{
              width: '100%', background: C.bgActive, border: `1px solid ${C.border}`,
              borderRadius: 4, padding: '5px 8px', color: C.text, fontSize: 13,
              fontWeight: 600, fontFamily: 'inherit', outline: 'none',
            }}
          />

          {/* Color picker — 48 swatches, 8 per row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3, marginTop: 8 }}>
            {COLORS_48.map((c) => (
              <div
                key={c}
                onClick={() => saveField('color_hex', c)}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 4, background: c, cursor: 'pointer',
                  border: d.color_hex === c ? '2px solid white' : '2px solid transparent',
                  transition: 'all 0.1s',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>

          {/* Model display */}
          <div style={{
            marginTop: 10, padding: '6px 8px', background: C.bgActive,
            borderRadius: 4, border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Model</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 2 }}>
              {manufacturer ? `${manufacturer} ${model}` : model}
            </div>
            <div onClick={() => onChangeModel?.(d.id, d.category)} style={{ fontSize: 9, color: C.accent, marginTop: 4, cursor: 'pointer' }}>Change Model</div>
          </div>

          {/* Multi-sensor badge */}
          {channels > 1 && (
            <div style={{
              marginTop: 8, padding: '4px 8px', background: 'rgba(234,179,8,0.1)',
              border: '1px solid rgba(234,179,8,0.3)', borderRadius: 4,
              fontSize: 10, color: C.yellow, fontWeight: 600,
            }}>
              {channels}-Sensor Multi-Lens
            </div>
          )}

          {/* Zone assignment */}
          {zones.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Zone</div>
              <select
                value={d.zone_id ?? ''}
                onChange={(e) => saveField('zone_id', e.target.value || null)}
                style={{
                  width: '100%', background: C.bgActive, border: `1px solid ${C.border}`,
                  borderRadius: 4, padding: '4px 6px', color: C.text, fontSize: 11,
                  fontFamily: 'inherit', outline: 'none', appearance: 'auto' as never,
                }}
              >
                <option value="">No Zone</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ---- STANDARD INFO (all categories) ---- */}
        <Section title="Standard Info" defaultOpen={true}>
          {/* Status chips */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 8, flexWrap: 'wrap' }}>
            {['new', 'existing_keep', 'existing_remove', 'relocate'].map((s) => {
              const isActive = d.status === s
              const label = s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
              return (
                <button key={s} onClick={() => saveField('status', s)}
                  style={{
                    padding: '3px 6px', fontSize: 8, fontWeight: 600, fontFamily: 'inherit',
                    background: isActive ? C.accentSubtle : C.bgActive,
                    color: isActive ? C.accent : C.textDim,
                    border: isActive ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                    borderRadius: 3, cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <Field label="Manufacturer" value={prop(d, 'manufacturer', '')} editable fieldKey="manufacturer" onBlurSave={saveFieldFromBlur} />
          <Field label="Part Number" value={prop(d, 'part_number', '')} editable fieldKey="part_number" onBlurSave={saveFieldFromBlur} />
          <Field label="Model" value={prop(d, 'model', '')} editable fieldKey="model" onBlurSave={saveFieldFromBlur} />
          <Field label="Location Description" value={prop(d, 'location_description', '')} editable fieldKey="location_description" onBlurSave={saveFieldFromBlur} />
        </Section>

        {/* ---- PLACEMENT (all categories) ---- */}
        <Section title="Placement" defaultOpen={true}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {(['ceiling', 'wall', 'pole', 'pendant'] as const).map((m) => (
              <button
                key={m}
                onClick={() => saveField('mount_type', m)}
                style={{
                  flex: 1, padding: '4px 0', fontSize: 9, fontWeight: 600, fontFamily: 'inherit',
                  background: d.mount_type === m ? C.accentSubtle : C.bgActive,
                  color: d.mount_type === m ? C.accent : C.textDim,
                  border: d.mount_type === m ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                  borderRadius: 4, cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Surface type selector */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Surface Type</div>
            <select
              value={prop(d, 'surface_type', '')}
              onChange={(e) => saveProp('surface_type', e.target.value || null)}
              style={{
                width: '100%', background: C.bgActive, border: `1px solid ${C.border}`,
                borderRadius: 4, padding: '4px 6px', color: C.text, fontSize: 11,
                fontFamily: 'inherit', outline: 'none', appearance: 'auto' as never,
              }}
            >
              <option value="">Not specified</option>
              {['concrete', 'drywall', 'wood', 'metal', 'brick', 'stucco', 't-bar_ceiling', 'plaster'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>

          <SliderField label="Target Distance" value={prop(d, 'target_distance', 30)} unit="ft" min={0} max={200} fieldKey="target_distance" onChangeSave={saveSlider} />
          <SliderField label="Mount Height" value={prop(d, 'mount_height', 10)} unit="ft" min={0} max={40} warning={prop(d, 'mount_height', 10) > 12} fieldKey="mount_height" onChangeSave={saveSlider} />
          <SliderField label="Tilt" value={prop(d, 'tilt_angle', 15)} unit="deg" min={0} max={90} fieldKey="tilt_angle" onChangeSave={saveSlider} />
          <SliderField label="Rotation" value={d.rotation || 0} unit="deg" min={0} max={360} fieldKey="rotation" onChangeSave={saveSlider} />

          {/* Upgraded side elevation diagram */}
          {(() => {
            const mountH = prop(d, 'mount_height', 10)
            const targetD = prop(d, 'target_distance', 30)
            const tilt = prop(d, 'tilt_angle', 15)
            const color = d.color_hex || C.accent
            // Scale: fit 0..max into SVG coords (viewBox 0 0 260 110)
            const maxDim = Math.max(mountH, targetD, 1)
            const sX = (v: number) => 38 + (v / maxDim) * 195 // horizontal: distance
            const sY = (v: number) => 100 - (v / maxDim) * 80 // vertical: height (inverted)
            const camX = 38
            const camY = sY(mountH)
            const groundY = 100
            const targetX = sX(targetD)
            // Person silhouette at target (5'8" = 5.67ft)
            const personH = 5.67
            const personY = sY(personH)
            // Tilt angle arc
            const tiltRad = (tilt * Math.PI) / 180
            const arcR = 18
            const arcEndX = camX + arcR * Math.cos(Math.PI / 2 - tiltRad)
            const arcEndY = camY + arcR * Math.sin(Math.PI / 2 - tiltRad)
            // FOV cone end points (simplified ground intersection)
            const coneEndY = groundY
            const coneEndX = targetX
            // Blind spot triangle (area directly below camera)
            const blindX = camX + mountH * Math.tan(tiltRad) * (195 / maxDim) * 0.15

            return (
              <div style={{ marginTop: 8, background: C.bg, borderRadius: 6, padding: 8, border: `1px solid ${C.borderSubtle}` }}>
                <svg width="100%" height="110" viewBox="0 0 260 110">
                  {/* Ground line */}
                  <line x1="10" y1={groundY} x2="250" y2={groundY} stroke={C.textDim} strokeWidth="1" />

                  {/* Wall / mount line */}
                  <line x1={camX} y1={groundY} x2={camX} y2={camY - 6} stroke={C.textDim} strokeWidth="1" strokeDasharray="3 2" />

                  {/* Height tick marks (every ~5ft) */}
                  {Array.from({ length: Math.floor(mountH / 5) + 1 }, (_, i) => i * 5).filter(h => h > 0 && h <= mountH).map((h) => (
                    <g key={`tick-${h}`}>
                      <line x1={camX - 4} y1={sY(h)} x2={camX + 4} y2={sY(h)} stroke={C.textDim} strokeWidth="0.5" />
                      <text x={camX - 8} y={sY(h) + 3} textAnchor="end" fill={C.textDim} fontSize="6" fontFamily="IBM Plex Mono">{h}</text>
                    </g>
                  ))}

                  {/* Blind spot (shaded area under camera) */}
                  <polygon points={`${camX},${camY} ${camX},${groundY} ${blindX},${groundY}`} fill={C.red} opacity="0.06" />

                  {/* FOV cone */}
                  <polygon
                    points={`${camX},${camY} ${coneEndX},${coneEndY} ${coneEndX},${sY(Math.min(personH, mountH * 0.6))}`}
                    fill={color} opacity="0.12"
                    stroke={color} strokeWidth="0.5" strokeOpacity="0.3"
                  />

                  {/* Tilt angle arc */}
                  <line x1={camX} y1={camY} x2={camX} y2={camY + arcR} stroke={C.textDim} strokeWidth="0.5" strokeDasharray="2" />
                  <path d={`M${camX},${camY + arcR} A${arcR},${arcR} 0 0,1 ${arcEndX},${arcEndY}`} fill="none" stroke={C.yellow} strokeWidth="0.7" />
                  <text x={camX + 12} y={camY + arcR - 2} fill={C.yellow} fontSize="6" fontFamily="IBM Plex Mono">{tilt}°</text>

                  {/* Camera body */}
                  {d.mount_type === 'ceiling' ? (
                    <g>
                      <rect x={camX - 6} y={camY - 2} width="12" height="4" rx="1" fill={color} />
                      <circle cx={camX} cy={camY + 5} r="4" fill={color} opacity="0.8" />
                    </g>
                  ) : (
                    <g>
                      <rect x={camX - 1} y={camY - 8} width="2" height="6" fill={C.textDim} />
                      <rect x={camX - 5} y={camY - 3} width="10" height="6" rx="2" fill={color} />
                    </g>
                  )}

                  {/* Person silhouette at target distance */}
                  <g opacity="0.4">
                    <ellipse cx={targetX} cy={personY - 2} rx="3" ry="3.5" fill={C.textMuted} />
                    <line x1={targetX} y1={personY + 1} x2={targetX} y2={groundY - 8} stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" />
                    <line x1={targetX - 5} y1={personY + 12} x2={targetX + 5} y2={personY + 12} stroke={C.textMuted} strokeWidth="1.2" strokeLinecap="round" />
                    <line x1={targetX} y1={groundY - 8} x2={targetX - 4} y2={groundY} stroke={C.textMuted} strokeWidth="1.2" strokeLinecap="round" />
                    <line x1={targetX} y1={groundY - 8} x2={targetX + 4} y2={groundY} stroke={C.textMuted} strokeWidth="1.2" strokeLinecap="round" />
                    <text x={targetX} y={groundY + 8} textAnchor="middle" fill={C.textDim} fontSize="5.5" fontFamily="IBM Plex Mono">5&apos;8&quot;</text>
                  </g>

                  {/* Labels */}
                  <text x={camX} y={camY - 12} textAnchor="middle" fill={C.textDim} fontSize="7" fontFamily="IBM Plex Mono">{mountH}ft</text>
                  <text x={(camX + targetX) / 2} y={groundY + 9} textAnchor="middle" fill={C.textDim} fontSize="7" fontFamily="IBM Plex Mono">{targetD}ft</text>

                  {/* Distance markers */}
                  <line x1={camX} y1={groundY + 3} x2={targetX} y2={groundY + 3} stroke={C.textDim} strokeWidth="0.5" />
                  <line x1={camX} y1={groundY + 1} x2={camX} y2={groundY + 5} stroke={C.textDim} strokeWidth="0.5" />
                  <line x1={targetX} y1={groundY + 1} x2={targetX} y2={groundY + 5} stroke={C.textDim} strokeWidth="0.5" />
                </svg>
              </div>
            )
          })()}
        </Section>

        {/* ---- MOUNTING ACCESSORIES (all categories) ---- */}
        {(() => {
          const formFactor = prop(d, 'sub_type', d.category) as string
          const mountType = (d.mount_type || 'wall') as 'ceiling' | 'wall' | 'pole' | 'pendant'
          const environment = prop(d, 'environment', 'indoor') as 'indoor' | 'outdoor' | 'indoor_outdoor'
          const ipRating = prop(d, 'ip_rating', '') as string
          const weightKg = Number(prop(d, 'weight_kg', 0)) || undefined
          const diameterMm = Number(prop(d, 'diameter_mm', 0)) || undefined
          let mountResult: MountCalcOutput | null = null
          try {
            mountResult = calculateMountRequirements({ formFactor, mountType, environment, ipRating, weightKg, diameterMm })
          } catch { /* engine didn't run */ }
          if (!mountResult || mountResult.mounts.length === 0) return null

          const surfaceType = prop(d, 'surface_type', '') as string
          const SURFACE_NOTES: Record<string, string> = {
            concrete: 'Use tapcon anchors or concrete wedge bolts',
            drywall: 'Use toggle bolts or backing plate — no drywall screws for cameras',
            wood: 'Use lag bolts or wood screws with pre-drill',
            metal: 'Use self-tapping TEK screws or welded bracket',
            brick: 'Use masonry anchors with hammer drill',
            stucco: 'Drill through stucco to substrate — sleeve anchors recommended',
            't-bar_ceiling': 'Use T-bar clip or bridge mount — do not cut tile',
            plaster: 'Toggle bolt through plaster to framing',
          }

          return (
            <Section title="Mounting Accessories" defaultOpen={true}>
              {mountResult.mounts.filter(m => m.compatible).map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '3px 0' }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', marginTop: 3, flexShrink: 0,
                    background: m.required ? C.green : C.textDim,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.text }}>{m.label}</div>
                    {m.notes && <div style={{ fontSize: 9, color: C.textDim, marginTop: 1 }}>{m.notes}</div>}
                  </div>
                  <span style={{ fontSize: 8, color: m.required ? C.green : C.textDim, fontWeight: 600, flexShrink: 0 }}>
                    {m.required ? 'REQ' : 'OPT'}
                  </span>
                </div>
              ))}

              {/* Lift warning */}
              {mountResult.liftRequired && (
                <div style={{
                  marginTop: 6, padding: '4px 8px', background: 'rgba(234,179,8,0.08)',
                  border: '1px solid rgba(234,179,8,0.25)', borderRadius: 4,
                  fontSize: 9, color: C.yellow,
                }}>
                  Lift / ladder required — mount height &gt; 12ft
                </div>
              )}

              {/* Surface note */}
              {surfaceType && SURFACE_NOTES[surfaceType] && (
                <div style={{
                  marginTop: 6, padding: '4px 8px', background: 'rgba(59,130,246,0.06)',
                  border: `1px solid rgba(59,130,246,0.2)`, borderRadius: 4,
                  fontSize: 9, color: C.accent,
                }}>
                  <span style={{ fontWeight: 600 }}>{surfaceType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}:</span>{' '}
                  {SURFACE_NOTES[surfaceType]}
                </div>
              )}

              {/* Missing fields */}
              {mountResult.missingFields.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 9, color: C.textDim }}>
                  Missing: {mountResult.missingFields.join(', ')}
                </div>
              )}
            </Section>
          )
        })()}

        {/* ---- CCTV: Device Specs ---- */}
        {isCctv(cat) && (
          <Section title="Device Specs (Library)" defaultOpen={false}>
            <Field label="Focal Length" value={prop(d, 'focal_length', '\u2014') + ' mm'} />
            <Field label="Sensor Size" value={prop(d, 'sensor_size', '\u2014')} />
            <Field label="Max Resolution" value={prop(d, 'max_resolution', '\u2014')} />
            <Field label="IR Range" value={prop(d, 'ir_range', '\u2014')} />
            <Field label="PoE Class" value={prop(d, 'poe_class', '\u2014')} />
            <Field label="Max Power" value={prop(d, 'max_power', '\u2014')} />
            <Field label="IP Rating" value={prop(d, 'ip_rating', '\u2014')} />
          </Section>
        )}

        {/* ---- CCTV: FOV Calculation ---- */}
        {isCctv(cat) && (
          <Section title="FOV Calculation" defaultOpen={true}>
            <Field label="PPF at Target" value={ppf || '\u2014'} color={ppfColor} />
            <Field label="DORI" value={prop(d, 'dori', '\u2014')} />
            <Field label="H-FOV" value={prop(d, 'h_fov', 0) ? prop(d, 'h_fov', 0) + '\u00B0' : '\u2014'} />
            <Field label="V-FOV" value={prop(d, 'v_fov', 0) ? prop(d, 'v_fov', 0) + '\u00B0' : '\u2014'} />
            <Field label="Scene Width" value={prop(d, 'scene_width', 0) ? prop(d, 'scene_width', 0) + ' ft' : '\u2014'} />

            {/* PPF Quality Reference Chart */}
            <div style={{ marginTop: 8, fontSize: 9 }}>
              <SubLabel text="PPF Quality Reference" />
              {PPF_CHART.map((row, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', opacity: ppf >= row.min ? 1 : 0.35 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 1, background: row.color, flexShrink: 0 }} />
                  <span style={{ color: C.textDim, width: 30, textAlign: 'right', fontFamily: "'IBM Plex Mono'" }}>{row.min}+</span>
                  <span style={{ color: ppf >= row.min ? C.text : C.textDim }}>{row.label}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ---- CCTV: Programming ---- */}
        {isCctv(cat) && (
          <Section title="Programming" defaultOpen={false}>
            <Field label="Codec" value={prop(d, 'codec', 'H.265')} editable fieldKey="codec" onBlurSave={saveFieldFromBlur} />
            <Field label="Smart Codec" value={getSmartCodecLabel(manufacturer)} />
            <Field label="Stream" value={prop(d, 'stream_type', 'Main')} editable fieldKey="stream_type" onBlurSave={saveFieldFromBlur} />
            <Field label="FPS" value={prop(d, 'fps', '15')} editable fieldKey="fps" onBlurSave={saveFieldFromBlur} />
            <div style={{ height: 8 }} />
            <SubLabel text="Recording" />
            <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap' }}>
              {['Continuous', 'Motion', 'Motion + Object', 'No Recording'].map((m) => {
                const mKey = m.toLowerCase().replace(/\s\+\s/g, '_').replace(/\s/g, '_')
                const current = prop(d, 'recording_mode', 'continuous')
                const isActive = current === mKey
                return (
                  <button key={m} onClick={() => saveProp('recording_mode', mKey)}
                    style={{
                      padding: '3px 6px', fontSize: 8, fontWeight: 600, fontFamily: 'inherit',
                      background: isActive ? C.accentSubtle : C.bgActive,
                      color: isActive ? C.accent : C.textDim,
                      border: isActive ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                      borderRadius: 3, cursor: 'pointer',
                    }}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
            <Field label="Retention" value={prop(d, 'retention_days', '30') + ' days'} editable fieldKey="retention_days" onBlurSave={saveFieldFromBlur} />
            <div style={{ height: 8 }} />
            <SubLabel text="Network" />
            <Field label="IP Address" value={prop(d, 'ip_address', '\u2014')} editable fieldKey="ip_address" onBlurSave={saveFieldFromBlur} />
            <Field label="Subnet" value={prop(d, 'subnet', '\u2014')} editable fieldKey="subnet" onBlurSave={saveFieldFromBlur} />
            <Field label="Gateway" value={prop(d, 'gateway', '\u2014')} editable fieldKey="gateway" onBlurSave={saveFieldFromBlur} />
            <Field label="DNS" value={prop(d, 'dns', '\u2014')} editable fieldKey="dns" onBlurSave={saveFieldFromBlur} />
          </Section>
        )}

        {/* ---- ACS: Lock / Reader / Controller ---- */}
        {isAcs(cat) && (
          <Section title="Access Control" defaultOpen={true}>
            <Field label="Lock Type" value={prop(d, 'lock_type', '\u2014')} editable fieldKey="lock_type" onBlurSave={saveFieldFromBlur} />
            <Field label="Lock Manufacturer" value={prop(d, 'lock_manufacturer', '\u2014')} editable fieldKey="lock_manufacturer" onBlurSave={saveFieldFromBlur} />
            <Field label="Reader Protocol" value={prop(d, 'reader_protocol', '\u2014')} editable fieldKey="reader_protocol" onBlurSave={saveFieldFromBlur} />
            <Field label="Controller" value={prop(d, 'controller_brand', '\u2014')} editable fieldKey="controller_brand" onBlurSave={saveFieldFromBlur} />
            <Field label="Controller Model" value={prop(d, 'controller_model', '\u2014')} editable fieldKey="controller_model" onBlurSave={saveFieldFromBlur} />
            <Field label="Door Type" value={prop(d, 'door_type', '\u2014')} editable fieldKey="door_type" onBlurSave={saveFieldFromBlur} />
            <Field label="Has DPS" value={prop(d, 'has_dps', '\u2014')} editable fieldKey="has_dps" onBlurSave={saveFieldFromBlur} />
            <Field label="Has REX" value={prop(d, 'has_rex', '\u2014')} editable fieldKey="has_rex" onBlurSave={saveFieldFromBlur} />
            <Field label="ADA Required" value={prop(d, 'has_ada', '\u2014')} editable fieldKey="has_ada" onBlurSave={saveFieldFromBlur} />
          </Section>
        )}

        {/* ---- NETWORK: Ports / PoE / VLAN ---- */}
        {isNetwork(cat) && (
          <Section title="Network" defaultOpen={true}>
            <Field label="Port Count" value={prop(d, 'port_count', '\u2014')} editable fieldKey="port_count" onBlurSave={saveFieldFromBlur} />
            <Field label="PoE Budget (W)" value={prop(d, 'poe_budget_watts', '\u2014')} editable fieldKey="poe_budget_watts" onBlurSave={saveFieldFromBlur} />
            <Field label="PoE Standard" value={prop(d, 'poe_standard', '\u2014')} editable fieldKey="poe_standard" onBlurSave={saveFieldFromBlur} />
            <Field label="Uplink Speed" value={prop(d, 'uplink_speed', '\u2014')} editable fieldKey="uplink_speed" onBlurSave={saveFieldFromBlur} />
            <Field label="Management IP" value={prop(d, 'management_ip', '\u2014')} editable fieldKey="management_ip" onBlurSave={saveFieldFromBlur} />
            <Field label="VLAN" value={prop(d, 'vlan', '\u2014')} editable fieldKey="vlan" onBlurSave={saveFieldFromBlur} />
            <Field label="Rack Unit (RU)" value={prop(d, 'rack_unit', '\u2014')} editable fieldKey="rack_unit" onBlurSave={saveFieldFromBlur} />
          </Section>
        )}

        {/* ---- AV Section ---- */}
        {cat === 'av' || cat === 'speaker' || cat === 'intercom' ? (
          <Section title="AV" defaultOpen={true}>
            <Field label="Signal Type" value={prop(d, 'signal_type', '\u2014')} editable fieldKey="signal_type" onBlurSave={saveFieldFromBlur} />
            <Field label="Impedance" value={prop(d, 'impedance', '\u2014')} editable fieldKey="impedance" onBlurSave={saveFieldFromBlur} />
            <Field label="Power Rating (W)" value={prop(d, 'power_rating', '\u2014')} editable fieldKey="power_rating" onBlurSave={saveFieldFromBlur} />
            <Field label="Coverage Area" value={prop(d, 'coverage_area', '\u2014')} editable fieldKey="coverage_area" onBlurSave={saveFieldFromBlur} />
          </Section>
        ) : null}

        {/* ---- WIRING (all categories) ---- */}
        <Section title="Wiring" defaultOpen={true}>
          <Field label="MDF/IDF" value={prop(d, 'mdf_idf', '\u2014')} editable fieldKey="mdf_idf" onBlurSave={saveFieldFromBlur} />
          <Field label="Switch" value={prop(d, 'switch_name', '\u2014')} editable fieldKey="switch_name" onBlurSave={saveFieldFromBlur} />
          <Field label="Port" value={prop(d, 'port_number', '\u2014')} editable fieldKey="port_number" onBlurSave={saveFieldFromBlur} />
          <Field label="Cable Type" value={prop(d, 'cable_type', 'Cat6')} editable fieldKey="cable_type" onBlurSave={saveFieldFromBlur} />
          <Field label="Cable Length" value={prop(d, 'cable_length', '\u2014')} editable fieldKey="cable_length" onBlurSave={saveFieldFromBlur} />
        </Section>

        {/* ---- BILLING & ASSET (all categories) ---- */}
        <Section title="Billing & Asset" defaultOpen={false}>
          <Field label="Condition" value={d.condition || '\u2014'} editable fieldKey="condition" onBlurSave={saveFieldFromBlur} />
          <Field label="Asset Type" value={d.asset_type || 'capital'} editable fieldKey="asset_type" onBlurSave={saveFieldFromBlur} />
          <Field label="Billing" value={d.billing_type || 'one_time'} editable fieldKey="billing_type" onBlurSave={saveFieldFromBlur} />
        </Section>

        {/* ---- NOTES (all categories) ---- */}
        <Section title="Notes" defaultOpen={false}>
          <textarea
            placeholder="Add notes..."
            defaultValue={prop(d, 'notes', '')}
            key={d.id + '-notes'}
            onBlur={(e) => {
              if (e.target.value !== prop(d, 'notes', '')) saveProp('notes', e.target.value)
            }}
            style={{
              width: '100%', height: 60, background: C.bgActive,
              border: `1px solid ${C.border}`, borderRadius: 4, padding: 6,
              color: C.text, fontSize: 11, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
            }}
          />
        </Section>
      </div>

      {/* Actions footer */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
        <button onClick={() => onDuplicate?.(d.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '6px 0', fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
            color: C.textMuted, background: C.bgActive, border: `1px solid ${C.border}`,
            borderRadius: 4, cursor: 'pointer',
          }}
        >
          {ActionIcons.copy} <span>Duplicate</span>
        </button>
        <button onClick={() => onDelete?.(d.id)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '6px 0', fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
            color: C.red, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 4, cursor: 'pointer',
          }}
        >
          {ActionIcons.trash} <span>Delete</span>
        </button>
      </div>
    </div>
  )
}
