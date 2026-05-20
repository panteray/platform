'use client'

/*
 * BOM Tab — editable preview of the xlsm BOM material list.
 *
 * Columns mirror the BOM template Equipment sheet:
 *   B: Qty | C: Vendor | E: PN | F: Description
 *
 * Rows are aggregated from design_devices by `vendor|pn|description`
 * (same key the xlsm exporter uses). Edits fan out to all devices in the group.
 *
 * "Add from Library" → picks a device and inserts an off-canvas design_device
 * (placed=false). "Add row" → types vendor/pn/desc and inserts an off-canvas
 * design_device with those properties.
 */

import { useMemo, useState } from 'react'
import { Plus, Trash2, BookOpen } from 'lucide-react'
import type { DesignDevice, DeviceSearchResult } from '@/types/database'
import { DeviceLibraryModal } from './device-library-modal'
import { C } from './constants'

type DeviceProps = Record<string, unknown>

interface BomRow {
  key: string
  vendor: string
  pn: string
  description: string
  qty: number
  devices: DesignDevice[]
}

interface Props {
  designId: string
  devices: DesignDevice[]
  activeAreaId: string | null
  addDevice: (data: Record<string, unknown>) => Promise<DesignDevice | null>
  updateDeviceProps: (deviceId: string, propUpdates: Record<string, unknown>) => Promise<void>
  deleteDevice: (deviceId: string) => Promise<boolean>
}

export function BomTab({ designId: _designId, devices, activeAreaId, addDevice, updateDeviceProps, deleteDevice }: Props) {
  const [showLibrary, setShowLibrary] = useState(false)
  const [newRow, setNewRow] = useState({ qty: 1, vendor: '', pn: '', description: '' })
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const rows = useMemo<BomRow[]>(() => {
    const groups = new Map<string, BomRow>()
    for (const d of devices) {
      const p = (d.properties ?? {}) as DeviceProps
      if (d.placed === false && p.bom_added !== true) continue
      const vendor = String(p.manufacturer ?? '')
      const pn = String(p.model ?? p.part_number ?? d.label ?? '')
      const description = String(p.description ?? d.label ?? '')
      const key = `${vendor}|${pn}|${description}`
      const existing = groups.get(key)
      if (existing) { existing.qty++; existing.devices.push(d) }
      else groups.set(key, { key, vendor, pn, description, qty: 1, devices: [d] })
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (a.vendor !== b.vendor) return a.vendor.localeCompare(b.vendor)
      return a.pn.localeCompare(b.pn)
    })
  }, [devices])

  const totalLines = rows.length
  const totalQty = rows.reduce((s, r) => s + r.qty, 0)

  async function updateGroupField(row: BomRow, field: 'manufacturer' | 'model' | 'description', value: string) {
    setBusyKey(row.key)
    try {
      await Promise.all(row.devices.map(d => updateDeviceProps(d.id, { [field]: value })))
    } finally { setBusyKey(null) }
  }

  async function changeQty(row: BomRow, nextQty: number) {
    const n = Math.max(0, Math.floor(nextQty))
    if (n === row.qty) return
    setBusyKey(row.key)
    try {
      if (n < row.qty) {
        // Remove unplaced first, then placed ones from the end
        const removable = [...row.devices].sort((a, b) => {
          const ap = a.placed !== false
          const bp = b.placed !== false
          if (ap === bp) return 0
          return ap ? 1 : -1
        })
        const toRemove = removable.slice(0, row.qty - n)
        await Promise.all(toRemove.map(d => deleteDevice(d.id)))
      } else {
        const template = row.devices[0]
        const tProps = (template.properties ?? {}) as DeviceProps
        const toAdd = n - row.qty
        for (let i = 0; i < toAdd; i++) {
          await addDevice({
            area_id: activeAreaId,
            category: template.category,
            label: row.pn || row.description || 'ITEM',
            position_x: 0, position_y: 0,
            status: 'new',
            mount_type: template.mount_type,
            rotation: 0,
            properties: { ...tProps, bom_added: true },
            asset_type: template.asset_type,
            billing_type: template.billing_type,
            recurring_cost: template.recurring_cost,
            placed: false,
          })
        }
      }
    } finally { setBusyKey(null) }
  }

  async function deleteGroup(row: BomRow) {
    if (!confirm(`Delete all ${row.qty} × ${row.pn || row.description || 'item(s)'}?`)) return
    setBusyKey(row.key)
    try { await Promise.all(row.devices.map(d => deleteDevice(d.id))) }
    finally { setBusyKey(null) }
  }

  async function addFromLibrary(item: DeviceSearchResult) {
    setShowLibrary(false)
    const props: DeviceProps = {
      manufacturer: item.vendor,
      model: item.model,
      part_number: item.partnumber ?? '',
      description: [item.vendor, item.model].filter(Boolean).join(' '),
      bom_added: true,
    }
    await addDevice({
      area_id: activeAreaId,
      category: item.category || 'other',
      device_library_item_id: item.id,
      label: item.model || 'ITEM',
      position_x: 0, position_y: 0,
      status: 'new',
      rotation: 0,
      properties: props,
      asset_type: 'capital',
      billing_type: 'one_time',
      placed: false,
    })
  }

  async function addTypedRow() {
    const { qty, vendor, pn, description } = newRow
    if (!vendor && !pn && !description) return
    const n = Math.max(1, Math.floor(qty || 1))
    for (let i = 0; i < n; i++) {
      await addDevice({
        area_id: activeAreaId,
        category: 'other',
        label: pn || description || 'ITEM',
        position_x: 0, position_y: 0,
        status: 'new',
        rotation: 0,
        properties: { manufacturer: vendor, model: pn, description, bom_added: true },
        asset_type: 'capital',
        billing_type: 'one_time',
        placed: false,
      })
    }
    setNewRow({ qty: 1, vendor: '', pn: '', description: '' })
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5, color: C.textMuted,
    borderBottom: `1px solid ${C.border}`, background: C.bgSurface,
  }
  const tdStyle: React.CSSProperties = {
    padding: '6px 8px', fontSize: 12, color: C.text,
    borderBottom: `1px solid ${C.borderSubtle}`,
  }
  const inputCellStyle: React.CSSProperties = {
    width: '100%', background: 'transparent', border: '1px solid transparent',
    padding: '4px 6px', fontSize: 12, color: C.text, borderRadius: 4,
    fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.bgPanel,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Bill of Materials</div>
        <div style={{ fontSize: 11, color: C.textMuted }}>
          {totalLines} line item{totalLines === 1 ? '' : 's'} · {totalQty} device{totalQty === 1 ? '' : 's'}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowLibrary(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', fontSize: 11, fontWeight: 600,
            background: C.accent, color: '#fff', border: 'none',
            borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <BookOpen size={13} /> Add from Library
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 80 }}>Qty</th>
                <th style={{ ...thStyle, width: 180 }}>Vendor</th>
                <th style={{ ...thStyle, width: 200 }}>PN</th>
                <th style={thStyle}>Description</th>
                <th style={{ ...thStyle, width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: 32, color: C.textDim }}>
                    No items yet. Add from Library or type a new row below.
                  </td>
                </tr>
              )}
              {rows.map(row => (
                <tr key={row.key} style={{ opacity: busyKey === row.key ? 0.5 : 1 }}>
                  <td style={tdStyle}>
                    <input
                      type="number" min={0}
                      defaultValue={row.qty}
                      onBlur={e => {
                        const v = Number(e.target.value)
                        if (!Number.isFinite(v) || v === row.qty) return
                        changeQty(row, v)
                      }}
                      style={{ ...inputCellStyle, fontFamily: 'monospace', textAlign: 'right' }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="text" defaultValue={row.vendor}
                      onBlur={e => { if (e.target.value !== row.vendor) updateGroupField(row, 'manufacturer', e.target.value) }}
                      style={inputCellStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="text" defaultValue={row.pn}
                      onBlur={e => { if (e.target.value !== row.pn) updateGroupField(row, 'model', e.target.value) }}
                      style={{ ...inputCellStyle, fontFamily: 'monospace' }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="text" defaultValue={row.description}
                      onBlur={e => { if (e.target.value !== row.description) updateGroupField(row, 'description', e.target.value) }}
                      style={inputCellStyle}
                    />
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => deleteGroup(row)}
                      title="Delete all in group"
                      style={{
                        padding: 4, background: 'transparent', border: 'none', cursor: 'pointer',
                        color: C.textDim, borderRadius: 4, display: 'inline-flex',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={e => { e.currentTarget.style.color = C.textDim }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: C.bgSurface }}>
                <td style={tdStyle}>
                  <input
                    type="number" min={1} value={newRow.qty}
                    onChange={e => setNewRow(s => ({ ...s, qty: Number(e.target.value) || 1 }))}
                    style={{ ...inputCellStyle, fontFamily: 'monospace', textAlign: 'right' }}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="text" value={newRow.vendor} placeholder="Vendor"
                    onChange={e => setNewRow(s => ({ ...s, vendor: e.target.value }))}
                    style={inputCellStyle}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="text" value={newRow.pn} placeholder="PN"
                    onChange={e => setNewRow(s => ({ ...s, pn: e.target.value }))}
                    style={{ ...inputCellStyle, fontFamily: 'monospace' }}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="text" value={newRow.description} placeholder="Description"
                    onChange={e => setNewRow(s => ({ ...s, description: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addTypedRow() }}
                    style={inputCellStyle}
                  />
                </td>
                <td style={tdStyle}>
                  <button
                    onClick={addTypedRow}
                    title="Add row"
                    style={{
                      padding: 4, background: C.accent, color: '#fff',
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                      display: 'inline-flex',
                    }}
                  >
                    <Plus size={13} />
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: C.textDim }}>
          Edits sync to the canvas. Typed or library-added rows appear as unplaced devices
          until you drag them onto the map — they&apos;re already counted on the BOM.
        </div>
      </div>

      {showLibrary && (
        <DeviceLibraryModal
          category="cctv"
          onClose={() => setShowLibrary(false)}
          onSelect={addFromLibrary}
        />
      )}
    </div>
  )
}
