'use client'

import { C } from './constants'
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

export function AvSignalFlow({ designId, avoipDevices, onAddDevice, onUpdateDevice, onDeleteDevice }: AvSignalFlowProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        {AV_PROTOCOLS.map((p) => (
          <button key={p.value} onClick={() => onAddDevice({ protocol: p.value, device_name: `${p.label} ${avoipDevices.filter((d) => d.protocol === p.value).length + 1}`, nic_type: 'primary', multicast: false })}
            style={{ padding: '3px 8px', fontSize: 9, fontWeight: 600, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color: p.color, border: `1px solid ${p.color}40` }}>
            + {p.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Protocol', 'Name', 'IP Address', 'Subnet', 'NIC', 'Multicast', ''].map((h) => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.textDim, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {avoipDevices.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: C.textDim }}>Add AV devices using the toolbar above</td></tr>}
            {avoipDevices.map((dev) => {
              const protoInfo = AV_PROTOCOLS.find((p) => p.value === dev.protocol)
              return (
                <tr key={dev.id} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                  <td style={{ padding: '6px 12px' }}><span style={{ fontSize: 9, fontWeight: 600, color: protoInfo?.color, background: `${protoInfo?.color || '#666'}15`, padding: '2px 6px', borderRadius: 3 }}>{protoInfo?.label || dev.protocol}</span></td>
                  <td style={{ padding: '6px 12px' }}><input defaultValue={dev.device_name ?? ''} style={{ width: 140, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, outline: 'none' }} onBlur={(e) => onUpdateDevice(dev.id, { device_name: e.target.value })} /></td>
                  <td style={{ padding: '6px 12px' }}><input defaultValue={dev.ip_address ?? ''} style={{ width: 120, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }} onBlur={(e) => onUpdateDevice(dev.id, { ip_address: e.target.value })} /></td>
                  <td style={{ padding: '6px 12px' }}><input defaultValue={dev.subnet ?? ''} style={{ width: 100, background: C.bgActive, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px', color: C.text, fontSize: 11, fontFamily: "'IBM Plex Mono'", outline: 'none' }} onBlur={(e) => onUpdateDevice(dev.id, { subnet: e.target.value })} /></td>
                  <td style={{ padding: '6px 12px', fontSize: 10, color: C.textMuted }}>{dev.nic_type}</td>
                  <td style={{ padding: '6px 12px', fontSize: 10, color: dev.multicast ? C.green : C.textDim }}>{dev.multicast ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '6px 12px' }}><button onClick={() => onDeleteDevice(dev.id)} style={{ fontSize: 10, color: C.red, background: 'transparent', border: 'none', cursor: 'pointer' }}>Delete</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
