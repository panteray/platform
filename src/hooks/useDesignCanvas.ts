'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import type {
  Design, DesignArea, DesignDevice, DesignCable, DesignMdfIdf,
  DesignFloorPlan, DesignZone, DesignRackSlots, DesignVlanSubnet,
  DesignTopologyNode, DesignTopologyLink, DesignAvoipDevice,
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
  uploadFloorPlan: (areaId: string, file: File) => Promise<DesignFloorPlan | null>
  addDevice: (data: Record<string, unknown>) => Promise<DesignDevice | null>
  updateDevice: (deviceId: string, data: Record<string, unknown>) => Promise<DesignDevice | null>
  deleteDevice: (deviceId: string) => Promise<boolean>
  addCable: (data: Record<string, unknown>) => Promise<DesignCable | null>
  deleteCable: (cableId: string) => Promise<boolean>
  addInfrastructure: (data: Record<string, unknown>) => Promise<DesignMdfIdf | null>
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null)

  const fetchDesign = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const designRes = await fetch(`/api/org/designs/${designId}`)
      if (!designRes.ok) { setError('Failed to load design'); toast.error('Failed to load design'); return }
      const designJson = await designRes.json()
      setDesign(designJson.design)
      setAreas(designJson.areas ?? [])
      if (designJson.areas?.length > 0 && !activeAreaId) setActiveAreaId(designJson.areas[0].id)

      // Parallel fetch all entities
      const [fpRes, devRes, cabRes, infRes, zoneRes, rackRes, vlanRes, topoRes, linkRes, avRes] = await Promise.all([
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
      ])

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
    } catch {
      setError('Network error')
      toast.error('Network error loading design')
    } finally {
      setLoading(false)
    }
  }, [designId, activeAreaId])

  useEffect(() => { void fetchDesign() }, [fetchDesign])

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

  const uploadFloorPlan = useCallback(async (areaId: string, file: File): Promise<DesignFloorPlan | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('area_id', areaId)
      const res = await fetch(`/api/org/designs/${designId}/floor-plans`, { method: 'POST', body: formData })
      if (!res.ok) { toast.error('Floor plan upload failed'); return null }
      const json = await res.json()
      await fetchDesign()
      toast.success('Floor plan uploaded')
      return json.floorPlan
    } catch { toast.error('Floor plan upload failed'); return null }
  }, [designId, fetchDesign])

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

  return {
    design, areas, devices, cables, mdfIdfs, floorPlans, zones, racks, vlans, topologyNodes, topologyLinks, avoipDevices,
    loading, error,
    activeAreaId, selectedDeviceId, selectedCableId,
    setActiveAreaId, setSelectedDeviceId, setSelectedCableId,
    addArea, updateArea, deleteArea, uploadFloorPlan,
    addDevice, updateDevice, deleteDevice,
    addCable: cableCrud.add, deleteCable: cableCrud.remove,
    addInfrastructure: infraCrud.add,
    addZone: zoneCrud.add, updateZone: zoneCrud.update as (id: string, data: Record<string, unknown>) => Promise<boolean>, deleteZone: zoneCrud.remove,
    addTopologyNode: topoNodeCrud.add, updateTopologyNode: topoNodeCrud.update, deleteTopologyNode: topoNodeCrud.remove,
    addTopologyLink: topoLinkCrud.add, updateTopologyLink: topoLinkCrud.update, deleteTopologyLink: topoLinkCrud.remove,
    addRack: rackCrud.add, updateRack: rackCrud.update, deleteRack: rackCrud.remove,
    addVlan: vlanCrud.add, updateVlan: vlanCrud.update, deleteVlan: vlanCrud.remove,
    addAvoipDevice: avoipCrud.add, updateAvoipDevice: avoipCrud.update, deleteAvoipDevice: avoipCrud.remove,
    refetch: fetchDesign,
  }
}
