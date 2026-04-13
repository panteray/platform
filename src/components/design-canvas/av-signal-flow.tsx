'use client'

import { useState, useCallback } from 'react'
import { Layout } from 'lucide-react'
import { C } from './constants'
import { AvRoomTemplateSelector, type AvRoomTemplate } from './av-room-templates'
import type { DesignAvoipDevice } from '@/types/database'

interface AvSignalFlowProps {
  designId: string
  avoipDevices: DesignAvoipDevice[]
  onAddDevice: (data: Record<string, unknown>) => Promise<unknown>
  onUpdateDevice: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDeleteDevice: (id: string) => Promise<unknown>
}

const AV_PROTOCOLS = [
  { value: 'dante', label: 'Dante', color: '#3b82f6' },
  { value: 'aes67', label: 'AES67', color: '#8b5cf6' },
  { value: 'ndi', label: 'NDI', color: '#22c55e' },
  { value: 'hdmi', label: 'HDMI', color: '#f97316' },
  { value: 'sdi', label: 'SDI', color: '#ef4444' },
  { value: 'analog', label: 'Analog', color: '#64748b' },
]
// Signal compatibility matrix — which protocols can connect to which
const SIGNAL_COMPAT: Record<string, string[]> = {
  dante: ['dante', 'aes67'], // Dante and AES67 are interoperable
  aes67: ['aes67', 'dante'],
  ndi: ['ndi'], // NDI is its own ecosystem
  hdmi: ['hdmi', 'sdi'], // HDMI↔SDI via converters is common
  sdi: ['sdi', 'hdmi'],
  analog: ['analog'],
}

function checkSignalCompat(fromProto: string, toProto: string): { compatible: boolean; warning: string | null } {
  const compat = SIGNAL_COMPAT[fromProto]
  if (!compat) return { compatible: true, warning: null }
  if (compat.includes(toProto)) return { compatible: true, warning: null }
  return { compatible: false, warning: `${fromProto.toUpperCase()} → ${toProto.toUpperCase()} requires a converter` }
}

const NIC_TYPES = ['primary', 'secondary', 'redundant']
const protoColor = (p: string) => AV_PROTOCOLS.find((a) => a.value === p)?.color ?? '#64748b'
const protoLabel = (p: string) => AV_PROTOCOLS.find((a) => a.value === p)?.label ?? p

const cellPad = '6px 10px'
const inputBase: React.CSSProperties = {
  background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3,
  padding: '2px 6px', color: C.text, fontSize: 11, outline: 'none',
}
const monoInput: React.CSSProperties = { ...inputBase, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }
const selectBase: React.CSSProperties = { ...inputBase, appearance: 'auto' as never }

export function AvSignalFlow({ designId, avoipDevices, onAddDevice, onUpdateDevice, onDeleteDevice }: AvSignalFlowProps) {
  const [filterProto, setFilterProto] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)

  const handleApplyTemplate = useCallback(async (template: AvRoomTemplate) => {
    setShowTemplates(false)
    for (const dev of template.devices) {
      await onAddDevice({
        design_id: designId,
        protocol: dev.properties.signal_type || 'HDMI',
        device_name: dev.label,
        ip_address: '',
        subnet: '',
        vlan_id: null,
        nic_type: 'primary',
        latency: 'low',
        multicast: false,
        properties: dev.properties,
      })
    }
  }, [designId, onAddDevice])

  const filtered = filterProto ? avoipDevices.filter((d) => d.protocol === filterProto) : avoipDevices
  const selected = selectedId ? avoipDevices.find((d) => d.id === selectedId) ?? null : null

  /* Protocol counts */
  const protoCounts = AV_PROTOCOLS.map((p) => ({
    ...p,
    count: avoipDevices.filter((d) => d.protocol === p.value).length,
  }))

  const handleAdd = useCallback((proto: string) => {
    const label = protoLabel(proto)
    const count = avoipDevices.filter((d) => d.protocol === proto).length + 1
    onAddDevice({
      protocol: proto,
      device_name: `${label} ${count}`,
      nic_type: 'primary',
      multicast: proto === 'dante' || proto === 'aes67' || proto === 'ndi',
    })
  }, [avoipDevices, onAddDevice])

  /* Stats */
  const multicastCount = filtered.filter((d) => d.multicast).length
  const withIp = filtered.filter((d) => d.ip_address).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {/* Filter buttons */}
        <button onClick={() => setFilterProto(null)}
          style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
            background: !filterProto ? C.accentSubtle : C.bgActive, color: !filterProto ? C.accent : C.textDim,
            border: !filterProto ? `1px solid ${C.accent}` : `1px solid ${C.border}` }}>
          All ({avoipDevices.length})
        </button>
        {protoCounts.filter((p) => p.count > 0).map((p) => (
          <button key={p.value} onClick={() => setFilterProto(p.value)}
            style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
              background: filterProto === p.value ? `${p.color}18` : C.bgActive,
              color: filterProto === p.value ? p.color : C.textDim,
              border: filterProto === p.value ? `1px solid ${p.color}` : `1px solid ${C.border}` }}>
            {p.label} ({p.count})
          </button>
        ))}
        <div style={{ width: 1, height: 16, background: C.border, margin: '0 4px' }} />
        {/* Add buttons */}
        {AV_PROTOCOLS.map((p) => (
          <button key={p.value} onClick={() => handleAdd(p.value)}
            style={{ padding: '3px 8px', fontSize: 9, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
              background: 'transparent', color: p.color, border: `1px solid ${p.color}40` }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${p.color}12` }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
            + {p.label}
          </button>
        ))}
        <div style={{ width: 1, height: 16, background: C.border, margin: '0 4px' }} />
        <button onClick={() => setShowTemplates(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: C.accentSubtle, color: C.accent, border: `1px solid ${C.accent}40` }}>
          <Layout size={11} /> Room Templates
        </button>
      </div>

      {showTemplates && <AvRoomTemplateSelector onSelectTemplate={handleApplyTemplate} onClose={() => setShowTemplates(false)} />}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.bg, zIndex: 1 }}>
                {['Protocol', 'Name', 'IP Address', 'Subnet', 'VLAN', 'NIC', 'Latency', 'Multicast', 'Notes', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: 40, textAlign: 'center', color: C.textDim }}>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>No AV devices{filterProto ? ` for ${protoLabel(filterProto)}` : ''}</div>
                    <div style={{ fontSize: 10 }}>Add devices using the protocol buttons above</div>
                  </td>
                </tr>
              )}
              {filtered.map((dev) => {
                const color = protoColor(dev.protocol)
                const isSel = dev.id === selectedId
                return (
                  <tr key={dev.id}
                    onClick={() => setSelectedId(dev.id)}
                    style={{ borderBottom: `1px solid ${C.borderSubtle}`, cursor: 'pointer', background: isSel ? 'rgba(59,130,246,0.06)' : 'transparent' }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = C.bgHover }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = isSel ? 'rgba(59,130,246,0.06)' : 'transparent' }}>
                    {/* Protocol badge */}
                    <td style={{ padding: cellPad }}>
                      <select defaultValue={dev.protocol} style={{ ...selectBase, width: 80, color, fontWeight: 600, fontSize: 10 }}
                        onChange={(e) => onUpdateDevice(dev.id, { protocol: e.target.value })}
                        onClick={(e) => e.stopPropagation()}>
                        {AV_PROTOCOLS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </td>
                    {/* Name */}
                    <td style={{ padding: cellPad }}>
                      <input defaultValue={dev.device_name ?? ''} style={{ ...inputBase, width: 130 }}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => onUpdateDevice(dev.id, { device_name: e.target.value })} />
                    </td>
                    {/* IP */}
                    <td style={{ padding: cellPad }}>
                      <input defaultValue={dev.ip_address ?? ''} placeholder="0.0.0.0" style={{ ...monoInput, width: 110 }}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => onUpdateDevice(dev.id, { ip_address: e.target.value || null })} />
                    </td>
                    {/* Subnet */}
                    <td style={{ padding: cellPad }}>
                      <input defaultValue={dev.subnet ?? ''} placeholder="255.255.255.0" style={{ ...monoInput, width: 110 }}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => onUpdateDevice(dev.id, { subnet: e.target.value || null })} />
                    </td>
                    {/* VLAN */}
                    <td style={{ padding: cellPad }}>
                      <input defaultValue={dev.vlan_id ?? ''} placeholder="—" style={{ ...monoInput, width: 50 }}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => onUpdateDevice(dev.id, { vlan_id: e.target.value || null })} />
                    </td>
                    {/* NIC */}
                    <td style={{ padding: cellPad }}>
                      <select defaultValue={dev.nic_type} style={{ ...selectBase, width: 85, fontSize: 10 }}
                        onChange={(e) => onUpdateDevice(dev.id, { nic_type: e.target.value })}
                        onClick={(e) => e.stopPropagation()}>
                        {NIC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    {/* Latency */}
                    <td style={{ padding: cellPad }}>
                      <input type="number" defaultValue={dev.latency_setting ?? ''} placeholder="ms" style={{ ...monoInput, width: 50 }}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => { const v = e.target.value; onUpdateDevice(dev.id, { latency_setting: v ? Number(v) : null }) }} />
                    </td>
                    {/* Multicast */}
                    <td style={{ padding: cellPad, textAlign: 'center' }}>
                      <input type="checkbox" defaultChecked={dev.multicast}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdateDevice(dev.id, { multicast: e.target.checked })} />
                    </td>
                    {/* Notes */}
                    <td style={{ padding: cellPad }}>
                      <input defaultValue={dev.notes ?? ''} placeholder="—" style={{ ...inputBase, width: 100 }}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => onUpdateDevice(dev.id, { notes: e.target.value || null })} />
                    </td>
                    {/* Delete */}
                    <td style={{ padding: cellPad }}>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteDevice(dev.id); if (selectedId === dev.id) setSelectedId(null) }}
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
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: `1px solid ${C.border}` }}>
                  <td colSpan={2} style={{ padding: cellPad, fontSize: 10, fontWeight: 600, color: C.textDim }}>
                    {filtered.length} device{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: cellPad, fontSize: 10, color: C.textDim }}>
                    {withIp} with IP
                  </td>
                  <td colSpan={4} />
                  <td style={{ padding: cellPad, fontSize: 10, color: C.textDim, textAlign: 'center' }}>
                    {multicastCount} MC
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Right panel — selected device detail */}
        {selected && (
          <div style={{ width: 240, borderLeft: `1px solid ${C.border}`, background: C.bgPanel, overflow: 'auto', flexShrink: 0 }}>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Device Detail</span>
                <button onClick={() => setSelectedId(null)} style={{ fontSize: 10, color: C.textDim, background: 'none', border: 'none', cursor: 'pointer' }}>x</button>
              </div>
              {/* Protocol badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: protoColor(selected.protocol), background: `${protoColor(selected.protocol)}15`, padding: '3px 8px', borderRadius: 4 }}>
                  {protoLabel(selected.protocol)}
                </span>
                <span style={{ fontSize: 10, color: C.textDim }}>{selected.nic_type} NIC</span>
              </div>
              {/* Quick summary */}
              <div style={{ padding: 8, background: C.bgActive, borderRadius: 4, fontSize: 10, color: C.textDim, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div>Name: <span style={{ color: C.text, fontWeight: 600 }}>{selected.device_name || '—'}</span></div>
                <div>IP: <span style={{ color: C.text, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{selected.ip_address || '—'}</span></div>
                <div>Subnet: <span style={{ color: C.text, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace" }}>{selected.subnet || '—'}</span></div>
                <div>VLAN: <span style={{ color: C.text }}>{selected.vlan_id || '—'}</span></div>
                <div>Latency: <span style={{ color: C.text }}>{selected.latency_setting != null ? `${selected.latency_setting}ms` : '—'}</span></div>
                <div>Multicast: <span style={{ color: selected.multicast ? C.green : C.textDim, fontWeight: 600 }}>{selected.multicast ? 'Enabled' : 'Disabled'}</span></div>
                {selected.notes && <div>Notes: <span style={{ color: C.text }}>{selected.notes}</span></div>}
              </div>
              <button onClick={() => { onDeleteDevice(selected.id); setSelectedId(null) }}
                style={{ padding: '4px 0', fontSize: 10, color: C.red, background: 'transparent', border: `1px solid ${C.red}`, borderRadius: 4, cursor: 'pointer' }}>
                Delete Device
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
