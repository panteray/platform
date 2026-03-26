'use client'

import { useState, useCallback } from 'react'
import { C } from './constants'
import type { DesignRackSlots, DesignMdfIdf } from '@/types/database'

interface RackElevationViewProps {
  designId: string
  racks: DesignRackSlots[]
  infrastructure: DesignMdfIdf[]
  onAddRack: (data: Record<string, unknown>) => Promise<unknown>
  onUpdateRack: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDeleteRack: (id: string) => Promise<unknown>
}

type Slot = DesignRackSlots['slots'][number]

const U_HEIGHT_PX = 22
const RACK_W = 280

const DEVICE_COLORS: Record<string, string> = {
  switch: '#8b5cf6', router: '#3b82f6', firewall: '#ef4444', server: '#6366f1',
  nvr: '#14b8a6', ups: '#f59e0b', patch_panel: '#64748b', pdu: '#a855f7', other: '#64748b',
}
const DEVICE_TYPES = ['switch', 'router', 'firewall', 'server', 'nvr', 'ups', 'patch_panel', 'pdu', 'other']
const DEVICE_LABELS: Record<string, string> = {
  switch: 'Switch', router: 'Router', firewall: 'Firewall', server: 'Server',
  nvr: 'NVR/DVR', ups: 'UPS', patch_panel: 'Patch Panel', pdu: 'PDU', other: 'Other',
}

const inputStyle: React.CSSProperties = {
  background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3,
  padding: '2px 6px', color: C.text, fontSize: 11, outline: 'none', width: '100%',
}
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'auto' as never }
const lblStyle: React.CSSProperties = { fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 2 }

/* Build occupancy map: which U positions are occupied by multi-RU devices */
function buildOccupied(slots: Slot[]): Set<number> {
  const occ = new Set<number>()
  for (const s of slots) {
    for (let u = s.u_position; u < s.u_position + (s.ru_height ?? 1); u++) {
      occ.add(u)
    }
  }
  return occ
}

export function RackElevationView({ designId, racks, infrastructure, onAddRack, onUpdateRack, onDeleteRack }: RackElevationViewProps) {
  const [selectedMdfIdf, setSelectedMdfIdf] = useState<string | null>(infrastructure.length > 0 ? infrastructure[0].id : null)
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null)
  const [editSlotU, setEditSlotU] = useState<number | null>(null)
  const [addSlotU, setAddSlotU] = useState<number | null>(null)

  /* Add-slot form state */
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('switch')
  const [newRuH, setNewRuH] = useState(1)
  const [newPoe, setNewPoe] = useState(0)
  const [newPower, setNewPower] = useState(0)
  const [newIsPatch, setNewIsPatch] = useState(false)

  const mdfIdfRacks = selectedMdfIdf ? racks.filter((r) => r.mdf_idf_id === selectedMdfIdf) : racks
  const selectedRack = selectedRackId ? racks.find((r) => r.id === selectedRackId) ?? null : null

  /* Helpers to mutate slots array and PATCH */
  const patchSlots = useCallback((rackId: string, newSlots: Slot[]) => {
    onUpdateRack(rackId, { slots: newSlots })
  }, [onUpdateRack])

  const handleAddSlot = (rack: DesignRackSlots) => {
    if (addSlotU === null) return
    const slots = [...(rack.slots ?? [])]
    slots.push({
      u_position: addSlotU,
      device_id: null,
      device_name: newName || `Device U${addSlotU}`,
      ru_height: newRuH,
      poe_draw_w: newPoe,
      power_draw_w: newPower,
      is_blank: false,
      is_patch_panel: newIsPatch,
    })
    patchSlots(rack.id, slots)
    setAddSlotU(null)
    setNewName(''); setNewType('switch'); setNewRuH(1); setNewPoe(0); setNewPower(0); setNewIsPatch(false)
  }

  const handleRemoveSlot = (rack: DesignRackSlots, uPos: number) => {
    const slots = (rack.slots ?? []).filter((s) => s.u_position !== uPos)
    patchSlots(rack.id, slots)
    setEditSlotU(null)
  }

  const handleUpdateSlot = (rack: DesignRackSlots, uPos: number, patch: Partial<Slot>) => {
    const slots = (rack.slots ?? []).map((s) => s.u_position === uPos ? { ...s, ...patch } : s)
    patchSlots(rack.id, slots)
  }

  const handleAddRack = () => {
    onAddRack({ mdf_idf_id: selectedMdfIdf, rack_name: `Rack ${mdfIdfRacks.length + 1}`, total_u: 42, slots: [] })
  }

  /* Per-rack stats */
  const rackStats = (rack: DesignRackSlots) => {
    const filled = (rack.slots ?? []).filter((s) => !s.is_blank)
    const usedU = filled.reduce((sum, s) => sum + (s.ru_height ?? 1), 0)
    const poe = filled.reduce((sum, s) => sum + (s.poe_draw_w ?? 0), 0)
    const power = filled.reduce((sum, s) => sum + (s.power_draw_w ?? 0), 0)
    return { devices: filled.length, usedU, poe, power }
  }

  /* Aggregate stats */
  const aggPoe = mdfIdfRacks.reduce((sum, r) => sum + rackStats(r).poe, 0)
  const aggPower = mdfIdfRacks.reduce((sum, r) => sum + rackStats(r).power, 0)
  const aggDevices = mdfIdfRacks.reduce((sum, r) => sum + rackStats(r).devices, 0)

  return (
    <div style={{ flex: 1, display: 'flex', background: C.bg, overflow: 'hidden' }}>
      {/* MDF/IDF selector */}
      <div style={{ width: 180, background: C.bgPanel, borderRight: `1px solid ${C.border}`, padding: '8px 0', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '4px 12px', fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>MDF / IDF</div>
        {infrastructure.map((node) => (
          <div key={node.id} onClick={() => { setSelectedMdfIdf(node.id); setSelectedRackId(null) }}
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 11, background: selectedMdfIdf === node.id ? C.accentSubtle : 'transparent', color: selectedMdfIdf === node.id ? C.accent : C.text, borderLeft: selectedMdfIdf === node.id ? `2px solid ${C.accent}` : '2px solid transparent' }}
            onMouseEnter={(e) => { if (selectedMdfIdf !== node.id) e.currentTarget.style.background = C.bgHover }}
            onMouseLeave={(e) => { if (selectedMdfIdf !== node.id) e.currentTarget.style.background = 'transparent' }}>
            {node.name}
            <div style={{ fontSize: 9, color: C.textDim }}>{racks.filter((r) => r.mdf_idf_id === node.id).length} rack(s)</div>
          </div>
        ))}
        {infrastructure.length === 0 && <div style={{ padding: 12, fontSize: 10, color: C.textDim }}>No MDF/IDF nodes. Add them on the Physical canvas first.</div>}
      </div>

      {/* Rack panels area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 16, padding: '8px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 11, flexShrink: 0, alignItems: 'center' }}>
          <span style={{ color: C.textDim }}>PoE: <span style={{ fontWeight: 600, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace", color: aggPoe > 740 ? C.red : C.green }}>{aggPoe}W</span></span>
          <span style={{ color: C.textDim }}>Power: <span style={{ fontWeight: 600, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace", color: C.text }}>{aggPower}W</span></span>
          <span style={{ color: C.textDim }}>Devices: <span style={{ fontWeight: 600, color: C.text }}>{aggDevices}</span></span>
          <span style={{ color: C.textDim }}>Racks: <span style={{ fontWeight: 600, color: C.text }}>{mdfIdfRacks.length}</span></span>
          <div style={{ flex: 1 }} />
          <button onClick={handleAddRack} style={{ padding: '3px 10px', fontSize: 10, borderRadius: 4, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}>+ Add Rack</button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Racks */}
          <div style={{ flex: 1, display: 'flex', gap: 20, padding: 16, overflow: 'auto' }}>
            {mdfIdfRacks.map((rack) => {
              const stats = rackStats(rack)
              const occupied = buildOccupied(rack.slots ?? [])
              const isSel = rack.id === selectedRackId
              return (
                <div key={rack.id} style={{ width: RACK_W, flexShrink: 0 }}>
                  {/* Rack header */}
                  <div onClick={() => { setSelectedRackId(rack.id); setEditSlotU(null); setAddSlotU(null) }}
                    style={{ fontSize: 11, fontWeight: 600, color: isSel ? C.accent : C.text, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, background: isSel ? C.accentSubtle : 'transparent' }}>
                    <span>{rack.rack_name}</span>
                    <span style={{ fontSize: 9, color: C.textDim, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{stats.usedU}/{rack.total_u}U</span>
                  </div>
                  {/* Per-rack stats */}
                  <div style={{ display: 'flex', gap: 8, fontSize: 9, color: C.textDim, marginBottom: 6, padding: '0 6px' }}>
                    <span>PoE <span style={{ color: stats.poe > 370 ? C.red : C.green, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{stats.poe}W</span></span>
                    <span>Power <span style={{ fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{stats.power}W</span></span>
                    <span>{stats.devices} dev</span>
                  </div>
                  {/* Rack body */}
                  <div style={{ border: `2px solid ${isSel ? C.accent : C.border}`, borderRadius: 4, background: C.bgPanel, transition: 'border-color 0.15s' }}>
                    {Array.from({ length: rack.total_u }, (_, i) => {
                      const uNum = i + 1
                      const slot = (rack.slots ?? []).find((s) => s.u_position === uNum)

                      /* Skip rows occupied by a multi-RU device starting above */
                      if (!slot && occupied.has(uNum)) return null

                      /* Occupied slot */
                      if (slot && !slot.is_blank) {
                        const h = (slot.ru_height ?? 1) * U_HEIGHT_PX
                        const deviceType = slot.is_patch_panel ? 'patch_panel' : 'other'
                        const color = DEVICE_COLORS[deviceType] || C.textMuted
                        const isSlotSel = isSel && editSlotU === uNum
                        return (
                          <div key={uNum} onClick={(e) => { e.stopPropagation(); setSelectedRackId(rack.id); setEditSlotU(uNum); setAddSlotU(null) }}
                            style={{ display: 'flex', height: h, borderBottom: `1px solid ${C.borderSubtle}`, background: isSlotSel ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.04)', cursor: 'pointer', transition: 'background 0.1s' }}
                            onMouseEnter={(e) => { if (!isSlotSel) e.currentTarget.style.background = 'rgba(59,130,246,0.08)' }}
                            onMouseLeave={(e) => { if (!isSlotSel) e.currentTarget.style.background = 'rgba(59,130,246,0.04)' }}>
                            <div style={{ width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: C.textDim, borderRight: `1px solid ${C.borderSubtle}`, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace", flexShrink: 0 }}>
                              {slot.ru_height > 1 ? `${uNum}-${uNum + slot.ru_height - 1}` : uNum}
                            </div>
                            <div style={{ width: 4, background: color, flexShrink: 0 }} />
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 6px', gap: 6, overflow: 'hidden' }}>
                              <span style={{ fontSize: 9, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.device_name || 'Device'}</span>
                              {slot.ru_height > 1 && <span style={{ fontSize: 7, color: C.textDim, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace", flexShrink: 0 }}>{slot.ru_height}U</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px', flexShrink: 0 }}>
                              {(slot.poe_draw_w ?? 0) > 0 && <span style={{ fontSize: 7, color: C.green, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{slot.poe_draw_w}W</span>}
                              {(slot.power_draw_w ?? 0) > 0 && <span style={{ fontSize: 7, color: C.textDim, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{slot.power_draw_w}W</span>}
                            </div>
                          </div>
                        )
                      }

                      /* Empty slot */
                      const isAddTarget = isSel && addSlotU === uNum
                      return (
                        <div key={uNum}
                          onClick={(e) => { e.stopPropagation(); setSelectedRackId(rack.id); setAddSlotU(uNum); setEditSlotU(null) }}
                          style={{ display: 'flex', height: U_HEIGHT_PX, borderBottom: `1px solid ${C.borderSubtle}`, cursor: 'pointer', background: isAddTarget ? 'rgba(34,197,94,0.08)' : 'transparent' }}
                          onMouseEnter={(e) => { if (!isAddTarget) e.currentTarget.style.background = C.bgHover }}
                          onMouseLeave={(e) => { if (!isAddTarget) e.currentTarget.style.background = isAddTarget ? 'rgba(34,197,94,0.08)' : 'transparent' }}>
                          <div style={{ width: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: C.textDim, borderRight: `1px solid ${C.borderSubtle}`, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{uNum}</div>
                          <div style={{ flex: 1, padding: '0 6px', display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: 8, color: C.textDim, opacity: 0.3 }}>Empty</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {mdfIdfRacks.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: C.textDim, flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12 }}>No racks in this MDF/IDF</div>
                <div style={{ fontSize: 10 }}>Click + Add Rack to get started</div>
              </div>
            )}
          </div>

          {/* Right panel — rack properties / slot editor */}
          {selectedRack && (
            <div style={{ width: 250, borderLeft: `1px solid ${C.border}`, background: C.bgPanel, overflow: 'auto', flexShrink: 0 }}>
              {/* Rack properties */}
              {editSlotU === null && addSlotU === null && (
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Rack Properties</span>
                    <button onClick={() => setSelectedRackId(null)} style={{ fontSize: 10, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
                  </div>
                  <div>
                    <div style={lblStyle}>Name</div>
                    <input defaultValue={selectedRack.rack_name} style={inputStyle}
                      onBlur={(e) => onUpdateRack(selectedRack.id, { rack_name: e.target.value })} />
                  </div>
                  <div>
                    <div style={lblStyle}>Total U</div>
                    <input type="number" defaultValue={selectedRack.total_u} min={1} max={52} style={{ ...inputStyle, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}
                      onBlur={(e) => { const n = Number(e.target.value); if (n > 0 && n <= 52) onUpdateRack(selectedRack.id, { total_u: n }) }} />
                  </div>
                  <div>
                    <div style={lblStyle}>Location</div>
                    <input defaultValue={selectedRack.rack_location ?? ''} placeholder="e.g. Server Room A" style={inputStyle}
                      onBlur={(e) => onUpdateRack(selectedRack.id, { rack_location: e.target.value || null })} />
                  </div>
                  <div>
                    <div style={lblStyle}>MDF/IDF</div>
                    <select defaultValue={selectedRack.mdf_idf_id ?? ''} style={selectStyle}
                      onChange={(e) => onUpdateRack(selectedRack.id, { mdf_idf_id: e.target.value || null })}>
                      <option value="">Unassigned</option>
                      {infrastructure.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                  {/* Usage summary */}
                  {(() => { const s = rackStats(selectedRack); return (
                    <div style={{ padding: 8, background: C.bgActive, borderRadius: 4, fontSize: 10, color: C.textDim, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div>Utilization: <span style={{ color: C.text, fontWeight: 600 }}>{s.usedU}/{selectedRack.total_u}U</span> ({Math.round(s.usedU / selectedRack.total_u * 100)}%)</div>
                      <div>PoE Draw: <span style={{ color: s.poe > 370 ? C.red : C.green, fontWeight: 600 }}>{s.poe}W</span></div>
                      <div>Power Draw: <span style={{ color: C.text, fontWeight: 600 }}>{s.power}W</span></div>
                    </div>
                  )})()}
                  <button onClick={() => { onDeleteRack(selectedRack.id); setSelectedRackId(null) }}
                    style={{ padding: '4px 0', fontSize: 10, color: C.red, background: 'transparent', border: `1px solid ${C.red}`, borderRadius: 4, cursor: 'pointer', marginTop: 4 }}>
                    Delete Rack
                  </button>
                </div>
              )}

              {/* Add slot form */}
              {addSlotU !== null && (
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Add Device at U{addSlotU}</span>
                    <button onClick={() => setAddSlotU(null)} style={{ fontSize: 10, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
                  </div>
                  <div>
                    <div style={lblStyle}>Device Name</div>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Cisco 9300" style={inputStyle} />
                  </div>
                  <div>
                    <div style={lblStyle}>Type</div>
                    <select value={newType} onChange={(e) => { setNewType(e.target.value); setNewIsPatch(e.target.value === 'patch_panel') }} style={selectStyle}>
                      {DEVICE_TYPES.map((t) => <option key={t} value={t}>{DEVICE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={lblStyle}>RU Height</div>
                      <input type="number" value={newRuH} min={1} max={10} onChange={(e) => setNewRuH(Number(e.target.value))} style={{ ...inputStyle, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={lblStyle}>PoE (W)</div>
                      <input type="number" value={newPoe} min={0} onChange={(e) => setNewPoe(Number(e.target.value))} style={{ ...inputStyle, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={lblStyle}>Power (W)</div>
                      <input type="number" value={newPower} min={0} onChange={(e) => setNewPower(Number(e.target.value))} style={{ ...inputStyle, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.text, cursor: 'pointer' }}>
                    <input type="checkbox" checked={newIsPatch} onChange={(e) => setNewIsPatch(e.target.checked)} />
                    Patch Panel
                  </label>
                  <button onClick={() => handleAddSlot(selectedRack)}
                    style={{ padding: '5px 0', fontSize: 10, fontWeight: 600, color: '#fff', background: C.accent, border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    Place Device
                  </button>
                </div>
              )}

              {/* Edit slot */}
              {editSlotU !== null && (() => {
                const slot = (selectedRack.slots ?? []).find((s) => s.u_position === editSlotU)
                if (!slot) return null
                return (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>U{editSlotU} — {slot.device_name || 'Device'}</span>
                      <button onClick={() => setEditSlotU(null)} style={{ fontSize: 10, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
                    </div>
                    <div>
                      <div style={lblStyle}>Device Name</div>
                      <input defaultValue={slot.device_name ?? ''} style={inputStyle}
                        onBlur={(e) => handleUpdateSlot(selectedRack, editSlotU, { device_name: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={lblStyle}>RU Height</div>
                        <input type="number" defaultValue={slot.ru_height ?? 1} min={1} max={10} style={{ ...inputStyle, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}
                          onBlur={(e) => handleUpdateSlot(selectedRack, editSlotU, { ru_height: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={lblStyle}>PoE (W)</div>
                        <input type="number" defaultValue={slot.poe_draw_w ?? 0} min={0} style={{ ...inputStyle, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}
                          onBlur={(e) => handleUpdateSlot(selectedRack, editSlotU, { poe_draw_w: Number(e.target.value) })} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={lblStyle}>Power (W)</div>
                        <input type="number" defaultValue={slot.power_draw_w ?? 0} min={0} style={{ ...inputStyle, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}
                          onBlur={(e) => handleUpdateSlot(selectedRack, editSlotU, { power_draw_w: Number(e.target.value) })} />
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.text, cursor: 'pointer' }}>
                      <input type="checkbox" defaultChecked={slot.is_patch_panel}
                        onChange={(e) => handleUpdateSlot(selectedRack, editSlotU, { is_patch_panel: e.target.checked })} />
                      Patch Panel
                    </label>
                    <button onClick={() => handleRemoveSlot(selectedRack, editSlotU)}
                      style={{ padding: '4px 0', fontSize: 10, color: C.red, background: 'transparent', border: `1px solid ${C.red}`, borderRadius: 4, cursor: 'pointer', marginTop: 4 }}>
                      Remove from Rack
                    </button>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
