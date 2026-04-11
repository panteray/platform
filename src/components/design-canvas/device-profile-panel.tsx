'use client'
/**
 * DeviceProfilePanel — Full device lifecycle sidebar (D-Tools pattern).
 *
 * 540px wide, stacks left of the right panel.
 * Vertical nav: Device Profile, Installation, Configuration, Maintenance,
 *               Activity Log, Accessories, Notes
 *
 * Device Profile = merged Name + Profile + Photos
 * Installation = Field Installers + Mounting + Accessories + Cabling
 * Configuration = merged Functional + Config + Recording Profile cross-ref + Notes
 * Accessories = linked to mount calculator
 */

import React, { useState, useMemo, useCallback } from 'react'
import { X, Upload, FileImage, FileText, Link2, Plus, Pencil, Wrench, Zap } from 'lucide-react'
import { C } from './constants'
import type { DesignDevice, DesignMdfIdf } from '@/types/database'
import { calculateMountRequirements, type MountCalcInput } from '@/lib/calculators/mount-calculator'
import { CABLE_TYPES } from '@/lib/calculators/cable-estimator'

const NAV_ITEMS = [
  { id: 'profile', label: 'Device Profile' },
  { id: 'install', label: 'Installation' },
  { id: 'config', label: 'Configuration' },
  { id: 'maint', label: 'Maintenance' },
  { id: 'log', label: 'Activity Log' },
  { id: 'acc', label: 'Accessories' },
  { id: 'notes', label: 'Notes' },
] as const

type SectionId = (typeof NAV_ITEMS)[number]['id']

const RISK_LEVELS = [
  { key: 'low', label: 'Low', color: '#34c77b' },
  { key: 'medium', label: 'Medium', color: '#d4a726' },
  { key: 'high', label: 'High', color: '#e8853a' },
  { key: 'critical', label: 'Critical', color: '#e85454' },
] as const

interface Props {
  device: DesignDevice
  onClose: () => void
  onUpdateDevice: (id: string, updates: Record<string, unknown>) => void
  mdfIdfs?: DesignMdfIdf[]
  onChangeModel?: (id: string) => void
  cables?: Array<{ id: string; from_device_id?: string | null; to_device_id?: string | null; mdf_idf_id?: string | null; cable_type?: string; length_ft?: number; total_length_ft?: number }>
  onOpenHardwareCalc?: () => void
}

/* ─── Form Field Components ─── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, color: C.textDim, marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      {children}
    </div>
  )
}

function TextInput({ value, placeholder, onChange, type = 'text', readOnly }: {
  value: string; placeholder?: string; onChange: (v: string) => void; type?: string; readOnly?: boolean
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder} readOnly={readOnly}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '9px 12px', background: C.bgActive,
        border: `1px solid ${C.border}`, borderRadius: 7,
        color: C.text, fontSize: 12, fontFamily: "'Inter', 'Segoe UI', sans-serif",
        outline: 'none', opacity: readOnly ? 0.6 : 1,
      }}
    />
  )
}

function SelectInput({ value, options, onChange }: {
  value: string; options: { value: string; label: string }[]; onChange: (v: string) => void
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '9px 12px', background: C.bgActive,
        border: `1px solid ${C.border}`, borderRadius: 7,
        color: C.text, fontSize: 12, fontFamily: "'Inter', 'Segoe UI', sans-serif",
        outline: 'none', appearance: 'none' as const,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 32,
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function TextArea({ value, placeholder, onChange, rows = 2 }: {
  value: string; placeholder?: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <textarea
      value={value} placeholder={placeholder} rows={rows}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', padding: '9px 12px', background: C.bgActive,
        border: `1px solid ${C.border}`, borderRadius: 7,
        color: C.text, fontSize: 12, fontFamily: "'Inter', 'Segoe UI', sans-serif",
        outline: 'none', resize: 'vertical',
      }}
    />
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div>
}

function Divider() {
  return <div style={{ height: 1, background: C.borderSubtle, margin: '14px 0' }} />
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
      {children}
    </div>
  )
}

function AccRow({ name, qty, onEdit }: { name: string; qty: number; onEdit?: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
      background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 6,
    }}>
      <span style={{ flex: 1, fontSize: 11, color: C.text }}>{name}</span>
      <span style={{ fontSize: 10, color: C.textMuted, fontFamily: 'monospace' }}>Qty: {qty}</span>
      {onEdit && (
        <button onClick={onEdit} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 11 }}>
          <Pencil size={11} />
        </button>
      )}
    </div>
  )
}

function CalcLink({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '8px 12px',
      background: 'rgba(43,186,160,0.06)', border: '1px solid rgba(43,186,160,0.2)',
      borderRadius: 6, color: '#2bbaa0', fontSize: 10, fontWeight: 600, cursor: 'pointer',
      fontFamily: "'Inter', 'Segoe UI', sans-serif", width: '100%', textAlign: 'left',
    }}>
      {icon} {label}
    </button>
  )
}

/* ─── Component ─── */
export function DeviceProfilePanel({ device, onClose, onUpdateDevice, mdfIdfs, onChangeModel, cables, onOpenHardwareCalc }: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>('profile')
  const props = useMemo(() => (device.properties ?? {}) as Record<string, unknown>, [device.properties])

  const updateProp = useCallback((key: string, value: unknown) => {
    onUpdateDevice(device.id, { properties: { ...props, [key]: value } })
  }, [device.id, props, onUpdateDevice])

  const str = (key: string, fallback = '') => String(props[key] ?? fallback)
  const num = (key: string, fallback = 0) => Number(props[key]) || fallback

  return (
    <div style={{
      width: 540, height: '100%', background: C.bgSurface,
      borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'row', overflow: 'hidden', flexShrink: 0,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Nav */}
      <nav style={{
        width: 148, borderRight: `1px solid ${C.border}`, padding: '14px 0',
        overflowY: 'auto', flexShrink: 0,
        background: `linear-gradient(180deg, ${C.accentSubtle}, transparent)`,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: C.accent, padding: '0 14px 12px',
          borderBottom: `1px solid ${C.borderSubtle}`, marginBottom: 6,
          letterSpacing: 0.4, textTransform: 'uppercase',
        }}>Attributes</div>
        {NAV_ITEMS.map(item => {
          const active = activeSection === item.id
          return (
            <button key={item.id} onClick={() => setActiveSection(item.id)}
              style={{
                display: 'block', width: '100%', padding: '9px 14px', fontSize: 11,
                color: active ? C.accent : C.textDim,
                background: active ? C.accentSubtle : 'none',
                border: 'none', borderLeft: `3px solid ${active ? C.accent : 'transparent'}`,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                fontWeight: active ? 600 : 400,
              }}
            >{item.label}</button>
          )
        })}
      </nav>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px 22px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
            {NAV_ITEMS.find(n => n.id === activeSection)?.label}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', padding: 4, borderRadius: 6,
          }}><X size={15} /></button>
        </div>

        {/* ═══ Device Profile ═══ */}
        {activeSection === 'profile' && (
          <>
            {/* Photos */}
            <Field label="Files & Photos">
              <div style={{
                width: '100%', padding: 20, border: `1px dashed ${C.border}`, borderRadius: 8,
                background: C.bgActive, textAlign: 'center', cursor: 'pointer', marginBottom: 10,
              }}>
                <Upload size={20} style={{ color: C.textDim, margin: '0 auto 4px' }} />
                <div style={{ fontSize: 10, color: C.textDim }}>Drop files here or click to upload</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <PhotoBtn icon={<FileImage size={12} />} label="Import from Survey" primary />
                <PhotoBtn icon={<FileImage size={12} />} label="+ Image" />
                <PhotoBtn icon={<FileText size={12} />} label="+ PDF" />
              </div>
            </Field>
            <FieldRow>
              <Field label="ID"><TextInput value={device.label || ''} onChange={v => onUpdateDevice(device.id, { label: v })} /></Field>
              <Field label="Element Name"><TextInput value={str('element_name', device.category)} onChange={v => updateProp('element_name', v)} /></Field>
            </FieldRow>
            <Field label="Descriptive Label">
              <TextInput value={str('descriptive_label', `${device.label} — ${str('vendor')} ${str('model')}`)} onChange={v => updateProp('descriptive_label', v)} />
            </Field>
            <FieldRow>
              <Field label="Room # / Location"><TextInput value={str('room_location')} placeholder="Main Lobby" onChange={v => updateProp('room_location', v)} /></Field>
              <Field label="Installation Status">
                <SelectInput value={str('install_status', 'planned')} onChange={v => updateProp('install_status', v)} options={[
                  { value: 'planned', label: 'Planned' }, { value: 'in_place', label: 'In place' }, { value: 'removed', label: 'Removed' },
                ]} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Manufacturer"><TextInput value={str('vendor')} onChange={v => updateProp('vendor', v)} /></Field>
              <Field label="Model #">
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <TextInput value={str('model')} onChange={v => updateProp('model', v)} />
                  {onChangeModel && (
                    <button onClick={() => onChangeModel(device.id)} style={{
                      padding: '4px 8px', background: 'transparent', border: `1px solid ${C.border}`,
                      borderRadius: 4, color: C.accent, fontSize: 9, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}>Change</button>
                  )}
                </div>
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Device Price"><TextInput value={String(num('device_price'))} type="number" onChange={v => updateProp('device_price', Number(v))} /></Field>
              <Field label="Install Hours"><TextInput value={String(num('install_hours', 1.5))} type="number" onChange={v => updateProp('install_hours', Number(v))} /></Field>
            </FieldRow>
            {/* Risk Factor */}
            <Field label="Risk Factor">
              <div style={{ display: 'flex', gap: 4 }}>
                {RISK_LEVELS.map(r => {
                  const active = str('risk_factor', 'low') === r.key
                  return (
                    <button key={r.key} onClick={() => updateProp('risk_factor', r.key)}
                      style={{
                        flex: 1, padding: '5px 10px', fontSize: 9, fontWeight: 700, borderRadius: 5,
                        border: `1px solid ${active ? r.color : C.border}`,
                        background: active ? `${r.color}18` : 'transparent',
                        color: active ? r.color : C.textDim,
                        cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.3,
                      }}
                    >{r.label}</button>
                  )
                })}
              </div>
            </Field>
          </>
        )}

        {/* ═══ Installation ═══ */}
        {activeSection === 'install' && (
          <>
            {/* Field Installers */}
            <Field label="Field Installers">
              <div style={{ display: 'flex', gap: 4 }}>
                {[{ v: 'internal', l: 'Internal' }, { v: 'subcontractor', l: 'Subcontractor' }].map(opt => {
                  const active = str('field_installer', 'internal') === opt.v
                  return (
                    <button key={opt.v} onClick={() => updateProp('field_installer', opt.v)} style={{
                      flex: 1, padding: '6px 0', fontSize: 10, fontWeight: 600, borderRadius: 5,
                      border: `1px solid ${active ? '#34c77b' : C.border}`,
                      background: active ? 'rgba(52,199,123,0.1)' : 'transparent',
                      color: active ? '#34c77b' : C.textDim, cursor: 'pointer', fontFamily: 'inherit',
                    }}>{opt.l}</button>
                  )
                })}
              </div>
            </Field>

            <Divider />
            <SectionLabel>Mounting</SectionLabel>
            <FieldRow>
              <Field label="Mount Surface">
                <SelectInput value={str('mount_surface', 'open_frame_ceiling')} onChange={v => updateProp('mount_surface', v)} options={[
                  { value: 'open_frame_ceiling', label: 'Open Frame Ceiling' }, { value: 'drywall', label: 'Drywall' },
                  { value: 'concrete', label: 'Concrete' }, { value: 'exterior_wall', label: 'Exterior Wall' },
                  { value: 'metal_deck', label: 'Metal Deck' },
                ]} />
              </Field>
              <Field label="Mounting Type">
                <SelectInput value={str('mount_type', 'ceiling')} onChange={v => updateProp('mount_type', v)} options={[
                  { value: 'ceiling', label: 'Ceiling (no pole)' }, { value: 'wall', label: 'Wall bracket' },
                  { value: 'pole', label: 'Pole mount' }, { value: 'pendant', label: 'Pendant' },
                ]} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Mount Color">
                <SelectInput value={str('mount_color', 'white')} onChange={v => updateProp('mount_color', v)} options={[
                  { value: 'white', label: 'White' }, { value: 'black', label: 'Black' }, { value: 'ral_custom', label: 'RAL Custom' },
                ]} />
              </Field>
              <Field label="Mounting Conditions">
                <SelectInput value={str('mount_conditions', 'standard')} onChange={v => updateProp('mount_conditions', v)} options={[
                  { value: 'standard', label: 'Standard' }, { value: 'requires_lift', label: 'Requires lift' }, { value: 'hazardous', label: 'Hazardous' },
                ]} />
              </Field>
            </FieldRow>
            <Field label="Placement Description">
              <TextArea value={str('placement_desc')} placeholder="Above main entrance, centered on soffit..." onChange={v => updateProp('placement_desc', v)} />
            </Field>

            <Divider />
            <SectionLabel>Accessories (from Mount Calculator)</SectionLabel>
            {(() => {
              const mountInput: MountCalcInput = {
                formFactor: str('form') || device.category,
                mountType: (str('mount_type', 'ceiling') as 'ceiling' | 'wall' | 'pole' | 'pendant'),
                environment: (str('environment', 'indoor') as 'indoor' | 'outdoor' | 'indoor_outdoor'),
              }
              const mountResult = calculateMountRequirements(mountInput, num('install_height', 9))
              const customAccessories = (props.custom_accessories || []) as Array<{ name: string; qty: number }>
              return (
                <>
                  {mountResult.mounts.filter(m => m.compatible).map((m, i) => (
                    <AccRow key={i} name={m.label} qty={1} onEdit={() => {}} />
                  ))}
                  {mountResult.liftRequired && (
                    <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, padding: '4px 8px', marginTop: 4, background: 'rgba(239,68,68,0.08)', borderRadius: 3, border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={10} /> ⚠ LIFT REQUIRED — mount height &gt; 12ft
                    </div>
                  )}
                  {customAccessories.map((a, i) => (
                    <AccRow key={`custom-${i}`} name={a.name} qty={a.qty} onEdit={() => {
                      const updated = [...customAccessories]
                      updated.splice(i, 1)
                      updateProp('custom_accessories', updated)
                    }} />
                  ))}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button onClick={() => {
                      const name = prompt('Accessory name:')
                      if (!name) return
                      const updated = [...customAccessories, { name, qty: 1 }]
                      updateProp('custom_accessories', updated)
                    }} style={{
                      flex: 1, padding: '5px 0', fontSize: 9, fontWeight: 600, borderRadius: 4,
                      border: `1px dashed ${C.border}`, background: 'transparent',
                      color: C.textDim, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <Plus size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                      Add Accessory
                    </button>
                  </div>
                </>
              )
            })()}

            <Divider />
            <SectionLabel>Cabling</SectionLabel>
            {(() => {
              // Auto-populate from canvas cable if connected
              const connCable = cables?.find(c => c.from_device_id === device.id || c.to_device_id === device.id)
              const connMdf = connCable?.mdf_idf_id ? (mdfIdfs ?? []).find(m => m.id === connCable.mdf_idf_id) : null
              if (!connCable) return (
                <div style={{ padding: '6px 0', fontSize: 10, color: C.textDim, fontStyle: 'italic', marginBottom: 6 }}>
                  Not cabled — draw a cable on canvas to connect
                </div>
              )
              const cableLen = Math.round(connCable.total_length_ft || connCable.length_ft || 0)
              const cableType = connCable.cable_type || 'Cat6'
              const cableDef = CABLE_TYPES.find(ct => ct.type === cableType)
              const overMax = cableDef && cableLen > cableDef.maxLengthFt
              return (
                <>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, background: 'rgba(34,197,94,0.06)', borderRadius: 4, padding: '6px 8px', border: '1px solid rgba(34,197,94,0.15)' }}>
                    Connected — {cableType} · {cableLen} ft
                    {connMdf && <> · MDF: {connMdf.name}</>}
                  </div>
                  {overMax && (
                    <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, padding: '2px 8px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={9} /> Exceeds max cable length ({cableDef.maxLengthFt} ft for {cableType})
                    </div>
                  )}
                </>
              )
            })()}
            <FieldRow>
              <Field label="MDF / IDF">
                <SelectInput value={str('mdf_idf', '')} onChange={v => updateProp('mdf_idf', v)} options={[
                  { value: '', label: 'Select...' },
                  ...(mdfIdfs ?? []).map(m => ({ value: m.id, label: m.name })),
                ]} />
              </Field>
              <Field label="Cable Type"><TextInput value={str('cable_type', 'Cat6')} onChange={v => updateProp('cable_type', v)} placeholder="Cat6, Cat6a…" /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Switch"><TextInput value={str('switch_assignment')} onChange={v => updateProp('switch_assignment', v)} placeholder="SW-01" /></Field>
              <Field label="Port"><TextInput value={str('port_assignment')} onChange={v => updateProp('port_assignment', v)} placeholder="Port 1" /></Field>
            </FieldRow>
            <Field label="Cable Length (ft)"><TextInput value={String(num('cable_length'))} type="number" onChange={v => updateProp('cable_length', Number(v))} placeholder="125" /></Field>
          </>
        )}

        {/* ═══ Configuration ═══ */}
        {activeSection === 'config' && (
          <>
            <FieldRow>
              <Field label="Serial # / MAC"><TextInput value={str('serial_mac')} onChange={v => updateProp('serial_mac', v)} placeholder="AA:BB:CC:DD:EE:FF" /></Field>
              <Field label="Firmware"><TextInput value={str('firmware_version')} onChange={v => updateProp('firmware_version', v)} placeholder="v3.2.1" /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="IP Address"><TextInput value={str('ip_address')} onChange={v => updateProp('ip_address', v)} placeholder="192.168.1.100" /></Field>
              <Field label="Subnet"><TextInput value={str('subnet_mask')} onChange={v => updateProp('subnet_mask', v)} placeholder="255.255.255.0" /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Gateway"><TextInput value={str('gateway')} onChange={v => updateProp('gateway', v)} placeholder="192.168.1.1" /></Field>
              <Field label="VLAN"><TextInput value={str('vlan_id')} onChange={v => updateProp('vlan_id', v)} placeholder="100" /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Username"><TextInput value={str('device_username')} onChange={v => updateProp('device_username', v)} placeholder="admin" /></Field>
              <Field label="Password"><TextInput value={str('device_password')} onChange={v => updateProp('device_password', v)} placeholder="••••••••" type="password" /></Field>
            </FieldRow>
            <Divider />
            <FieldRow>
              <Field label="Recording Mode">
                <SelectInput value={str('recording_mode', 'continuous')} onChange={v => updateProp('recording_mode', v)} options={[
                  { value: 'continuous', label: 'Continuous' }, { value: 'motion', label: 'Motion' }, { value: 'motion_analytics', label: 'Motion+Analytics' },
                ]} />
              </Field>
              <Field label="Max Resolution">
                <SelectInput value={str('max_resolution', '5MP')} onChange={v => updateProp('max_resolution', v)} options={[
                  { value: '1080p', label: '1080p' }, { value: '4MP', label: '4MP' }, { value: '5MP', label: '5MP' }, { value: '4K', label: '4K' }, { value: '8K', label: '8K' },
                ]} />
              </Field>
            </FieldRow>
            <Field label="Analytics">
              <SelectInput value={str('analytics', 'none')} onChange={v => updateProp('analytics', v)} options={[
                { value: 'none', label: 'None' }, { value: 'people', label: 'People Detection' },
                { value: 'vehicle', label: 'Vehicle Detection' }, { value: 'lpr', label: 'License Plate' },
              ]} />
            </Field>

            {/* Recording Profile cross-reference */}
            <Divider />
            <SectionLabel>Recording Profile</SectionLabel>
            <div style={{
              padding: '8px 10px', background: C.bgActive, border: `1px solid ${C.border}`,
              borderRadius: 6, marginBottom: 8,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px', fontSize: 10 }}>
                <RecStat label="FPS" value={String(num('recording_fps', 30))} />
                <RecStat label="Codec" value={str('codec', 'H.265')} />
                <RecStat label="Smart Codec" value={str('smart_codec', 'Off')} />
                <RecStat label="Sub Stream" value={`${str('sub_stream', 'On')} (${num('sub_fps', 7)}fps)`} />
                <RecStat label="Schedule" value={str('recording_schedule', 'Continuous')} />
                <RecStat label="Retention" value={`${num('retention_days', 30)} days`} />
              </div>
            </div>
            <CalcLink icon={<Zap size={14} />} label="Open in Hardware Calculator" onClick={onOpenHardwareCalc} />

            {/* Config Notes */}
            <Divider />
            <Field label="Configuration Notes">
              <TextArea value={str('config_notes')} placeholder="Configuration notes, special settings, firmware update history..." rows={3} onChange={v => updateProp('config_notes', v)} />
            </Field>
          </>
        )}

        {/* ═══ Maintenance ═══ */}
        {activeSection === 'maint' && (
          <>
            <FieldRow>
              <Field label="Installed By"><TextInput value={str('installed_by')} placeholder="Tech name" onChange={v => updateProp('installed_by', v)} /></Field>
              <Field label="Install Date"><TextInput value={str('install_date')} type="date" onChange={v => updateProp('install_date', v)} /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Warranty Exp."><TextInput value={str('warranty_expiry')} type="date" onChange={v => updateProp('warranty_expiry', v)} /></Field>
              <Field label="End of Life"><TextInput value={str('end_of_life')} type="date" onChange={v => updateProp('end_of_life', v)} /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Maint. Frequency">
                <SelectInput value={str('maint_frequency', 'quarterly')} onChange={v => updateProp('maint_frequency', v)} options={[
                  { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'annually', label: 'Annually' },
                ]} />
              </Field>
              <Field label="Last Inspection"><TextInput value={str('last_inspection')} type="date" onChange={v => updateProp('last_inspection', v)} /></Field>
            </FieldRow>
            <Field label="Last Inspected By"><TextInput value={str('last_inspected_by')} placeholder="Name" onChange={v => updateProp('last_inspected_by', v)} /></Field>
          </>
        )}

        {/* ═══ Activity Log ═══ */}
        {activeSection === 'log' && (
          <>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>Activity log entries for this device.</div>
            {/* Placeholder entries — will be driven by DB */}
            <LogEntry date="Device placed on canvas" by="System" />
            <AddBtn label="+ Add Log" />
          </>
        )}

        {/* ═══ Accessories ═══ */}
        {activeSection === 'acc' && (
          <>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>
              Auto-populated from mount calculator based on form factor and mount type.
            </div>
            {(() => {
              const mountInput: MountCalcInput = {
                formFactor: str('form') || device.category,
                mountType: (str('mount_type', 'ceiling') as 'ceiling' | 'wall' | 'pole' | 'pendant'),
                environment: (str('environment', 'indoor') as 'indoor' | 'outdoor' | 'indoor_outdoor'),
              }
              const mountResult = calculateMountRequirements(mountInput, num('install_height', 9))
              const customAccessories = (props.custom_accessories || []) as Array<{ name: string; qty: number }>
              return (
                <>
                  <SectionLabel>Required</SectionLabel>
                  {mountResult.mounts.filter(m => m.required && m.compatible).map((m, i) => (
                    <AccRow key={`req-${i}`} name={m.label} qty={1} onEdit={() => {}} />
                  ))}
                  {mountResult.mounts.filter(m => m.required && m.compatible).length === 0 && (
                    <div style={{ fontSize: 10, color: C.textDim, padding: '4px 0', fontStyle: 'italic' }}>None required</div>
                  )}
                  <SectionLabel>Optional</SectionLabel>
                  {mountResult.mounts.filter(m => !m.required && m.compatible).map((m, i) => (
                    <AccRow key={`opt-${i}`} name={`${m.label}${m.notes ? ` — ${m.notes}` : ''}`} qty={1} onEdit={() => {}} />
                  ))}
                  {mountResult.liftRequired && (
                    <div style={{ fontSize: 9, color: '#f97316', fontWeight: 600, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={10} /> Lift required (height &gt; 12ft)
                    </div>
                  )}
                  {customAccessories.length > 0 && <SectionLabel>Custom</SectionLabel>}
                  {customAccessories.map((a, i) => (
                    <AccRow key={`custom-${i}`} name={a.name} qty={a.qty} onEdit={() => {
                      const updated = [...customAccessories]
                      updated.splice(i, 1)
                      updateProp('custom_accessories', updated)
                    }} />
                  ))}
                  <button onClick={() => {
                    const name = prompt('Accessory name:')
                    if (!name) return
                    const updated = [...customAccessories, { name, qty: 1 }]
                    updateProp('custom_accessories', updated)
                  }} style={{
                    width: '100%', padding: '5px 0', fontSize: 9, fontWeight: 600, borderRadius: 4,
                    border: `1px dashed ${C.border}`, background: 'transparent', marginTop: 6,
                    color: C.textDim, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <Plus size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    Add Custom Accessory
                  </button>
                </>
              )
            })()}
          </>
        )}

        {/* ═══ Notes ═══ */}
        {activeSection === 'notes' && (
          <TextArea
            value={str('device_notes')}
            placeholder="Device notes, observations, special instructions..."
            rows={8}
            onChange={v => updateProp('device_notes', v)}
          />
        )}
      </div>
    </div>
  )
}

/* ─── Small helpers ─── */

function PhotoBtn({ icon, label, primary }: { icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button style={{
      padding: '6px 12px', fontSize: 10, fontWeight: 600,
      border: `1px solid ${primary ? C.accent + '40' : C.border}`,
      borderRadius: 5,
      background: primary ? C.accentSubtle : C.bgPanel,
      color: primary ? C.accent : C.textMuted,
      cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>{icon} {label}</button>
  )
}

function AddBtn({ label }: { label: string }) {
  return (
    <button style={{
      marginTop: 10, padding: '7px 14px', fontSize: 10, fontWeight: 700,
      color: C.accent, background: C.accentSubtle,
      border: `1px solid ${C.accent}30`, borderRadius: 6,
      cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.3,
    }}>{label}</button>
  )
}

function RecStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: C.textDim }}>{label}: </span>
      <span style={{ color: C.text, fontWeight: 600, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{value}</span>
    </div>
  )
}

function LogEntry({ date, by }: { date: string; by: string }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px solid ${C.borderSubtle}` }}>
      <div style={{ fontSize: 9, color: C.textDim, fontFamily: 'monospace' }}>{by}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{date}</div>
    </div>
  )
}
