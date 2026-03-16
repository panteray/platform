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
      if (!designRes.ok) {
        setError('Failed to load design')
        return
      }
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

      // TODO: Fetch devices, cables, mdf_idfs in 7C/7E/7F
      // These are empty arrays until those sub-phases are built
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [designId, activeAreaId])

  useEffect(() => {
    void fetchDesign()
  }, [fetchDesign])

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
    } catch {
      return null
    }
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
    } catch {
      return false
    }
  }, [designId, fetchDesign])

  const deleteArea = useCallback(async (areaId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/org/designs/${designId}/areas/${areaId}`, {
        method: 'DELETE',
      })
      if (!res.ok) return false
      if (activeAreaId === areaId) {
        setActiveAreaId(areas.find(a => a.id !== areaId)?.id ?? null)
      }
      await fetchDesign()
      return true
    } catch {
      return false
    }
  }, [designId, activeAreaId, areas, fetchDesign])

  const uploadFloorPlan = useCallback(async (areaId: string, file: File): Promise<DesignFloorPlan | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('area_id', areaId)
      const res = await fetch(`/api/org/designs/${designId}/floor-plans`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) return null
      const json = await res.json()
      await fetchDesign()
      return json.floorPlan
    } catch {
      return null
    }
  }, [designId, fetchDesign])

  return {
    design,
    areas,
    devices,
    cables,
    mdfIdfs,
    floorPlans,
    loading,
    error,
    activeAreaId,
    selectedDeviceId,
    selectedCableId,
    setActiveAreaId,
    setSelectedDeviceId,
    setSelectedCableId,
    addArea,
    updateArea,
    deleteArea,
    uploadFloorPlan,
    refetch: fetchDesign,
  }
}
