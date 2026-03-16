'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Design, DesignArea, DesignDevice, DesignCable, DesignMdfIdf, DesignFloorPlan } from '@/types/database'

export interface DesignCanvasState {
  design: (Design & { opportunities?: Record<string, unknown> }) | null
  areas: DesignArea[]
  devices: DesignDevice[]
  cables: DesignCable[]
  mdfIdfs: DesignMdfIdf[]
  floorPlans: DesignFloorPlan[]
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
  refetch: () => Promise<void>
}

export function useDesignCanvas(designId: string): DesignCanvasState {
  const [design, setDesign] = useState<(Design & { opportunities?: Record<string, unknown> }) | null>(null)
  const [areas, setAreas] = useState<DesignArea[]>([])
  const [devices, setDevices] = useState<DesignDevice[]>([])
  const [cables, setCables] = useState<DesignCable[]>([])
  const [mdfIdfs, setMdfIdfs] = useState<DesignMdfIdf[]>([])
  const [floorPlans, setFloorPlans] = useState<DesignFloorPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null)

  const fetchDesign = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch design + areas
      const designRes = await fetch(`/api/org/designs/${designId}`)
      if (!designRes.ok) { setError('Failed to load design'); return }
      const designJson = await designRes.json()
      setDesign(designJson.design)
      setAreas(designJson.areas ?? [])

      // Auto-select first area
      if (designJson.areas?.length > 0 && !activeAreaId) {
        setActiveAreaId(designJson.areas[0].id)
      }

      // Fetch floor plans
      const fpRes = await fetch(`/api/org/designs/${designId}/floor-plans`)
      if (fpRes.ok) {
        const fpJson = await fpRes.json()
        setFloorPlans(fpJson.floorPlans ?? [])
      }

      // Fetch devices
      const devRes = await fetch(`/api/org/designs/${designId}/devices`)
      if (devRes.ok) {
        const devJson = await devRes.json()
        setDevices(devJson.devices ?? [])
      }

      // TODO: Fetch cables in 7F, mdf_idfs in 7F
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [designId, activeAreaId])

  useEffect(() => {
    void fetchDesign()
  }, [fetchDesign])

  // ---- Area CRUD ----
  const addArea = useCallback(async (name: string, canvasType: string): Promise<DesignArea | null> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/areas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, canvas_type: canvasType }),
      })
      if (!res.ok) return null
      const json = await res.json()
      await fetchDesign()
      return json.area
    } catch { return null }
  }, [designId, fetchDesign])

  const updateArea = useCallback(async (areaId: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/areas/${areaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return false
      await fetchDesign()
      return true
    } catch { return false }
  }, [designId, fetchDesign])

  const deleteArea = useCallback(async (areaId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/areas/${areaId}`, { method: 'DELETE' })
      if (!res.ok) return false
      if (activeAreaId === areaId) {
        setActiveAreaId(areas.find((a) => a.id !== areaId)?.id ?? null)
      }
      await fetchDesign()
      return true
    } catch { return false }
  }, [designId, activeAreaId, areas, fetchDesign])

  const uploadFloorPlan = useCallback(async (areaId: string, file: File): Promise<DesignFloorPlan | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('area_id', areaId)
      const res = await fetch(`/api/org/designs/${designId}/floor-plans`, { method: 'POST', body: formData })
      if (!res.ok) return null
      const json = await res.json()
      await fetchDesign()
      return json.floorPlan
    } catch { return null }
  }, [designId, fetchDesign])

  // ---- Device CRUD ----
  const addDevice = useCallback(async (data: Record<string, unknown>): Promise<DesignDevice | null> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return null
      const json = await res.json()
      const newDevice = json.device as DesignDevice
      // Optimistic: add to local state immediately
      setDevices((prev) => [...prev, newDevice])
      return newDevice
    } catch { return null }
  }, [designId])

  const updateDevice = useCallback(async (deviceId: string, data: Record<string, unknown>): Promise<DesignDevice | null> => {
    try {
      // Optimistic update
      setDevices((prev) => prev.map((d) =>
        d.id === deviceId ? { ...d, ...data, updated_at: new Date().toISOString() } as DesignDevice : d
      ))

      const res = await fetch(`/api/org/designs/${designId}/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        // Revert on failure
        await fetchDesign()
        return null
      }
      const json = await res.json()
      return json.device
    } catch {
      await fetchDesign()
      return null
    }
  }, [designId, fetchDesign])

  const deleteDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      // Optimistic
      setDevices((prev) => prev.filter((d) => d.id !== deviceId))
      if (selectedDeviceId === deviceId) setSelectedDeviceId(null)

      const res = await fetch(`/api/org/designs/${designId}/devices?device_id=${deviceId}`, { method: 'DELETE' })
      if (!res.ok) {
        await fetchDesign()
        return false
      }
      return true
    } catch {
      await fetchDesign()
      return false
    }
  }, [designId, selectedDeviceId, fetchDesign])

  return {
    design, areas, devices, cables, mdfIdfs, floorPlans,
    loading, error,
    activeAreaId, selectedDeviceId, selectedCableId,
    setActiveAreaId, setSelectedDeviceId, setSelectedCableId,
    addArea, updateArea, deleteArea, uploadFloorPlan,
    addDevice, updateDevice, deleteDevice,
    refetch: fetchDesign,
  }
}
