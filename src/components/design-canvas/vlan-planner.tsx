'use client'

import { C } from './constants'
import type { DesignVlanSubnet } from '@/types/database'

interface VlanPlannerProps {
  designId: string
  vlans: DesignVlanSubnet[]
  onAddVlan: (data: Record<string, unknown>) => Promise<unknown>
  onUpdateVlan: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDeleteVlan: (id: string) => Promise<unknown>
}

export function VlanPlanner({ designId, vlans, onAddVlan, onUpdateVlan, onDeleteVlan }: VlanPlannerProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>VLAN / Subnet Planner</span>
        <button onClick={() => onAddVlan({ vlan_id: vlans.length + 10, vlan_name: `VLAN ${vlans.length + 10}`, subnet: '10.0.0.0/24', gateway: '10.0.0.1', canvas_type: 'network' })} style={{ padding: '3px 10px', fontSize: 10, borderRadius: 4, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Add VLAN</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['VLAN ID', 'Name', 'Subnet', 'Gateway', 'DHCP Start', 'DHCP End', 'Notes', ''].map((h) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vlans.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: C.textDim }}>No VLANs configured</td></tr>}
            {vlans.map((v) => (
              <tr key={v.id} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ padding: '6px 12px' }}><input defaultValue={String(v.vlan_id ?? '')} style={{ width: 50, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }} onBlur={(e) => onUpdateVlan(v.id, { vlan_id: Number(e.target.value) })} /></td>
                <td style={{ padding: '6px 12px' }}><input defaultValue={v.vlan_name ?? ''} style={{ width: 100, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, outline: 'none' }} onBlur={(e) => onUpdateVlan(v.id, { vlan_name: e.target.value })} /></td>
                <td style={{ padding: '6px 12px' }}><input defaultValue={v.subnet ?? ''} style={{ width: 120, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }} onBlur={(e) => onUpdateVlan(v.id, { subnet: e.target.value })} /></td>
                <td style={{ padding: '6px 12px' }}><input defaultValue={v.gateway ?? ''} style={{ width: 100, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }} onBlur={(e) => onUpdateVlan(v.id, { gateway: e.target.value })} /></td>
                <td style={{ padding: '6px 12px' }}><input defaultValue={v.dhcp_range_start ?? ''} style={{ width: 100, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }} onBlur={(e) => onUpdateVlan(v.id, { dhcp_range_start: e.target.value })} /></td>
                <td style={{ padding: '6px 12px' }}><input defaultValue={v.dhcp_range_end ?? ''} style={{ width: 100, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }} onBlur={(e) => onUpdateVlan(v.id, { dhcp_range_end: e.target.value })} /></td>
                <td style={{ padding: '6px 12px' }}><input defaultValue={v.notes ?? ''} style={{ width: 100, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, outline: 'none' }} onBlur={(e) => onUpdateVlan(v.id, { notes: e.target.value })} /></td>
                <td style={{ padding: '6px 12px' }}><button onClick={() => onDeleteVlan(v.id)} style={{ fontSize: 10, color: C.red, background: 'transparent', border: 'none', cursor: 'pointer' }}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
