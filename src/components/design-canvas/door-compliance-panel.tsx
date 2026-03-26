'use client'

import React, { useState, useCallback } from 'react'
import { C } from './constants'
import { Section, Field, SubLabel } from './section'
import { ActionIcons } from './icons'
import {
  runAcsEngine,
  type AcsBuildInput,
  type LockType,
  type DoorType,
} from '@/lib/calculators/acs-calculator'
import type { DesignDevice } from '@/types/database'

// ---- Types ----

export interface DoorConfig {
  id: string
  name: string
  readers: ReaderConfig[]
  locks: LockConfig[]
  doorOpeners: AuxItem[]
  auxOutputs: AuxItem[]
  rexDevices: AuxItem[]
  contacts: AuxItem[]
  auxInputs: AuxItem[]
  externalTampers: AuxItem[]
}

interface ReaderConfig {
  id: string
  type: 'prox' | 'mobile' | 'biometric' | 'other'
  vendor: string
  model: string
  protocol: 'wiegand' | 'osdp'
  wire: string
  shielded: boolean
}

interface LockConfig {
  id: string
  type: 'strike' | 'rim_strike' | 'elr' | 'mag' | 'mortise'
  vendor: string
  model: string
  wire: string
  shielded: boolean
}

interface AuxItem {
  id: string
  label: string
  location: string
  purpose: string
}

// ---- Helpers ----

function genId(): string {
  return Math.random().toString(36).slice(2, 8)
}

function mapLockType(s?: string): LockType {
  if (!s) return 'other'
  const v = s.toLowerCase()
  if (v.includes('mag')) return 'maglock'
  if (v.includes('strike')) return 'electric_strike'
  if (v.includes('mortise')) return 'mortise'
  return 'other'
}

function mapDoorType(s?: string): DoorType {
  if (!s) return 'single'
  const v = s.toLowerCase()
  if (v.includes('mantrap')) return 'mantrap'
  if (v.includes('double')) return 'double'
  return 'single'
}

// ---- Capacity Meter ----

function CapacityMeter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0
  const color = pct >= 100 ? C.red : pct >= 75 ? C.yellow : C.green
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.textMuted, marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace", color: pct >= 100 ? C.red : C.text }}>
          {used} / {max}
        </span>
      </div>
      <div style={{ width: '100%', height: 4, background: C.bgActive, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.2s' }} />
      </div>
    </div>
  )
}

// ---- Toggle Chip Row ----

function ChipRow({ options, value, onSelect, multi }: {
  options: string[]
  value: string | string[]
  onSelect: (val: string) => void
  multi?: boolean
}) {
  const selected = Array.isArray(value) ? value : [value]
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
      {options.map((opt) => {
        const isActive = selected.includes(opt)
        return (
          <button key={opt} onClick={() => onSelect(opt)}
            style={{
              padding: '3px 6px', fontSize: 8, fontWeight: 600, fontFamily: 'inherit',
              background: isActive ? C.accentSubtle : C.bgActive,
              color: isActive ? C.accent : C.textDim,
              border: isActive ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
              borderRadius: 3, cursor: 'pointer',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// ---- Shielded Toggle ----

function ShieldedToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: C.textMuted, cursor: 'pointer', marginBottom: 4 }}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: C.accent, width: 12, height: 12, cursor: 'pointer' }} />
      Shielded
    </label>
  )
}

// ---- Add Item Button ----

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, width: '100%',
        padding: '4px 8px', fontSize: 9, fontWeight: 600, fontFamily: 'inherit',
        color: C.accent, background: 'transparent',
        border: `1px dashed ${C.border}`, borderRadius: 4, cursor: 'pointer',
        marginTop: 4,
      }}
    >
      {ActionIcons.plus} {label}
    </button>
  )
}

// ---- Main Panel ----

interface DoorControllerPanelProps {
  device: DesignDevice
  allDevices: DesignDevice[]
  onUpdateDevice?: (id: string, updates: Partial<DesignDevice>) => void
  onClose: () => void
}

export function DoorControllerPanel({ device, allDevices, onUpdateDevice, onClose }: DoorControllerPanelProps) {
  const d = device
  const p = (d.properties ?? {}) as Record<string, unknown>
  const subType = String(p.sub_type || '')
  const isController = subType === 'door_controller' || d.category === 'door_controller'

  // Door configs stored in properties.door_configs as JSON
  const [doorConfigs, setDoorConfigs] = useState<DoorConfig[]>(() => {
    const raw = p.door_configs
    if (Array.isArray(raw)) return raw as DoorConfig[]
    return []
  })

  // Controller capacity from device library specs
  const maxDoors = Number(p.max_doors || p.channel_capacity || 4)
  const maxReaders = Number(p.max_readers || maxDoors * 2)
  const maxOutputs = Number(p.max_outputs || 10)
  const maxInputs = Number(p.max_inputs || 16)
  const maxTampers = Number(p.max_tampers || 4)

  // Calculate used capacity
  const usedDoors = doorConfigs.length
  const usedReaders = doorConfigs.reduce((sum, dc) => sum + dc.readers.length, 0)
  const usedOutputs = doorConfigs.reduce((sum, dc) => sum + dc.locks.length + dc.doorOpeners.length + dc.auxOutputs.length, 0)
  const usedInputs = doorConfigs.reduce((sum, dc) => sum + dc.rexDevices.length + dc.contacts.length + dc.auxInputs.length, 0)
  const usedTampers = doorConfigs.reduce((sum, dc) => sum + dc.externalTampers.length, 0)

  // Persist door configs
  const saveDoorConfigs = useCallback((configs: DoorConfig[]) => {
    setDoorConfigs(configs)
    const existing = (d.properties ?? {}) as Record<string, unknown>
    onUpdateDevice?.(d.id, { properties: { ...existing, door_configs: configs } })
  }, [d, onUpdateDevice])

  // Add a new door
  const addDoor = useCallback(() => {
    const newDoor: DoorConfig = {
      id: genId(),
      name: `Door ${doorConfigs.length + 1}`,
      readers: [],
      locks: [],
      doorOpeners: [],
      auxOutputs: [],
      rexDevices: [],
      contacts: [],
      auxInputs: [],
      externalTampers: [],
    }
    saveDoorConfigs([...doorConfigs, newDoor])
  }, [doorConfigs, saveDoorConfigs])

  // Remove a door
  const removeDoor = useCallback((doorId: string) => {
    saveDoorConfigs(doorConfigs.filter((dc) => dc.id !== doorId))
  }, [doorConfigs, saveDoorConfigs])

  // Update a specific door config field
  const updateDoor = useCallback((doorId: string, updates: Partial<DoorConfig>) => {
    saveDoorConfigs(doorConfigs.map((dc) => dc.id === doorId ? { ...dc, ...updates } : dc))
  }, [doorConfigs, saveDoorConfigs])

  // Reader CRUD
  const addReader = useCallback((doorId: string) => {
    const door = doorConfigs.find((dc) => dc.id === doorId)
    if (!door) return
    const newReader: ReaderConfig = { id: genId(), type: 'prox', vendor: '', model: '', protocol: 'wiegand', wire: '22/6', shielded: false }
    updateDoor(doorId, { readers: [...door.readers, newReader] })
  }, [doorConfigs, updateDoor])

  const updateReader = useCallback((doorId: string, readerId: string, updates: Partial<ReaderConfig>) => {
    const door = doorConfigs.find((dc) => dc.id === doorId)
    if (!door) return
    updateDoor(doorId, { readers: door.readers.map((r) => r.id === readerId ? { ...r, ...updates } : r) })
  }, [doorConfigs, updateDoor])

  // Lock CRUD
  const addLock = useCallback((doorId: string) => {
    const door = doorConfigs.find((dc) => dc.id === doorId)
    if (!door) return
    const newLock: LockConfig = { id: genId(), type: 'strike', vendor: '', model: '', wire: '18/2', shielded: false }
    updateDoor(doorId, { locks: [...door.locks, newLock] })
  }, [doorConfigs, updateDoor])

  const updateLock = useCallback((doorId: string, lockId: string, updates: Partial<LockConfig>) => {
    const door = doorConfigs.find((dc) => dc.id === doorId)
    if (!door) return
    updateDoor(doorId, { locks: door.locks.map((l) => l.id === lockId ? { ...l, ...updates } : l) })
  }, [doorConfigs, updateDoor])

  // Aux item CRUD (generic for door openers, aux outputs, REX, contacts, aux inputs, tampers)
  const addAuxItem = useCallback((doorId: string, field: keyof DoorConfig) => {
    const door = doorConfigs.find((dc) => dc.id === doorId)
    if (!door) return
    const arr = door[field] as AuxItem[]
    const newItem: AuxItem = { id: genId(), label: '', location: '', purpose: '' }
    updateDoor(doorId, { [field]: [...arr, newItem] })
  }, [doorConfigs, updateDoor])

  // ACS compliance engine
  const firstDoor = doorConfigs[0]
  const firstLock = firstDoor?.locks[0]
  const acsInput: AcsBuildInput = {
    doorType: mapDoorType(String(p.door_type || 'single')),
    lockType: mapLockType(firstLock?.type),
    controllerDrawAmps: Number(p.controller_draw_amps || 0.5),
    lockDrawAmps: Number(p.lock_draw_amps || 0.3),
    hasAdo: !!p.has_ado,
    isMantrap: String(p.door_type || '').includes('mantrap'),
  }
  const acsOutput = runAcsEngine(acsInput)

  return (
    <div style={{
      width: 320, height: '100%', background: C.bgPanel, borderLeft: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 10, color: C.accent }}>
          {isController ? 'Door Controller' : 'Access Control'}
        </span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 2 }}>
          {ActionIcons.close}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Device label + model */}
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{d.label}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
            {String(p.manufacturer || '')} {String(p.model || '')}
          </div>
        </div>

        {/* Capacity meters (controller only) */}
        {isController && (
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Capacity</div>
            <CapacityMeter label="Doors" used={usedDoors} max={maxDoors} />
            <CapacityMeter label="Readers" used={usedReaders} max={maxReaders} />
            <CapacityMeter label="Outputs" used={usedOutputs} max={maxOutputs} />
            <CapacityMeter label="Inputs" used={usedInputs} max={maxInputs} />
            <CapacityMeter label="External Tampers" used={usedTampers} max={maxTampers} />
          </div>
        )}

        {/* Door configs */}
        {doorConfigs.map((door, idx) => (
          <Section key={door.id} title={door.name} defaultOpen={idx === 0}>
            {/* Door name */}
            <input
              defaultValue={door.name}
              key={door.id + '-name'}
              onBlur={(e) => { if (e.target.value !== door.name) updateDoor(door.id, { name: e.target.value }) }}
              style={{
                width: '100%', background: C.bgActive, border: `1px solid ${C.border}`,
                borderRadius: 4, padding: '4px 6px', color: C.text, fontSize: 11,
                fontWeight: 600, fontFamily: 'inherit', outline: 'none', marginBottom: 8,
              }}
            />

            {/* Readers */}
            <SubLabel text="Readers" />
            {door.readers.map((reader) => (
              <div key={reader.id} style={{ padding: 6, background: C.bg, borderRadius: 4, border: `1px solid ${C.borderSubtle}`, marginBottom: 4 }}>
                <SubLabel text="Type" />
                <ChipRow options={['Prox', 'Mobile', 'Biometric', 'Other']}
                  value={reader.type.charAt(0).toUpperCase() + reader.type.slice(1)}
                  onSelect={(v) => updateReader(door.id, reader.id, { type: v.toLowerCase() as ReaderConfig['type'] })} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 8, color: C.textDim, marginBottom: 1 }}>Vendor</div>
                    <input defaultValue={reader.vendor} key={reader.id + '-rv'}
                      onBlur={(e) => updateReader(door.id, reader.id, { vendor: e.target.value })}
                      style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 4px', color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 8, color: C.textDim, marginBottom: 1 }}>Model</div>
                    <input defaultValue={reader.model} key={reader.id + '-rm'}
                      onBlur={(e) => updateReader(door.id, reader.id, { model: e.target.value })}
                      style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 4px', color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                </div>
                <SubLabel text="Protocol" />
                <ChipRow options={['Wiegand', 'OSDP']} value={reader.protocol === 'osdp' ? 'OSDP' : 'Wiegand'}
                  onSelect={(v) => updateReader(door.id, reader.id, { protocol: v.toLowerCase() as 'wiegand' | 'osdp' })} />
                <SubLabel text="Wire" />
                <ChipRow options={['24/6', '22/6', '22/4', '18/6']} value={reader.wire}
                  onSelect={(v) => updateReader(door.id, reader.id, { wire: v })} />
                <ShieldedToggle value={reader.shielded} onChange={(v) => updateReader(door.id, reader.id, { shielded: v })} />
              </div>
            ))}
            <AddButton label="Add Reader" onClick={() => addReader(door.id)} />

            {/* Locks */}
            <div style={{ marginTop: 8 }}>
              <SubLabel text="Locks" />
              {door.locks.map((lock) => (
                <div key={lock.id} style={{ padding: 6, background: C.bg, borderRadius: 4, border: `1px solid ${C.borderSubtle}`, marginBottom: 4 }}>
                  <SubLabel text="Type" />
                  <ChipRow options={['Strike', 'RimStrike', 'ELR', 'Mag', 'Mortise']}
                    value={lock.type.charAt(0).toUpperCase() + lock.type.slice(1).replace('_', '')}
                    onSelect={(v) => updateLock(door.id, lock.id, { type: v.toLowerCase().replace('rimstrike', 'rim_strike') as LockConfig['type'] })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 8, color: C.textDim, marginBottom: 1 }}>Vendor</div>
                      <input defaultValue={lock.vendor} key={lock.id + '-lv'}
                        onBlur={(e) => updateLock(door.id, lock.id, { vendor: e.target.value })}
                        style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 4px', color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 8, color: C.textDim, marginBottom: 1 }}>Model</div>
                      <input defaultValue={lock.model} key={lock.id + '-lm'}
                        onBlur={(e) => updateLock(door.id, lock.id, { model: e.target.value })}
                        style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 4px', color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                  </div>
                  <SubLabel text="Wire" />
                  <ChipRow options={['22/2', '18/4', '18/2', '16/2']} value={lock.wire}
                    onSelect={(v) => updateLock(door.id, lock.id, { wire: v })} />
                  <ShieldedToggle value={lock.shielded} onChange={(v) => updateLock(door.id, lock.id, { shielded: v })} />
                </div>
              ))}
              <AddButton label="Add Lock" onClick={() => addLock(door.id)} />
            </div>

            {/* Door Openers */}
            <div style={{ marginTop: 8 }}>
              <SubLabel text="Door Openers" />
              {door.doorOpeners.map((item) => (
                <div key={item.id} style={{ padding: 4, background: C.bg, borderRadius: 4, border: `1px solid ${C.borderSubtle}`, marginBottom: 3, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  <input placeholder="Location" defaultValue={item.location}
                    style={{ background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 4px', color: C.text, fontSize: 9, fontFamily: 'inherit', outline: 'none' }} />
                  <input placeholder="Purpose" defaultValue={item.purpose}
                    style={{ background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 4px', color: C.text, fontSize: 9, fontFamily: 'inherit', outline: 'none' }} />
                </div>
              ))}
              <AddButton label="Add Door Opener" onClick={() => addAuxItem(door.id, 'doorOpeners')} />
            </div>

            {/* Auxiliary Outputs */}
            <div style={{ marginTop: 8 }}>
              <SubLabel text="Auxiliary Outputs" />
              <AddButton label="Add Auxiliary Output" onClick={() => addAuxItem(door.id, 'auxOutputs')} />
            </div>

            {/* REX Devices */}
            <div style={{ marginTop: 8 }}>
              <SubLabel text="Request to Exit (REX) Devices" />
              {door.rexDevices.map((item) => (
                <div key={item.id} style={{ padding: 4, background: C.bg, borderRadius: 4, border: `1px solid ${C.borderSubtle}`, marginBottom: 3, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  <input placeholder="Location" defaultValue={item.location}
                    style={{ background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 4px', color: C.text, fontSize: 9, fontFamily: 'inherit', outline: 'none' }} />
                  <input placeholder="Purpose" defaultValue={item.purpose}
                    style={{ background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 4px', color: C.text, fontSize: 9, fontFamily: 'inherit', outline: 'none' }} />
                </div>
              ))}
              <AddButton label="Add REX Device" onClick={() => addAuxItem(door.id, 'rexDevices')} />
            </div>

            {/* Contacts */}
            <div style={{ marginTop: 8 }}>
              <SubLabel text="Contacts" />
              {door.contacts.map((item) => (
                <div key={item.id} style={{ padding: 4, background: C.bg, borderRadius: 4, border: `1px solid ${C.borderSubtle}`, marginBottom: 3 }}>
                  <input placeholder="Location" defaultValue={item.location}
                    style={{ width: '100%', background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '3px 4px', color: C.text, fontSize: 9, fontFamily: 'inherit', outline: 'none' }} />
                </div>
              ))}
              <AddButton label="Add Contact" onClick={() => addAuxItem(door.id, 'contacts')} />
            </div>

            {/* Auxiliary Inputs */}
            <div style={{ marginTop: 8 }}>
              <SubLabel text="Auxiliary Inputs" />
              <AddButton label="Add Auxiliary Input" onClick={() => addAuxItem(door.id, 'auxInputs')} />
            </div>

            {/* External Tampers */}
            <div style={{ marginTop: 8 }}>
              <SubLabel text="External Tampers" />
              <AddButton label="Add Tamper" onClick={() => addAuxItem(door.id, 'externalTampers')} />
            </div>

            {/* Remove door button */}
            <button onClick={() => removeDoor(door.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                width: '100%', marginTop: 8, padding: '5px 0', fontSize: 9, fontWeight: 600, fontFamily: 'inherit',
                color: C.red, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 4, cursor: 'pointer',
              }}
            >
              {ActionIcons.trash} Remove Door
            </button>
          </Section>
        ))}

        {/* Add Door button (controller only) */}
        {isController && (
          <div style={{ padding: '8px 12px' }}>
            <button onClick={addDoor}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                width: '100%', padding: '8px 0', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                color: C.accent, background: C.accentSubtle,
                border: `1px solid ${C.accent}`, borderRadius: 4, cursor: 'pointer',
              }}
            >
              {ActionIcons.plus} Add Door
            </button>
            <div style={{ fontSize: 9, color: C.textDim, textAlign: 'center', marginTop: 4 }}>
              {usedDoors} of {maxDoors} channels used
            </div>
          </div>
        )}

        {/* Compliance summary */}
        {doorConfigs.length > 0 && (
          <Section title="Compliance" defaultOpen={false}>
            <div style={{
              padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, marginBottom: 6,
              background: acsOutput.compliance.violations.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
              color: acsOutput.compliance.violations.length > 0 ? C.red : C.green,
              border: `1px solid ${acsOutput.compliance.violations.length > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            }}>
              {acsOutput.compliance.violations.length > 0 ? 'Non-compliant' : 'Compliant'}
            </div>
            {acsOutput.compliance.violations.map((msg, i) => (
              <div key={`v-${i}`} style={{ fontSize: 9, color: C.red, padding: '3px 0', borderBottom: `1px solid ${C.borderSubtle}` }}>
                {msg}
              </div>
            ))}
            {acsOutput.compliance.notes.map((msg, i) => (
              <div key={`n-${i}`} style={{ fontSize: 9, color: C.yellow, padding: '3px 0', borderBottom: `1px solid ${C.borderSubtle}` }}>
                {msg}
              </div>
            ))}
            <div style={{ marginTop: 6 }}>
              <SubLabel text="Electrical Load" />
              <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
                <div>
                  <span style={{ color: C.textDim }}>Draw: </span>
                  <span style={{ color: C.text, fontWeight: 600 }}>{acsOutput.electrical.totalDrawAmps} A</span>
                </div>
                <div>
                  <span style={{ color: C.textDim }}>Min PSU: </span>
                  <span style={{ color: C.text, fontWeight: 600 }}>{acsOutput.electrical.minPsuAmps} A</span>
                </div>
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
