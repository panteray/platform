'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import type {
  Design, DesignArea, DesignDevice, DesignCable, DesignMdfIdf,
  DesignFloorPlan, DesignZone, DesignRackSlots, DesignVlanSubnet,
  DesignTopologyNode, DesignTopologyLink, DesignAvoipDevice, DesignWall,
  InterconnectNode, InterconnectLink,
} from '@/types/database'

export interface DesignCanvasState {
  design: (Design & { opportunities?: Record<string, unknown> }) | null
  areas: DesignArea[]
  devices: DesignDevice[]
  cables: DesignCable[]
  mdfIdfs: DesignMdfIdf[]
  floorPlans: DesignFloorPlan[]
  zones: DesignZone[]
  racks: DesignRackSlots[]
  vlans: DesignVlanSubnet[]
  topologyNodes: DesignTopologyNode[]
  topologyLinks: DesignTopologyLink[]
  avoipDevices: DesignAvoipDevice[]
  walls: DesignWall[]
  addWall: (data: Record<string, unknown>) => Promise<DesignWall | null>
  updateWall: (id: string, data: Record<string, unknown>) => Promise<unknown>
  deleteWall: (id: string) => Promise<boolean>
  interconnectNodes: InterconnectNode[]
  interconnectLinks: InterconnectLink[]
  addInterconnectNode: (data: Record<string, unknown>) => Promise<InterconnectNode | null>
  deleteInterconnectNode: (id: string) => Promise<boolean>
  addInterconnectLink: (data: Record<string, unknown>) => Promise<InterconnectLink | null>
  deleteInterconnectLink: (id: string) => Promise<boolean>
  loading: boolean
  error: string | null
  activeAreaId: string | null
  selectedDeviceId: string | null
  selectedCableId: string | null
  setActiveAreaId: (id: string | null) => void
  setSelectedDeviceId: (id: string | null) => void
  setSelectedCableId: (id: string | null) => void
  addArea: (name: string, canvasType: string) => Promise<DesignArea | null>
  updateArea: (areaId: string, data: Record<string, unknown>) => Promise<boolean>
  deleteArea: (areaId: string) => Promise<boolean>
  uploadFloorPlan: (areaId: string, file: File, width?: number, height?: number) => Promise<DesignFloorPlan | null>
  deleteFloorPlan: (planId: string) => Promise<boolean>
  addDevice: (data: Record<string, unknown>) => Promise<DesignDevice | null>
  updateDevice: (deviceId: string, data: Record<string, unknown>) => Promise<DesignDevice | null>
  updateDeviceProps: (deviceId: string, propUpdates: Record<string, unknown>) => Promise<void>
  deleteDevice: (deviceId: string) => Promise<boolean>
  addCable: (data: Record<string, unknown>) => Promise<DesignCable | null>
  updateCable: (id: string, data: Record<string, unknown>) => Promise<unknown>
  deleteCable: (cableId: string) => Promise<boolean>
  addInfrastructure: (data: Record<string, unknown>) => Promise<DesignMdfIdf | null>
  updateInfrastructure: (id: string, data: Record<string, unknown>) => Promise<unknown>
  deleteInfrastructure: (id: string) => Promise<boolean>
  addZone: (data: Record<string, unknown>) => Promise<DesignZone | null>
  updateZone: (id: string, data: Record<string, unknown>) => Promise<boolean>
  deleteZone: (id: string) => Promise<boolean>
  addTopologyNode: (data: Record<string, unknown>) => Promise<DesignTopologyNode | null>
  updateTopologyNode: (id: string, data: Record<string, unknown>) => Promise<unknown>
  deleteTopologyNode: (id: string) => Promise<boolean>
  addTopologyLink: (data: Record<string, unknown>) => Promise<DesignTopologyLink | null>
  updateTopologyLink: (id: string, data: Record<string, unknown>) => Promise<unknown>
  deleteTopologyLink: (id: string) => Promise<boolean>
  addRack: (data: Record<string, unknown>) => Promise<DesignRackSlots | null>
  updateRack: (id: string, data: Record<string, unknown>) => Promise<unknown>
  deleteRack: (id: string) => Promise<boolean>
  addVlan: (data: Record<string, unknown>) => Promise<DesignVlanSubnet | null>
  updateVlan: (id: string, data: Record<string, unknown>) => Promise<unknown>
  deleteVlan: (id: string) => Promise<boolean>
  addAvoipDevice: (data: Record<string, unknown>) => Promise<DesignAvoipDevice | null>
  updateAvoipDevice: (id: string, data: Record<string, unknown>) => Promise<unknown>
  deleteAvoipDevice: (id: string) => Promise<boolean>
  refetch: () => Promise<void>
}

// Generic CRUD helper
function useCrud<T extends { id: string }>(
  designId: string,
  endpoint: string,
  key: string,
  setState: React.Dispatch<React.SetStateAction<T[]>>,
  label: string,
  selectedId?: string | null,
  setSelectedId?: (id: string | null) => void,
) {
  const add = useCallback(async (data: Record<string, unknown>): Promise<T | null> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { toast.error(`Failed to add ${label}`); return null }
      const json = await res.json()
      const item = json[key] as T
      setState((prev) => [...prev, item])
      return item
    } catch { toast.error(`Failed to add ${label}`); return null }
  }, [designId, endpoint, key, setState, label])

  const update = useCallback(async (id: string, data: Record<string, unknown>): Promise<unknown> => {
    try {
      setState((prev) => prev.map((item) => item.id === id ? { ...item, ...data } as T : item))
      // Build URL based on the actual route param name
      const url = endpoint === 'topology' ? `/api/org/designs/${designId}/topology/${id}`
        : endpoint === 'topology-links' ? `/api/org/designs/${designId}/topology-links/${id}`
        : endpoint === 'racks' ? `/api/org/designs/${designId}/racks/${id}`
        : endpoint === 'vlans' ? `/api/org/designs/${designId}/vlans/${id}`
        : endpoint === 'zones' ? `/api/org/designs/${designId}/zones/${id}`
        : endpoint === 'avoip' ? `/api/org/designs/${designId}/avoip/${id}`
        : endpoint === 'infrastructure' ? `/api/org/designs/${designId}/infrastructure/${id}`
        : endpoint === 'cables' ? `/api/org/designs/${designId}/cables/${id}`
        : `/api/org/designs/${designId}/${endpoint}/${id}`
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { toast.error(`Failed to update ${label}`); return null }
      return await res.json()
    } catch { toast.error(`Failed to update ${label}`); return null }
  }, [designId, endpoint, setState, label])

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      setState((prev) => prev.filter((item) => item.id !== id))
      if (selectedId === id && setSelectedId) setSelectedId(null)
      // Determine the correct query param name
      const paramMap: Record<string, string> = {
        cables: 'cable_id', infrastructure: 'node_id', zones: 'zone_id',
        doors: 'door_id', topology: 'node_id', 'topology-links': 'link_id',
        racks: 'rack_id', vlans: 'vlan_id', avoip: 'av_id',
      }
      const paramName = paramMap[endpoint] || 'id'
      const res = await fetch(`/api/org/designs/${designId}/${endpoint}?${paramName}=${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error(`Failed to delete ${label}`); return false }
      return true
    } catch { toast.error(`Failed to delete ${label}`); return false }
  }, [designId, endpoint, setState, selectedId, setSelectedId, label])

  return { add, update, remove }
}

export function useDesignCanvas(designId: string): DesignCanvasState {
  const [design, setDesign] = useState<(Design & { opportunities?: Record<string, unknown> }) | null>(null)
  const [areas, setAreas] = useState<DesignArea[]>([])
  const [devices, setDevices] = useState<DesignDevice[]>([])
  const [cables, setCables] = useState<DesignCable[]>([])
  const [mdfIdfs, setMdfIdfs] = useState<DesignMdfIdf[]>([])
  const [floorPlans, setFloorPlans] = useState<DesignFloorPlan[]>([])
  const [zones, setZones] = useState<DesignZone[]>([])
  const [racks, setRacks] = useState<DesignRackSlots[]>([])
  const [vlans, setVlans] = useState<DesignVlanSubnet[]>([])
  const [topologyNodes, setTopologyNodes] = useState<DesignTopologyNode[]>([])
  const [topologyLinks, setTopologyLinks] = useState<DesignTopologyLink[]>([])
  const [avoipDevices, setAvoipDevices] = useState<DesignAvoipDevice[]>([])
  const [walls, setWalls] = useState<DesignWall[]>([])
  const [interconnectNodes, setInterconnectNodes] = useState<InterconnectNode[]>([])
  const [interconnectLinks, setInterconnectLinks] = useState<InterconnectLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null)
  const initialAreaSetRef = useRef(false)
  const mountedRef = useRef(true)

  const fetchDesign = useCallback(async (isInitial = false) => {
    if (isInitial) { setLoading(true); setError(null) }
    try {
      const designRes = await fetch(`/api/org/designs/${designId}`)
      if (!mountedRef.current) return
      if (!designRes.ok) { setError('Failed to load design'); toast.error('Failed to load design'); return }
      const designJson = await designRes.json()
      if (!mountedRef.current) return
      setDesign(designJson.design)
      setAreas(designJson.areas ?? [])
      if (designJson.areas?.length > 0 && !initialAreaSetRef.current) {
        initialAreaSetRef.current = true
        setActiveAreaId(designJson.areas[0].id)
      }

      // Parallel fetch all entities
      const [fpRes, devRes, cabRes, infRes, zoneRes, rackRes, vlanRes, topoRes, linkRes, avRes, wallRes] = await Promise.all([
        fetch(`/api/org/designs/${designId}/floor-plans`),
        fetch(`/api/org/designs/${designId}/devices`),
        fetch(`/api/org/designs/${designId}/cables`),
        fetch(`/api/org/designs/${designId}/infrastructure`),
        fetch(`/api/org/designs/${designId}/zones`),
        fetch(`/api/org/designs/${designId}/racks`),
        fetch(`/api/org/designs/${designId}/vlans`),
        fetch(`/api/org/designs/${designId}/topology`),
        fetch(`/api/org/designs/${designId}/topology-links`),
        fetch(`/api/org/designs/${designId}/avoip`),
        fetch(`/api/org/designs/${designId}/walls`),
      ])
      if (!mountedRef.current) return

      if (fpRes.ok) setFloorPlans((await fpRes.json()).floorPlans ?? [])
      if (devRes.ok) setDevices((await devRes.json()).devices ?? [])
      if (cabRes.ok) setCables((await cabRes.json()).cables ?? [])
      if (infRes.ok) setMdfIdfs((await infRes.json()).infrastructure ?? [])
      if (zoneRes.ok) setZones((await zoneRes.json()).zones ?? [])
      if (rackRes.ok) setRacks((await rackRes.json()).racks ?? [])
      if (vlanRes.ok) setVlans((await vlanRes.json()).vlans ?? [])
      if (topoRes.ok) setTopologyNodes((await topoRes.json()).nodes ?? [])
      if (linkRes.ok) setTopologyLinks((await linkRes.json()).links ?? [])
      if (avRes.ok) setAvoipDevices((await avRes.json()).avoipDevices ?? [])
      if (wallRes.ok) setWalls((await wallRes.json()).walls ?? [])

      // Fetch interconnect data
      try {
        const icRes = await fetch(`/api/org/designs/${designId}/interconnect`)
        if (icRes.ok) {
          const icData = await icRes.json()
          setInterconnectNodes(icData.nodes ?? [])
          setInterconnectLinks(icData.links ?? [])
        }
      } catch { /* interconnect is optional */ }
    } catch {
      if (!mountedRef.current) return
      setError('Network error')
      toast.error('Network error loading design')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [designId])

  useEffect(() => {
    mountedRef.current = true
    initialAreaSetRef.current = false
    void fetchDesign(true)
    return () => { mountedRef.current = false }
  }, [fetchDesign])

  /**
   * Phase 0: persist satellite center from opportunity install address when areas lack lat/lng.
   * One geocode per load; PATCH all areas missing coords, then refetch.
   */
  useEffect(() => {
    if (loading || !design || areas.length === 0) return

    const opp = design.opportunities as { install_address?: string | null } | null | undefined
    const address = typeof opp?.install_address === 'string' ? opp.install_address.trim() : ''
    if (!address) return

    const needsGeo = areas.some((a) => a.satellite_lat == null || a.satellite_lng == null)
    if (!needsGeo) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/org/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        })
        if (!res.ok || cancelled) {
          if (res.status === 404 || res.status === 400) {
            toast.warning('Could not geocode install address for satellite map')
          }
          return
        }
        const data = (await res.json()) as { lat?: number; lng?: number }
        const lat = data.lat
        const lng = data.lng
        if (cancelled || typeof lat !== 'number' || typeof lng !== 'number') return

        const toFix = areas.filter((a) => a.satellite_lat == null || a.satellite_lng == null)
        for (const a of toFix) {
          if (cancelled) break
          const z = typeof a.satellite_zoom === 'number' && a.satellite_zoom >= 1 && a.satellite_zoom <= 22
            ? a.satellite_zoom
            : 18
          const patchRes = await fetch(`/api/org/designs/${designId}/areas/${a.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ satellite_lat: lat, satellite_lng: lng, satellite_zoom: z }),
          })
          if (!patchRes.ok) {
            toast.error('Failed to save map location for an area')
            return
          }
        }
        if (!cancelled) await fetchDesign()
      } catch {
        if (!cancelled) toast.error('Geocoding failed')
      }
    })()

    return () => { cancelled = true }
  }, [loading, design, areas, designId, fetchDesign])

  // Area CRUD
  const addArea = useCallback(async (name: string, canvasType: string): Promise<DesignArea | null> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/areas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, canvas_type: canvasType }) })
      if (!res.ok) { toast.error('Failed to create area'); return null }
      const json = await res.json()
      await fetchDesign()
      return json.area
    } catch { toast.error('Failed to create area'); return null }
  }, [designId, fetchDesign])

  const updateArea = useCallback(async (areaId: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/areas/${areaId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { toast.error('Failed to update area'); return false }
      await fetchDesign()
      return true
    } catch { toast.error('Failed to update area'); return false }
  }, [designId, fetchDesign])

  const deleteArea = useCallback(async (areaId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/areas/${areaId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to delete area'); return false }
      if (activeAreaId === areaId) setActiveAreaId(areas.find((a) => a.id !== areaId)?.id ?? null)
      await fetchDesign()
      return true
    } catch { toast.error('Failed to delete area'); return false }
  }, [designId, activeAreaId, areas, fetchDesign])

  const uploadFloorPlan = useCallback(async (areaId: string, file: File, width?: number, height?: number): Promise<DesignFloorPlan | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('area_id', areaId)
      if (width) formData.append('width', String(width))
      if (height) formData.append('height', String(height))
      const res = await fetch(`/api/org/designs/${designId}/floor-plans`, { method: 'POST', body: formData })
      if (!res.ok) { toast.error('Floor plan upload failed'); return null }
      const json = await res.json()
      await fetchDesign()
      toast.success('Floor plan uploaded')
      return json.floorPlan
    } catch { toast.error('Floor plan upload failed'); return null }
  }, [designId, fetchDesign])

  const deleteFloorPlan = useCallback(async (planId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/floor-plans?plan_id=${planId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to delete floor plan'); return false }
      setFloorPlans((prev) => prev.filter((fp) => fp.id !== planId))
      toast.success('Floor plan deleted')
      return true
    } catch { toast.error('Failed to delete floor plan'); return false }
  }, [designId])

  // Device CRUD (special — optimistic)
  const addDevice = useCallback(async (data: Record<string, unknown>): Promise<DesignDevice | null> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/devices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { toast.error('Failed to place device'); return null }
      const json = await res.json()
      setDevices((prev) => [...prev, json.device as DesignDevice])
      return json.device
    } catch { toast.error('Failed to place device'); return null }
  }, [designId])

  const updateDevice = useCallback(async (deviceId: string, data: Record<string, unknown>): Promise<DesignDevice | null> => {
    try {
      setDevices((prev) => prev.map((d) => d.id === deviceId ? { ...d, ...data, updated_at: new Date().toISOString() } as DesignDevice : d))
      const res = await fetch(`/api/org/designs/${designId}/devices/${deviceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { toast.error('Failed to save device changes'); await fetchDesign(); return null }
      return (await res.json()).device
    } catch { toast.error('Failed to save device changes'); await fetchDesign(); return null }
  }, [designId, fetchDesign])

  // Safe property merge — reads latest device state via functional updater, never stale
  const updateDeviceProps = useCallback(async (deviceId: string, propUpdates: Record<string, unknown>): Promise<void> => {
    let mergedProps: Record<string, unknown> = {}
    setDevices((prev) => prev.map((d) => {
      if (d.id !== deviceId) return d
      const existing = (d.properties ?? {}) as Record<string, unknown>
      mergedProps = { ...existing, ...propUpdates }
      return { ...d, properties: mergedProps, updated_at: new Date().toISOString() } as DesignDevice
    }))
    try {
      const res = await fetch(`/api/org/designs/${designId}/devices/${deviceId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: mergedProps }),
      })
      if (!res.ok) { toast.error('Failed to save device changes'); await fetchDesign() }
    } catch { toast.error('Failed to save device changes'); await fetchDesign() }
  }, [designId, fetchDesign])

  const deleteDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      setDevices((prev) => prev.filter((d) => d.id !== deviceId))
      if (selectedDeviceId === deviceId) setSelectedDeviceId(null)
      const res = await fetch(`/api/org/designs/${designId}/devices?device_id=${deviceId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to delete device'); await fetchDesign(); return false }
      return true
    } catch { toast.error('Failed to delete device'); await fetchDesign(); return false }
  }, [designId, selectedDeviceId, fetchDesign])

  // Generic CRUD for remaining entities
  const cableCrud = useCrud<DesignCable>(designId, 'cables', 'cable', setCables, 'cable', selectedCableId, setSelectedCableId)
  const infraCrud = useCrud<DesignMdfIdf>(designId, 'infrastructure', 'node', setMdfIdfs, 'MDF/IDF node')
  const zoneCrud = useCrud<DesignZone>(designId, 'zones', 'zone', setZones, 'zone')
  const topoNodeCrud = useCrud<DesignTopologyNode>(designId, 'topology', 'node', setTopologyNodes, 'topology node')
  const topoLinkCrud = useCrud<DesignTopologyLink>(designId, 'topology-links', 'link', setTopologyLinks, 'topology link')
  const rackCrud = useCrud<DesignRackSlots>(designId, 'racks', 'rack', setRacks, 'rack')
  const vlanCrud = useCrud<DesignVlanSubnet>(designId, 'vlans', 'vlan', setVlans, 'VLAN')
  const avoipCrud = useCrud<DesignAvoipDevice>(designId, 'avoip', 'avoipDevice', setAvoipDevices, 'AV device')
  const wallCrud = useCrud<DesignWall>(designId, 'walls', 'wall', setWalls, 'wall')

  // Interconnect CRUD (combined endpoint)
  const addInterconnectNode = useCallback(async (data: Record<string, unknown>): Promise<InterconnectNode | null> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/interconnect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { toast.error('Failed to add node'); return null }
      const json = await res.json()
      const node = json.node as InterconnectNode
      setInterconnectNodes(prev => [...prev, node])
      return node
    } catch { toast.error('Failed to add node'); return null }
  }, [designId])

  const deleteInterconnectNode = useCallback(async (id: string): Promise<boolean> => {
    try {
      setInterconnectNodes(prev => prev.filter(n => n.id !== id))
      setInterconnectLinks(prev => prev.filter(l => l.from_node_id !== id && l.to_node_id !== id))
      await fetch(`/api/org/designs/${designId}/interconnect/${id}`, { method: 'DELETE' })
      return true
    } catch { return false }
  }, [designId])

  const addInterconnectLink = useCallback(async (data: Record<string, unknown>): Promise<InterconnectLink | null> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/interconnect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { toast.error('Failed to add link'); return null }
      const json = await res.json()
      const link = json.link as InterconnectLink
      setInterconnectLinks(prev => [...prev, link])
      return link
    } catch { toast.error('Failed to add link'); return null }
  }, [designId])

  const deleteInterconnectLink = useCallback(async (id: string): Promise<boolean> => {
    try {
      setInterconnectLinks(prev => prev.filter(l => l.id !== id))
      await fetch(`/api/org/designs/${designId}/interconnect/${id}`, { method: 'DELETE' })
      return true
    } catch { return false }
  }, [designId])

  return {
    design, areas, devices, cables, mdfIdfs, floorPlans, zones, racks, vlans, topologyNodes, topologyLinks, avoipDevices, walls,
    loading, error,
    activeAreaId, selectedDeviceId, selectedCableId,
    setActiveAreaId, setSelectedDeviceId, setSelectedCableId,
    addArea, updateArea, deleteArea, uploadFloorPlan, deleteFloorPlan,
    addDevice, updateDevice, updateDeviceProps, deleteDevice,
    addCable: cableCrud.add, updateCable: cableCrud.update, deleteCable: cableCrud.remove,
    addInfrastructure: infraCrud.add,
    updateInfrastructure: infraCrud.update,
    deleteInfrastructure: infraCrud.remove,
    addZone: zoneCrud.add, updateZone: zoneCrud.update as (id: string, data: Record<string, unknown>) => Promise<boolean>, deleteZone: zoneCrud.remove,
    addTopologyNode: topoNodeCrud.add, updateTopologyNode: topoNodeCrud.update, deleteTopologyNode: topoNodeCrud.remove,
    addTopologyLink: topoLinkCrud.add, updateTopologyLink: topoLinkCrud.update, deleteTopologyLink: topoLinkCrud.remove,
    addRack: rackCrud.add, updateRack: rackCrud.update, deleteRack: rackCrud.remove,
    addVlan: vlanCrud.add, updateVlan: vlanCrud.update, deleteVlan: vlanCrud.remove,
    addAvoipDevice: avoipCrud.add, updateAvoipDevice: avoipCrud.update, deleteAvoipDevice: avoipCrud.remove,
    addWall: wallCrud.add, updateWall: wallCrud.update, deleteWall: wallCrud.remove,
    interconnectNodes, interconnectLinks,
    addInterconnectNode, deleteInterconnectNode,
    addInterconnectLink, deleteInterconnectLink,
    refetch: fetchDesign,
  }
}
