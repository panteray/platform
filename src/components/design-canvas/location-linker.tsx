'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin } from 'lucide-react'
import { C } from './constants'

interface Site { id: string; name: string }
interface Building { id: string; name: string; site_id: string }
interface Floor { id: string; name: string; building_id: string }
interface Space { id: string; name: string; floor_id: string }

interface Props {
  designId: string
  customerId?: string
  currentSiteId?: string | null
  currentBuildingId?: string | null
  currentFloorId?: string | null
  currentSpaceId?: string | null
  onUpdate: (data: Record<string, unknown>) => Promise<void>
}

export function LocationLinker({ designId, customerId, currentSiteId, currentBuildingId, currentFloorId, currentSpaceId, onUpdate }: Props) {
  const [sites, setSites] = useState<Site[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [siteId, setSiteId] = useState(currentSiteId || '')
  const [buildingId, setBuildingId] = useState(currentBuildingId || '')
  const [floorId, setFloorId] = useState(currentFloorId || '')
  const [spaceId, setSpaceId] = useState(currentSpaceId || '')

  // Fetch sites for the customer
  useEffect(() => {
    if (!customerId) return
    fetch(`/api/org/customers/${customerId}/sites`).then(async r => {
      if (r.ok) { const d = await r.json(); setSites(d.sites ?? []) }
    }).catch(() => {})
  }, [customerId])

  // Fetch buildings when site changes
  useEffect(() => {
    if (!siteId) { setBuildings([]); return }
    fetch(`/api/org/sites/${siteId}/buildings`).then(async r => {
      if (r.ok) { const d = await r.json(); setBuildings(d.buildings ?? []) }
    }).catch(() => {})
  }, [siteId])

  // Fetch floors when building changes
  useEffect(() => {
    if (!buildingId) { setFloors([]); return }
    fetch(`/api/org/buildings/${buildingId}/floors`).then(async r => {
      if (r.ok) { const d = await r.json(); setFloors(d.floors ?? []) }
    }).catch(() => {})
  }, [buildingId])

  // Fetch spaces when floor changes
  useEffect(() => {
    if (!floorId) { setSpaces([]); return }
    fetch(`/api/org/floors/${floorId}/spaces`).then(async r => {
      if (r.ok) { const d = await r.json(); setSpaces(d.spaces ?? []) }
    }).catch(() => {})
  }, [floorId])

  const handleSave = useCallback(async () => {
    await onUpdate({
      site_id: siteId || null,
      building_id: buildingId || null,
      floor_id: floorId || null,
      space_id: spaceId || null,
    })
  }, [siteId, buildingId, floorId, spaceId, onUpdate])

  const selStyle: React.CSSProperties = {
    width: '100%', padding: '5px 8px', background: C.bgActive,
    border: `1px solid ${C.border}`, borderRadius: 4,
    color: C.text, fontSize: 11, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSubtle}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <MapPin size={14} style={{ color: C.accent }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Location Assignment</span>
      </div>
      <div style={{ fontSize: 9, color: C.textDim, marginBottom: 8 }}>
        Link this design to a specific location in the customer hierarchy.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div>
          <div style={{ fontSize: 8, color: C.textDim, marginBottom: 2 }}>Site</div>
          <select value={siteId} onChange={e => { setSiteId(e.target.value); setBuildingId(''); setFloorId(''); setSpaceId('') }} style={selStyle}>
            <option value="">— Select site —</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {siteId && (
          <div>
            <div style={{ fontSize: 8, color: C.textDim, marginBottom: 2 }}>Building</div>
            <select value={buildingId} onChange={e => { setBuildingId(e.target.value); setFloorId(''); setSpaceId('') }} style={selStyle}>
              <option value="">— Select building —</option>
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        {buildingId && (
          <div>
            <div style={{ fontSize: 8, color: C.textDim, marginBottom: 2 }}>Floor</div>
            <select value={floorId} onChange={e => { setFloorId(e.target.value); setSpaceId('') }} style={selStyle}>
              <option value="">— Select floor —</option>
              {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {floorId && (
          <div>
            <div style={{ fontSize: 8, color: C.textDim, marginBottom: 2 }}>Space</div>
            <select value={spaceId} onChange={e => setSpaceId(e.target.value)} style={selStyle}>
              <option value="">— Select space —</option>
              {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <button onClick={handleSave} style={{
          padding: '6px 12px', fontSize: 10, fontWeight: 600,
          background: C.accent, color: '#fff', border: 'none', borderRadius: 4,
          cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
        }}>
          Save Location
        </button>
      </div>

      {!customerId && (
        <div style={{ fontSize: 9, color: C.textDim, fontStyle: 'italic', marginTop: 8 }}>
          Link this opportunity to a customer to assign locations.
        </div>
      )}
    </div>
  )
}
