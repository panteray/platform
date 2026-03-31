'use client'
/**
 * DeviceLibraryModal — Canvas modal for selecting devices.
 *
 * Wraps the shared DeviceGrid component with a modal overlay,
 * header, and custom device form.
 */

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { C } from './constants'
import { DeviceGrid } from '@/components/device-library/device-grid'
import type { DeviceSearchResult } from '@/types/database'

const ACCENT = '#2b8fce'

const FORM_TYPES_MAP: Record<string, { id: string; label: string }[]> = {
  cctv: [
    { id: 'box', label: 'Box' },
    { id: 'bullet', label: 'Bullet' },
    { id: 'dome', label: 'Dome' },
    { id: 'turret', label: 'Turret' },
    { id: 'ptz', label: 'PTZ' },
    { id: 'fisheye', label: 'Fisheye' },
    { id: 'multisensor', label: 'Multi' },
    { id: 'covert', label: 'Covert' },
  ],
  access_control: [
    { id: 'reader', label: 'Reader' },
    { id: 'controller', label: 'Controller' },
    { id: 'maglock', label: 'Maglock' },
    { id: 'strike', label: 'Strike' },
    { id: 'rex', label: 'REX' },
  ],
  network: [
    { id: 'switch', label: 'Switch' },
    { id: 'router', label: 'Router' },
    { id: 'wap', label: 'WAP' },
    { id: 'firewall', label: 'Firewall' },
  ],
  av: [
    { id: 'display', label: 'Display' },
    { id: 'speaker', label: 'Speaker' },
    { id: 'microphone', label: 'Mic' },
    { id: 'amplifier', label: 'Amp' },
  ],
}

interface DeviceLibraryModalProps {
  category: string
  onClose: () => void
  onSelect: (device: DeviceSearchResult) => void
}

export function DeviceLibraryModal({ category, onClose, onSelect }: DeviceLibraryModalProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const FORM_TYPES = FORM_TYPES_MAP[category] || FORM_TYPES_MAP.cctv
  const [addForm, setAddForm] = useState({
    vendor: '', model: '', subcategory: FORM_TYPES[0]?.id || 'other', resolution: '4MP',
    focal_length: 2.8, sensor_width: 5.14, fov_angle: 90, ir_range: 30, ndaa_compliant: false,
  })

  async function handleAddDevice(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.vendor || !addForm.model) return alert('Vendor and Model are required.')
    setSubmitting(true)
    try {
      const res = await fetch('/api/org/device-library/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          vendor: addForm.vendor,
          model: addForm.model,
          subcategory: addForm.subcategory,
          resolution: category === 'cctv' ? addForm.resolution : null,
          ndaa_compliant: addForm.ndaa_compliant,
          fps: category === 'cctv' ? 30 : null,
          wattage: 15, poe_standard: 'PoE+',
          specs: category === 'cctv' ? {
            focal_length: Number(addForm.focal_length),
            sensor_width: Number(addForm.sensor_width),
            fov_angle: Number(addForm.fov_angle),
            ir_range: Number(addForm.ir_range),
          } : {},
        }),
      })
      if (!res.ok) throw new Error('Failed to create device')
      const json = await res.json()
      onSelect(json.item)
    } catch {
      alert('Error creating custom device')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8,
          width: '100%', maxWidth: 1100, height: '90vh', maxHeight: 800,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ═══ Header ═══ */}
        <div style={{
          background: ACCENT, padding: '10px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
            {isAdding ? 'Add Custom Device' : 'Select Device'}
          </span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {!isAdding ? (
              <button onClick={() => setIsAdding(true)} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>
                <Plus size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Add Custom
              </button>
            ) : (
              <button onClick={() => setIsAdding(false)} style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: '#fff',
                padding: '3px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>Cancel</button>
            )}
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              width: 28, height: 28, borderRadius: 4, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {isAdding ? (
          /* ═══ Add Custom Device Form ═══ */
          <div style={{ flex: 1, padding: 30, overflow: 'auto', background: C.bgPanel }}>
            <form onSubmit={handleAddDevice} style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                  Vendor (Brand) *
                  <input required value={addForm.vendor} onChange={e => setAddForm({ ...addForm, vendor: e.target.value })}
                    style={{ padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                  Model *
                  <input required value={addForm.model} onChange={e => setAddForm({ ...addForm, model: e.target.value })}
                    style={{ padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                  Form Factor
                  <select value={addForm.subcategory} onChange={e => setAddForm({ ...addForm, subcategory: e.target.value })}
                    style={{ padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontFamily: 'inherit' }}>
                    {FORM_TYPES.map(ft => <option key={ft.id} value={ft.id}>{ft.label}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                  Resolution
                  <input value={addForm.resolution} onChange={e => setAddForm({ ...addForm, resolution: e.target.value })}
                    placeholder="e.g. 4MP, 4K, 1080p, 12MP"
                    style={{ padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text }} />
                </label>
              </div>

              {category === 'cctv' && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: ACCENT, marginTop: 10, borderBottom: `1px solid ${C.borderSubtle}`, paddingBottom: 8 }}>Optical Specifications (DORI)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                      Focal Length (mm)
                      <input type="number" step="0.1" required value={addForm.focal_length} onChange={e => setAddForm({ ...addForm, focal_length: Number(e.target.value) })}
                        style={{ padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                      Sensor Width (mm)
                      <input type="number" step="0.1" required value={addForm.sensor_width} onChange={e => setAddForm({ ...addForm, sensor_width: Number(e.target.value) })}
                        style={{ padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                      Max FOV Angle (°)
                      <input type="number" step="1" required value={addForm.fov_angle} onChange={e => setAddForm({ ...addForm, fov_angle: Number(e.target.value) })}
                        style={{ padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text }} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: C.textDim }}>
                      IR Range (m)
                      <input type="number" step="1" required value={addForm.ir_range} onChange={e => setAddForm({ ...addForm, ir_range: Number(e.target.value) })}
                        style={{ padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text }} />
                    </label>
                  </div>
                </>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: C.text, marginTop: 10 }}>
                <input type="checkbox" checked={addForm.ndaa_compliant} onChange={e => setAddForm({ ...addForm, ndaa_compliant: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: '#22c55e' }} />
                NDAA Compliant
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="submit" disabled={submitting} style={{
                  padding: '10px 24px', background: ACCENT, color: '#fff', border: 'none',
                  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>
                  {submitting ? 'Saving...' : 'Add Device & Place on Map'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ═══ Device Grid ═══ */
          <DeviceGrid category={category} mode="select" onSelect={onSelect} />
        )}
      </div>
    </div>
  )
}
