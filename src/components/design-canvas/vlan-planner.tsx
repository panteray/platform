'use client'

import { useCallback } from 'react'
import { C } from './constants'
import type { DesignVlanSubnet } from '@/types/database'

interface VlanPlannerProps {
  designId: string
  vlans: DesignVlanSubnet[]
  onAddVlan: (data: Record<string, unknown>) => Promise<unknown>
  onUpdateVlan: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDeleteVlan: (id: string) => Promise<unknown>
}

/* Calculate usable host count from CIDR notation (e.g. "10.0.1.0/24" → 254) */
function cidrHosts(subnet: string | null): number | null {
  if (!subnet) return null
  const match = subnet.match(/\/(\d+)$/)
  if (!match) return null
  const prefix = parseInt(match[1], 10)
  if (prefix < 0 || prefix > 32) return null
  if (prefix >= 31) return prefix === 31 ? 2 : 1
  return Math.pow(2, 32 - prefix) - 2
}

/* Format host count for display */
function fmtHosts(n: number | null): string {
  if (n === null) return '\u2014'
  return n.toLocaleString()
}

const cellPad = '6px 12px'
const inputBase: React.CSSProperties = {
  background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3,
  padding: '2px 6px', color: C.text, fontSize: 11, outline: 'none',
}
const monoInput: React.CSSProperties = { ...inputBase, fontFamily: "'IBM Plex Mono', monospace" }

export function VlanPlanner({ designId, vlans, onAddVlan, onUpdateVlan, onDeleteVlan }: VlanPlannerProps) {

  const handleAdd = useCallback(() => {
    /* Auto-increment: find max vlan_id, add 10, round to next 10 */
    const maxId = vlans.reduce((m, v) => Math.max(m, v.vlan_id ?? 0), 0)
    const nextId = maxId === 0 ? 10 : Math.ceil((maxId + 1) / 10) * 10
    /* Auto-increment subnet octets based on count */
    const idx = vlans.length
    const thirdOctet = idx % 256
    onAddVlan({
      vlan_id: nextId,
      vlan_name: `VLAN ${nextId}`,
      subnet: `10.0.${thirdOctet}.0/24`,
      gateway: `10.0.${thirdOctet}.1`,
      canvas_type: 'network',
    })
  }, [vlans, onAddVlan])

  const configured = vlans.filter(v => v.subnet)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>VLAN / Subnet Planner</span>
          {vlans.length > 0 && (
            <span style={{ fontSize: 10, color: C.textDim }}>
              {vlans.length} VLAN{vlans.length !== 1 ? 's' : ''}{configured.length < vlans.length ? ` \u00b7 ${configured.length} configured` : ''}
            </span>
          )}
        </div>
        <button onClick={handleAdd} style={{ padding: '3px 10px', fontSize: 10, borderRadius: 4, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
          + Add VLAN
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.bg, zIndex: 1 }}>
              {['VLAN ID', 'Name', 'Subnet', 'Hosts', 'Gateway', 'DHCP Start', 'DHCP End', 'Notes', ''].map((h) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vlans.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: C.textDim }}>
                  <div style={{ fontSize: 12, marginBottom: 4 }}>No VLANs configured</div>
                  <div style={{ fontSize: 10 }}>Click + Add VLAN to start planning your network segmentation</div>
                </td>
              </tr>
            )}
            {vlans.map((v) => {
              const hosts = cidrHosts(v.subnet)
              return (
                <tr key={v.id} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  <td style={{ padding: cellPad }}>
                    <input defaultValue={String(v.vlan_id ?? '')} style={{ ...monoInput, width: 50 }}
                      onBlur={(e) => { const n = Number(e.target.value); if (!isNaN(n)) onUpdateVlan(v.id, { vlan_id: n }) }} />
                  </td>
                  <td style={{ padding: cellPad }}>
                    <input defaultValue={v.vlan_name ?? ''} style={{ ...inputBase, width: 110 }}
                      onBlur={(e) => onUpdateVlan(v.id, { vlan_name: e.target.value })} />
                  </td>
                  <td style={{ padding: cellPad }}>
                    <input defaultValue={v.subnet ?? ''} style={{ ...monoInput, width: 120 }}
                      onBlur={(e) => onUpdateVlan(v.id, { subnet: e.target.value })} />
                  </td>
                  <td style={{ padding: cellPad }}>
                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: hosts !== null ? C.text : C.textDim }}>
                      {fmtHosts(hosts)}
                    </span>
                  </td>
                  <td style={{ padding: cellPad }}>
                    <input defaultValue={v.gateway ?? ''} style={{ ...monoInput, width: 100 }}
                      onBlur={(e) => onUpdateVlan(v.id, { gateway: e.target.value })} />
                  </td>
                  <td style={{ padding: cellPad }}>
                    <input defaultValue={v.dhcp_range_start ?? ''} style={{ ...monoInput, width: 100 }}
                      onBlur={(e) => onUpdateVlan(v.id, { dhcp_range_start: e.target.value })} />
                  </td>
                  <td style={{ padding: cellPad }}>
                    <input defaultValue={v.dhcp_range_end ?? ''} style={{ ...monoInput, width: 100 }}
                      onBlur={(e) => onUpdateVlan(v.id, { dhcp_range_end: e.target.value })} />
                  </td>
                  <td style={{ padding: cellPad }}>
                    <input defaultValue={v.notes ?? ''} style={{ ...inputBase, width: 120 }}
                      onBlur={(e) => onUpdateVlan(v.id, { notes: e.target.value })} />
                  </td>
                  <td style={{ padding: cellPad }}>
                    <button onClick={() => onDeleteVlan(v.id)}
                      style={{ fontSize: 10, color: C.red, background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.7 }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* Summary footer */}
          {vlans.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `1px solid ${C.border}` }}>
                <td colSpan={2} style={{ padding: cellPad, fontSize: 10, fontWeight: 600, color: C.textDim }}>
                  {vlans.length} VLAN{vlans.length !== 1 ? 's' : ''}
                </td>
                <td style={{ padding: cellPad, fontSize: 10, color: C.textDim }}>
                  {configured.length} subnet{configured.length !== 1 ? 's' : ''}
                </td>
                <td style={{ padding: cellPad, fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.green }}>
                  {fmtHosts(vlans.reduce((sum, v) => sum + (cidrHosts(v.subnet) ?? 0), 0))} total
                </td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
