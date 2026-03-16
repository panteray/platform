'use client'

import { useState } from 'react'
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

const U_HEIGHT_PX = 18

export function RackElevationView({ designId, racks, infrastructure, onAddRack, onUpdateRack, onDeleteRack }: RackElevationViewProps) {
  const [selectedMdfIdf, setSelectedMdfIdf] = useState<string | null>(infrastructure.length > 0 ? infrastructure[0].id : null)

  const mdfIdfRacks = selectedMdfIdf ? racks.filter((r) => r.mdf_idf_id === selectedMdfIdf) : racks
  const totalPoeDraw = mdfIdfRacks.reduce((sum, r) => (r.slots ?? []).reduce((s, slot) => s + (slot.poe_draw_w ?? 0), sum), 0)
  const totalPower = mdfIdfRacks.reduce((sum, r) => (r.slots ?? []).reduce((s, slot) => s + (slot.power_draw_w ?? 0), sum), 0)
  const totalSlots = mdfIdfRacks.reduce((sum, r) => (r.slots ?? []).filter((s) => !s.is_blank).length + sum, 0)

  return (
    <div style={{ flex: 1, display: 'flex', background: C.bg, overflow: 'hidden' }}>
      {/* MDF/IDF selector */}
      <div style={{ width: 180, background: C.bgPanel, borderRight: `1px solid ${C.border}`, padding: '8px 0', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ padding: '4px 12px', fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>MDF / IDF</div>
        {infrastructure.map((node) => (
          <div key={node.id} onClick={() => setSelectedMdfIdf(node.id)} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 11, background: selectedMdfIdf === node.id ? C.accentSubtle : 'transparent', color: selectedMdfIdf === node.id ? C.accent : C.text, borderLeft: selectedMdfIdf === node.id ? `2px solid ${C.accent}` : '2px solid transparent' }}
            onMouseEnter={(e) => { if (selectedMdfIdf !== node.id) e.currentTarget.style.background = C.bgHover }}
            onMouseLeave={(e) => { if (selectedMdfIdf !== node.id) e.currentTarget.style.background = 'transparent' }}>
            {node.name}
          </div>
        ))}
        {infrastructure.length === 0 && <div style={{ padding: 12, fontSize: 10, color: C.textDim }}>No MDF/IDF nodes yet.</div>}
      </div>

      {/* Rack panels */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <div style={{ display: 'flex', gap: 16, padding: '8px 16px', borderBottom: `1px solid ${C.border}`, fontSize: 11, flexShrink: 0 }}>
          <span style={{ color: C.textDim }}>PoE: <span style={{ fontWeight: 600, color: totalPoeDraw > 740 ? C.red : C.green }}>{totalPoeDraw}W</span></span>
          <span style={{ color: C.textDim }}>Power: <span style={{ fontWeight: 600, color: C.text }}>{totalPower}W</span></span>
          <span style={{ color: C.textDim }}>Devices: <span style={{ fontWeight: 600, color: C.text }}>{totalSlots}</span></span>
          <div style={{ flex: 1 }} />
          <button onClick={() => onAddRack({ mdf_idf_id: selectedMdfIdf, rack_name: `Rack ${mdfIdfRacks.length + 1}`, total_u: 42, slots: [] })} style={{ padding: '2px 8px', fontSize: 10, borderRadius: 4, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>Add Rack</button>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: 16, padding: 16, overflow: 'auto' }}>
          {mdfIdfRacks.map((rack) => (
            <div key={rack.id} style={{ width: 260, flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{rack.rack_name}</span>
                <span style={{ fontSize: 9, color: C.textDim }}>{rack.total_u}U</span>
              </div>
              <div style={{ border: `2px solid ${C.border}`, borderRadius: 4, background: C.bgPanel }}>
                {Array.from({ length: rack.total_u }, (_, i) => {
                  const slotNum = i + 1
                  const slot = (rack.slots ?? []).find((s) => s.u_position === slotNum)
                  if (!slot || slot.is_blank) {
                    return (
                      <div key={slotNum} style={{ display: 'flex', height: U_HEIGHT_PX, borderBottom: `1px solid ${C.borderSubtle}` }}>
                        <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: C.textDim, borderRight: `1px solid ${C.borderSubtle}`, fontFamily: "'IBM Plex Mono'" }}>{slotNum}</div>
                        <div style={{ flex: 1, padding: '0 6px', display: 'flex', alignItems: 'center' }}><span style={{ fontSize: 8, color: C.textDim, opacity: 0.3 }}>Empty</span></div>
                      </div>
                    )
                  }
                  return (
                    <div key={slotNum} style={{ display: 'flex', height: (slot.ru_height ?? 1) * U_HEIGHT_PX, borderBottom: `1px solid ${C.borderSubtle}`, background: 'rgba(59,130,246,0.06)' }}>
                      <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: C.textDim, borderRight: `1px solid ${C.borderSubtle}`, fontFamily: "'IBM Plex Mono'" }}>{slotNum}</div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 6px', gap: 4, overflow: 'hidden' }}>
                        <div style={{ width: 5, height: 5, borderRadius: 2, background: C.accent, flexShrink: 0 }} />
                        <span style={{ fontSize: 9, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.device_name || 'Device'}</span>
                        {(slot.poe_draw_w ?? 0) > 0 && <span style={{ fontSize: 7, color: C.green, fontFamily: "'IBM Plex Mono'", flexShrink: 0 }}>{slot.poe_draw_w}W</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {mdfIdfRacks.length === 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: C.textDim, fontSize: 12 }}>No racks in this MDF/IDF</div>}
        </div>
      </div>
    </div>
  )
}
