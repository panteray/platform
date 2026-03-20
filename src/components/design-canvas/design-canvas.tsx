'use client'

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { Upload, Grid3X3, Ruler, Eye, EyeOff, ArrowLeft, Plus, BarChart3, X, Trash2, ImageOff, Undo2, Redo2, Layers, Magnet, HardDrive, Server, Download, Map as MapIcon, MoreVertical, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { C, GRID_SIZE, UNDO_STACK_DEPTH, isDoorType, type CanvasTool, type IconTabId, type RequirementStatus } from './constants'
import { LABEL_CODES } from './icons'
import { CanvasArea, type DeviceFovData } from './canvas-area'
import { IconSidebar } from './icon-sidebar'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { DeviceCatalogModal } from './device-catalog-modal'
import { RequirementsBar, type RequirementItem } from './requirements-bar'
import { StorageCalculatorPanel } from './storage-calculator-panel'
import { CameraAdvisor } from './camera-advisor'
import { DeviceComparison } from './device-comparison'
import { ReportGenerator } from './report-generator'
import { TopologyView } from './topology-view'
import { Camera3dPreview } from './camera-3d-preview'
import { useDesignCanvas } from '@/hooks/useDesignCanvas'
import { calculateFovDori, getFovConeTiers, calculateSystemStorage, canvasDevicesToCameraSpecs } from '@/lib/calculators'
import { exportBom, exportMaterialList, exportHardwareSchedule, exportCableSchedule, exportCanvasSnapshot } from '@/lib/export-helpers'
import type { DesignDevice, DesignFloorPlan, DeviceSearchResult } from '@/types/database'

const TAB_TO_SUBTYPE: Record<string, string> = { camera: 'dome', door: 'door', network: 'switch', av: 'speaker', sensors: 'junction_box', other: 'junction_box' }
const TAB_TO_CATEGORY: Record<string, string> = { camera: 'cctv', door: 'access_control', network: 'network', av: 'av', sensors: 'vape_environmental', other: 'other' }

type DesignView = 'cctv' | 'access_control' | 'network_topology' | 'all'

const VIEWS: { id: DesignView; label: string }[] = [
  { id: 'cctv', label: 'CCTV' },
  { id: 'access_control', label: 'Access Control' },
  { id: 'network_topology', label: 'Network Topology' },
  { id: 'all', label: 'All' },
]

interface DesignCanvasProps { designId: string; onNavigateDashboard?: () => void }

export function DesignCanvas({ designId, onNavigateDashboard }: DesignCanvasProps) {
  const state = useDesignCanvas(designId)
  const {
    design, areas, devices, cables, mdfIdfs, floorPlans, zones, topologyNodes, topologyLinks,
    loading, error, activeAreaId, selectedDeviceId,
    setActiveAreaId, setSelectedDeviceId,
    addArea, updateArea, deleteArea, uploadFloorPlan,
    addDevice, updateDevice, deleteDevice,
    addCable,
    addInfrastructure, updateInfrastructure, deleteInfrastructure,
    addZone, updateZone, deleteZone,
    addTopologyNode, updateTopologyNode, deleteTopologyNode,
    addTopologyLink, updateTopologyLink, deleteTopologyLink,
    refetch,
  } = state

  const router = useRouter()
  const [showGrid, setShowGrid] = useState(true)
  const [activeTool, setActiveTool] = useState<CanvasTool>('select')
  const [activeIcon, setActiveIcon] = useState<IconTabId>('layers')
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [activeView, setActiveView] = useState<DesignView>('all')
  const [showFovCones, setShowFovCones] = useState(false)
  const [showDeviceLibrary, setShowDeviceLibrary] = useState(false)
  const [fovDisplayMode, setFovDisplayMode] = useState<'ppf' | 'dori'>('ppf')
  const [highlightedPpfTier, setHighlightedPpfTier] = useState<string | null>(null)
  const [scalePxPerFt, setScalePxPerFt] = useState(10)
  const [floorPlanError, setFloorPlanError] = useState<string | null>(null)
  const [showRequirements, setShowRequirements] = useState(false)
  const [showStoragePanel, setShowStoragePanel] = useState(false)
  const [showCameraAdvisor, setShowCameraAdvisor] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showReport, setShowReport] = useState(false)
  const [showMinimap, setShowMinimap] = useState(false)
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [editAreaValue, setEditAreaValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const placingRef = useRef(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [pendingDevice, setPendingDevice] = useState<DeviceSearchResult | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => void } | null>(null)
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.5)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [showLayerMenu, setShowLayerMenu] = useState(false)
  const [undoStack, setUndoStack] = useState<Array<{ undo: () => Promise<void>; redo: () => Promise<void> }>>([])
  const [redoStack, setRedoStack] = useState<Array<{ undo: () => Promise<void>; redo: () => Promise<void> }>>([])
  const layerMenuRef = useRef<HTMLDivElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const snapshotRef = useRef<(() => string | null) | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const [satelliteLoading, setSatelliteLoading] = useState(false)
  const [showFloorPlanMenu, setShowFloorPlanMenu] = useState(false)
  const [showOverflowMenu, setShowOverflowMenu] = useState(false)
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.6)
  const [show3dPreview, setShow3dPreview] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const floorPlanMenuRef = useRef<HTMLDivElement>(null)
  const overflowMenuRef = useRef<HTMLDivElement>(null)

  // Auto-save indicator: flash "saving..." then "saved" on any mutation
  const markSaving = useCallback(() => {
    setSaveStatus('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setSaveStatus('saved'), 800)
  }, [])

  // No background polling — mutations are optimistic and immediate.
  // Polling caused full canvas rebuild every 30s (Bug 3).

  // Tab-driven category filter — preset hiddenCategories when switching view tabs
  const ALL_CATEGORIES = ['cctv', 'access_control', 'network', 'av', 'vape_environmental', 'other'] as const
  useEffect(() => {
    if (activeView === 'cctv') {
      setHiddenCategories(new Set(ALL_CATEGORIES.filter(c => c !== 'cctv')))
    } else if (activeView === 'access_control') {
      setHiddenCategories(new Set(ALL_CATEGORIES.filter(c => c !== 'access_control')))
    } else if (activeView === 'all') {
      setHiddenCategories(new Set())
    }
    // network_topology doesn't render canvas, no filtering needed
  }, [activeView])

  const activeArea = areas.find((a) => a.id === activeAreaId) ?? null
  const activeFloorPlan: DesignFloorPlan | null = floorPlans.find((fp) => fp.area_id === activeAreaId) ?? null
  const areaDevices = useMemo(() => {
    return devices.filter((d: DesignDevice) => d.area_id === activeAreaId)
  }, [devices, activeAreaId])
  const areaCables = useMemo(() => cables.filter((c) => c.area_id === activeAreaId), [cables, activeAreaId])

  const walls = useMemo(() => {
    return ((activeArea?.infrastructure_observations as Record<string, unknown>)?.walls as Array<{ id: string; points: Array<{ x: number; y: number }> }>) || []
  }, [activeArea?.infrastructure_observations])

  const opp = design?.opportunities as Record<string, unknown> | undefined
  const hasSatellite = activeArea?.satellite_lat != null && activeArea?.satellite_lng != null
  const projectName = opp?.project_name ? `${opp.opp_number} / ${opp.project_name}` : design?.name ?? 'Design Canvas'

  // ---- FOV data from calculator engine ----
  const fovData = useMemo(() => {
    const map = new Map<string, DeviceFovData>()
    const cameraTypes = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']
    for (const d of areaDevices) {
      if (!cameraTypes.includes(d.category)) continue
      const props = (d.properties ?? {}) as Record<string, unknown>
      const focalLength = Number(props.focal_length) || 0
      const sensorW = Number(props.sensor_width) || 0
      const sensorH = Number(props.sensor_height) || 0
      const resW = Number(props.resolution_w) || 0
      const resH = Number(props.resolution_h) || 0
      const mountHeight = Number(props.mount_height) || 10
      const targetDist = Number(props.target_distance) || 30
      const tiltAngle = Number(props.tilt_angle) || 15

      if (!focalLength || !sensorW || !resW) {
        map.set(d.id, {
          hFov: 90, rotation: d.rotation || 0,
          tiers: [
            { distanceFt: targetDist, color: C.green, opacity: 0.12 },
            { distanceFt: targetDist * 0.6, color: C.yellow, opacity: 0.15 },
            { distanceFt: targetDist * 0.3, color: C.red, opacity: 0.2 },
          ],
        })
        continue
      }

      try {
        const input = { resolutionW: resW, resolutionH: resH || resW * 0.5625, sensorW, sensorH: sensorH || sensorW * 0.5625, focalLength, mountHeight, targetDistance: targetDist, tiltAngle }
        const result = calculateFovDori(input)
        const tiers = getFovConeTiers(input)

        // Multi-sensor cameras: populate sensorAngles for per-imager rendering
        let sensorAngles: number[] | undefined
        if (d.category === 'multisensor_quad') {
          const custom = props.sensor_angles as number[] | undefined
          sensorAngles = Array.isArray(custom) && custom.length > 0 ? custom : [0, 90, 180, 270]
        } else if (d.category === 'multisensor_dual') {
          const custom = props.sensor_angles as number[] | undefined
          sensorAngles = Array.isArray(custom) && custom.length > 0 ? custom : [-45, 45]
        } else if (d.category === 'fisheye') {
          // Fisheye: single 360° cone handled by hFov, no multi-imager
          sensorAngles = undefined
        }

        map.set(d.id, {
          hFov: result.hFov,
          rotation: d.rotation || 0,
          tiers: tiers.map((t) => ({ distanceFt: t.distanceFt, color: t.color, opacity: t.opacity })),
          resolutionW: resW,
          sensorW,
          focalLength,
          sensorAngles,
          blindSpotFt: result.blindSpotFt > 0 ? result.blindSpotFt : undefined,
        })
      } catch {
        // Engine didn't run — skip
      }
    }
    return map
  }, [areaDevices])

  // ---- Computed engineering metrics from calculator engine ----
  const cameraTypes = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']
  const networkTypes = ['network', 'switch', 'access_switch', 'rack', 'nvr', 'router', 'firewall', 'wireless_ap', 'bridge', 'server']
  const storageOutput = useMemo(() => {
    const camDevices = areaDevices
      .filter((d: DesignDevice) => cameraTypes.includes(d.category))
      .map((d: DesignDevice) => ({
        id: d.id,
        label: d.label || '',
        category: 'cctv' as const, // normalize for engine filter
        properties: (d.properties ?? {}) as Record<string, unknown>,
      }))
    if (camDevices.length === 0) return null
    const specs = canvasDevicesToCameraSpecs(camDevices)
    if (specs.length === 0) return null
    try {
      return calculateSystemStorage({ cameras: specs, retentionDays: 30, raidLevel: 6, driveSizeTB: 10 })
    } catch { return null }
  }, [areaDevices])

  const requirements: RequirementItem[] = useMemo(() => {
    const areaDevices = devices.filter((d: DesignDevice) => d.area_id === activeAreaId)
    const cameraCount = areaDevices.filter((d: DesignDevice) => d.category === 'cctv').length
    const storageData = calculateSystemStorage({
      cameras: canvasDevicesToCameraSpecs(areaDevices),
      retentionDays: 30, // Default
      raidLevel: 5,      // Default
      driveSizeTB: 10,   // Default
    })
    const totalStorageGb = storageData.totalStorageTB * 1024 // Convert to GB for the bar if needed, or just use TB
    const totalBandwidthMbps = storageData.totalBandwidthMbps
    const totalCost = areaDevices.reduce((sum: number, d: DesignDevice) => sum + (Number(d.properties?.cost) || 0), 0)
    const camCount = areaDevices.filter((d: DesignDevice) => cameraTypes.includes(d.category)).length
    const doorCount = areaDevices.filter((d: DesignDevice) => d.category === 'access_control' || d.category === 'door').length
    const netCount = areaDevices.filter((d: DesignDevice) => networkTypes.includes(d.category)).length
    const avCount = areaDevices.filter((d: DesignDevice) => d.category === 'av' || d.category === 'speaker').length

    const items: RequirementItem[] = [
      { label: 'Cameras', value: camCount, unit: '', status: 'normal' },
      { label: 'Doors', value: doorCount, unit: '', status: 'normal' },
      { label: 'Network', value: netCount, unit: '', status: 'normal' },
      { label: 'AV', value: avCount, unit: '', status: 'normal' },
      { label: 'Total', value: areaDevices.length, unit: 'devices', status: 'normal' },
    ]

    // Engineering metrics — live from calculator engine (gauge bars with required vs in-project)
    if (storageOutput) {
      const bwVal = parseFloat(storageOutput.totalBandwidthMbps.toFixed(1))
      const storVal = parseFloat(storageOutput.totalStorageTB.toFixed(1))
      const poeVal = storageOutput.poeBudget.totalWatts
      const switchVal = storageOutput.poeBudget.recommendedSwitchWatts
      // Baseline requirements: switch capacity is the ceiling for PoE
      items.push(
        { label: 'Bandwidth', value: bwVal, unit: 'Mbps', status: 'normal' as any, separator: true, inProject: bwVal, required: bwVal },
        { label: 'Storage', value: storVal, unit: 'TB', status: (storVal > 100 ? 'deficient' : 'normal') as any, inProject: storVal, required: storVal },
        { label: 'PoE', value: poeVal, unit: 'W', status: (poeVal > switchVal ? 'deficient' : 'normal') as any, inProject: poeVal, required: switchVal },
        { label: 'Switch', value: switchVal, unit: 'W', status: 'normal' as any, inProject: switchVal, required: switchVal },
      )
    }

    return items
  }, [areaDevices, storageOutput, devices, activeAreaId])
  const cableEstimate = useMemo(() => {
    const total = areaCables.reduce((sum: number, c: any) => sum + (c.total_length_ft ?? 0), 0)
    return total > 0 ? `${total.toLocaleString()} ft` : undefined
  }, [areaCables])

  // ---- Handlers ----
  const handleWallCreated = useCallback((points: Array<{ x: number; y: number }>) => {
    if (!activeArea) return
    const newWall = { id: crypto.randomUUID(), points }
    const obs = (activeArea.infrastructure_observations as Record<string, unknown>) || {}
    const currentWalls = (obs.walls as Array<{ id: string; points: Array<{ x: number; y: number }> }>) || []
    updateArea(activeArea.id, { infrastructure_observations: { ...obs, walls: [...currentWalls, newWall] } })
    markSaving()
  }, [activeArea, updateArea, markSaving])

  const handleWallDeleted = useCallback((id: string) => {
    if (!activeArea) return
    const obs = (activeArea.infrastructure_observations as Record<string, unknown>) || {}
    const currentWalls = (obs.walls as Array<{ id: string; points: Array<{ x: number; y: number }> }>) || []
    const newWalls = currentWalls.filter(w => w.id !== id)
    updateArea(activeArea.id, { infrastructure_observations: { ...obs, walls: newWalls } })
    markSaving()
  }, [activeArea, updateArea, markSaving])

  async function handleFloorPlanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !activeAreaId) return
    setFloorPlanError(null)
    const result = await uploadFloorPlan(activeAreaId, file)
    if (!result) setFloorPlanError('Upload failed — check file type and try again.')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleIconChange(tabId: IconTabId) {
    setActiveIcon(tabId)
    setPendingDevice(null)
    if (tabId === 'layers') {
      setShowLeftPanel(true);
      setActiveTool('select')
    } else {
      // Ensure specific icon types launch modal
      setShowDeviceLibrary(true);
      setActiveTool('select')
    }
  }
  const handleDeviceSelected = useCallback((device: DeviceSearchResult) => {
    setPendingDevice(device)
    setShowDeviceLibrary(false)
    setActiveTool('place')
  }, [])
  const handleChangeModel = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId)
    setSelectedZoneId(null)
  }, [setSelectedDeviceId])

  // Change Model from right panel — opens catalog filtered to same category
  const CATEGORY_TO_TAB: Record<string, IconTabId> = {
    cctv: 'camera', dome: 'camera', bullet: 'camera', turret: 'camera', ptz: 'camera', fisheye: 'camera', multisensor_quad: 'camera', multisensor_dual: 'camera',
    access_control: 'door', door: 'door', door_controller: 'door', card_reader: 'door', electric_strike: 'door', maglock: 'door', intercom: 'door',
    network: 'network', switch: 'network', access_switch: 'network', rack: 'network', nvr: 'network', router: 'network', firewall: 'network', wireless_ap: 'network', bridge: 'network', server: 'network',
    av: 'av', speaker: 'av', vape_environmental: 'sensors', other: 'other',
  }
  const handleChangeModelFromPanel = useCallback((deviceId: string, category: string) => {
    const tab = CATEGORY_TO_TAB[category] || 'camera'
    setActiveIcon(tab)
    setShowDeviceLibrary(true)
    setPendingDevice(null)
  }, [])
  // Auto-cable: when door hardware is placed, auto-create cable to nearest door_controller
  const autoCableDoorToController = useCallback(async (newDevice: DesignDevice) => {
    // Gate 1: only access_control category devices can auto-cable
    if (newDevice.category !== 'access_control' && newDevice.category !== 'door') return
    const subType = String((newDevice.properties as Record<string, unknown>)?.sub_type || '')
    // Gate 2: only door hardware — not controllers themselves
    if (!isDoorType(subType) || subType === 'door_controller') return

    // Find nearest door_controller in same area
    const controllers = areaDevices.filter(d => {
      const st = String((d.properties as Record<string, unknown>)?.sub_type || '')
      return st === 'door_controller'
    })
    if (controllers.length === 0) return

    let nearest = controllers[0]
    let nearestDist = Infinity
    for (const ctrl of controllers) {
      const dx = ctrl.position_x - newDevice.position_x
      const dy = ctrl.position_y - newDevice.position_y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < nearestDist) { nearestDist = dist; nearest = ctrl }
    }

    const lengthFt = scalePxPerFt > 0 ? Math.round(nearestDist / scalePxPerFt) : 0
    await addCable({
      area_id: newDevice.area_id,
      from_device_id: newDevice.id,
      to_device_id: nearest.id,
      waypoints: [
        { x: newDevice.position_x, y: newDevice.position_y },
        { x: nearest.position_x, y: nearest.position_y },
      ],
      length_ft: lengthFt,
      cable_type: '2_conductor',
    })
  }, [areaDevices, scalePxPerFt, addCable])
  const handleCanvasClick = useCallback(async (x: number, y: number) => {
    if (activeTool !== 'place' || !activeAreaId || activeIcon === 'layers') return
    if (!pendingDevice) return  // Must select a device from library first
    if (placingRef.current) return
    placingRef.current = true
    try {
      const category = pendingDevice.category || TAB_TO_CATEGORY[activeIcon] || 'other'
      const subType = pendingDevice.subcategory || TAB_TO_SUBTYPE[activeIcon] || 'junction_box'
      const prefix = LABEL_CODES[subType] || LABEL_CODES[category] || 'DEV'
      const props: Record<string, unknown> = {
        sub_type: subType,
        manufacturer: pendingDevice.vendor,
        model: pendingDevice.model,
        part_number: pendingDevice.partnumber,
        ndaa_compliant: pendingDevice.ndaa_compliant,
        ...(pendingDevice.specs ?? {}),
      }
      if (pendingDevice.resolution) props.resolution = pendingDevice.resolution
      if (pendingDevice.wattage) props.poe_watts = pendingDevice.wattage
      if (pendingDevice.poe_standard) props.poe_standard = pendingDevice.poe_standard

      let px = x, py = y
      if (snapToGrid) { px = Math.round(px / GRID_SIZE) * GRID_SIZE; py = Math.round(py / GRID_SIZE) * GRID_SIZE }

      const newDev = await addDevice({
        area_id: activeAreaId, category, position_x: px, position_y: py,
        color_hex: C.accent, label_prefix: prefix,
        device_library_item_id: pendingDevice.id,
        properties: props,
      })
      markSaving()
      if (newDev) await autoCableDoorToController(newDev)
    } finally {
      placingRef.current = false
    }
  }, [activeTool, activeAreaId, activeIcon, addDevice, pendingDevice, snapToGrid, markSaving, autoCableDoorToController])

  // ---- Undo / Redo ----
  const pushUndo = useCallback((action: { undo: () => Promise<void>; redo: () => Promise<void> }) => {
    setUndoStack((prev: Array<{ undo: () => Promise<void>; redo: () => Promise<void> }>) => [...prev.slice(-(UNDO_STACK_DEPTH - 1)), action])
    setRedoStack([])
  }, [])
  const handleUndo = useCallback(async () => {
    const action = undoStack[undoStack.length - 1]
    if (!action) return
    await action.undo()
    setUndoStack((prev: Array<{ undo: () => Promise<void>; redo: () => Promise<void> }>) => prev.slice(0, -1))
    setRedoStack((prev: Array<{ undo: () => Promise<void>; redo: () => Promise<void> }>) => [...prev, action])
  }, [undoStack])
  const handleRedo = useCallback(async () => {
    const action = redoStack[redoStack.length - 1]
    if (!action) return
    await action.redo()
    setRedoStack((prev: Array<{ undo: () => Promise<void>; redo: () => Promise<void> }>) => prev.slice(0, -1))
    setUndoStack((prev: Array<{ undo: () => Promise<void>; redo: () => Promise<void> }>) => [...prev, action])
  }, [redoStack])

  const handleDeviceMoved = useCallback(async (id: string, x: number, y: number) => {
    const device = devices.find((d: DesignDevice) => d.id === id)
    const prevX = device?.position_x ?? x, prevY = device?.position_y ?? y
    markSaving()
    await updateDevice(id, { position_x: x, position_y: y })
    pushUndo({
      undo: async () => { await updateDevice(id, { position_x: prevX, position_y: prevY }) },
      redo: async () => { await updateDevice(id, { position_x: x, position_y: y }) },
    })
  }, [devices, updateDevice, pushUndo, markSaving])
  const handleDeviceRotated = useCallback(async (id: string, angle: number) => {
    const device = devices.find((d: DesignDevice) => d.id === id)
    const prevAngle = device?.rotation ?? 0
    markSaving()
    await updateDevice(id, { rotation: angle })
    pushUndo({
      undo: async () => { await updateDevice(id, { rotation: prevAngle }) },
      redo: async () => { await updateDevice(id, { rotation: angle }) },
    })
  }, [devices, updateDevice, pushUndo, markSaving])
  const handleSensorRotated = useCallback(async (id: string, index: number, angle: number) => {
    const device = devices.find((d: DesignDevice) => d.id === id)
    if (!device) return
    const props = (device.properties ?? {}) as Record<string, unknown>
    const currentAngles = (props.sensor_angles as number[]) || []
    const newAngles = [...currentAngles]
    
    // Ensure array is long enough
    while (newAngles.length <= index) newAngles.push(0)
    
    const prevAngle = newAngles[index]
    newAngles[index] = angle
    
    markSaving()
    await updateDevice(id, { properties: { ...props, sensor_angles: newAngles } })
    pushUndo({
      undo: async () => { 
        const latest = devices.find((d: DesignDevice) => d.id === id)
        const latestProps = (latest?.properties ?? {}) as Record<string, unknown>
        const undoAngles = [...((latestProps.sensor_angles as number[]) || [])]
        undoAngles[index] = prevAngle
        await updateDevice(id, { properties: { ...latestProps, sensor_angles: undoAngles } }) 
      },
      redo: async () => { 
        const latest = devices.find((d: DesignDevice) => d.id === id)
        const latestProps = (latest?.properties ?? {}) as Record<string, unknown>
        const redoAngles = [...((latestProps.sensor_angles as number[]) || [])]
        redoAngles[index] = angle
        await updateDevice(id, { properties: { ...latestProps, sensor_angles: redoAngles } }) 
      },
    })
  }, [devices, updateDevice, pushUndo, markSaving])
  const handleFovDragged = useCallback(async (deviceId: string, targetDistanceFt: number) => {
    markSaving()
    await updateDevice(deviceId, { properties: { ...((devices.find((d: DesignDevice) => d.id === deviceId)?.properties ?? {}) as Record<string, unknown>), target_distance: targetDistanceFt } })
  }, [devices, updateDevice, markSaving])
  const handleDeviceCopy = useCallback(async (id: string) => {
    const src = devices.find((d: DesignDevice) => d.id === id); if (!src) return
    const srcProps = (src.properties ?? {}) as Record<string, unknown>
    const subType = (srcProps.sub_type as string) || ''
    const prefix = LABEL_CODES[subType] || LABEL_CODES[src.category] || 'DEV'
    await addDevice({ area_id: src.area_id, category: src.category, position_x: src.position_x + 40, position_y: src.position_y + 40, color_hex: src.color_hex, rotation: src.rotation, label_prefix: prefix, properties: src.properties, device_library_item_id: src.device_library_item_id, mount_type: src.mount_type, status: src.status })
    markSaving()
  }, [devices, addDevice, markSaving])
  const handleDeviceDelete = useCallback(async (id: string) => { await deleteDevice(id); markSaving() }, [deleteDevice, markSaving])
  const handleCableCreated = useCallback(async (cable: { from_device_id: string; to_device_id: string | null; waypoints: Array<{ x: number; y: number }>; length_ft: number }) => {
    await addCable({ area_id: activeAreaId, from_device_id: cable.from_device_id, to_device_id: cable.to_device_id, waypoints: cable.waypoints, length_ft: cable.length_ft, cable_type: 'cat6' })
    markSaving()
  }, [addCable, activeAreaId, markSaving])

  // Zone handlers
  const handleZoneCreated = useCallback(async (zone: { name: string; color: string; x: number; y: number; width: number; height: number }) => {
    await addZone(zone)
  }, [addZone])
  const handleZoneMoved = useCallback(async (id: string, x: number, y: number) => { await updateZone(id, { x, y }) }, [updateZone])
  const handleZoneResized = useCallback(async (id: string, width: number, height: number) => { await updateZone(id, { width, height }) }, [updateZone])
  const handleSelectZone = useCallback((id: string | null) => { setSelectedZoneId(id); if (id) setSelectedDeviceId(null) }, [setSelectedDeviceId])
  const handleSelectDevice = useCallback((id: string | null) => { setSelectedDeviceId(id); if (id) setSelectedZoneId(null) }, [setSelectedDeviceId])
  const handleDeleteZone = useCallback(async (id: string) => { await deleteZone(id); if (selectedZoneId === id) setSelectedZoneId(null) }, [deleteZone, selectedZoneId])

  // MDF/IDF handlers
  const handleMdfIdfPlaced = useCallback(async (x: number, y: number) => {
    if (!activeAreaId) return
    const count = mdfIdfs.filter(n => n.area_id === activeAreaId).length
    await addInfrastructure({
      area_id: activeAreaId,
      name: count === 0 ? 'MDF' : `IDF-${count}`,
      position_x: x,
      position_y: y,
      color_hex: '#f97316',
      service_loop_ft: 10,
    })
    markSaving()
  }, [activeAreaId, mdfIdfs, addInfrastructure, markSaving])
  const handleMdfIdfMoved = useCallback(async (id: string, x: number, y: number) => {
    markSaving()
    await updateInfrastructure(id, { position_x: x, position_y: y })
  }, [updateInfrastructure, markSaving])
  const handleMdfIdfDeleted = useCallback(async (id: string) => {
    markSaving()
    await deleteInfrastructure(id)
  }, [deleteInfrastructure, markSaving])

  // Area rename handlers
  function handleAreaDoubleClick(areaId: string, name: string) {
    setEditingAreaId(areaId)
    setEditAreaValue(name)
  }
  function handleAreaRenameBlur(id: string) {
    if (editAreaValue.trim() && editAreaValue.trim() !== areas.find(a => a.id === id)?.name) {
      updateArea(id, { name: editAreaValue.trim() })
    }
    setEditingAreaId(null)
  }

  async function handleDeleteDesign() {
    try {
      const res = await fetch(`/api/org/designs/${designId}`, { method: 'DELETE' })
      if (res.ok) router.push('/org/designs')
    } catch { /* handled by toast in hook */ }
  }

  async function handleDeleteFloorPlan() {
    const fp = floorPlans.find((f) => f.area_id === activeAreaId)
    if (!fp) return
    try {
      const res = await fetch(`/api/org/designs/${designId}/floor-plans?plan_id=${fp.id}`, { method: 'DELETE' })
      if (res.ok) await refetch()
    } catch { /* handled by toast */ }
  }

  // ---- Drag & Drop from catalog to canvas ----
  const handleDeviceDrop = useCallback(async (x: number, y: number, deviceData: string) => {
    if (!activeAreaId) return
    try {
      const item = JSON.parse(deviceData) as DeviceSearchResult
      const category = item.category || TAB_TO_CATEGORY[activeIcon] || 'other'
      const subType = item.subcategory || TAB_TO_SUBTYPE[activeIcon] || 'junction_box'
      const prefix = LABEL_CODES[subType] || LABEL_CODES[category] || 'DEV'
      let px = x, py = y
      if (snapToGrid) { px = Math.round(px / GRID_SIZE) * GRID_SIZE; py = Math.round(py / GRID_SIZE) * GRID_SIZE }
      const props: Record<string, unknown> = {
        sub_type: subType, manufacturer: item.vendor, model: item.model,
        part_number: item.partnumber, ndaa_compliant: item.ndaa_compliant,
        ...(item.specs ?? {}),
      }
      if (item.resolution) props.resolution = item.resolution
      if (item.wattage) props.poe_watts = item.wattage
      if (item.poe_standard) props.poe_standard = item.poe_standard
      const newDev = await addDevice({
        area_id: activeAreaId, category, position_x: px, position_y: py,
        color_hex: C.accent, label_prefix: prefix,
        device_library_item_id: item.id, properties: props,
      })
      markSaving()
      if (newDev) await autoCableDoorToController(newDev)
    } catch (err) { console.error('Drop failed:', err) }
  }, [activeAreaId, activeIcon, addDevice, snapToGrid, markSaving, autoCableDoorToController])

  const selectedDevice = selectedDeviceId ? devices.find((d: DesignDevice) => d.id === selectedDeviceId) ?? null : null
  const selectedZone = selectedZoneId ? zones.find((z) => z.id === selectedZoneId) ?? null : null

  // Close layer menu on outside click
  useEffect(() => {
    if (!showLayerMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (layerMenuRef.current && !layerMenuRef.current.contains(e.target as Node)) setShowLayerMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showLayerMenu])

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setShowExportMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExportMenu])

  // Close floor plan menu on outside click
  useEffect(() => {
    if (!showFloorPlanMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (floorPlanMenuRef.current && !floorPlanMenuRef.current.contains(e.target as Node)) setShowFloorPlanMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFloorPlanMenu])

  // Close overflow menu on outside click
  useEffect(() => {
    if (!showOverflowMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) setShowOverflowMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOverflowMenu])

  // Export handler
  const handleExport = useCallback(async (type: 'bom' | 'material-list' | 'hardware-schedule' | 'cable-schedule' | 'snapshot') => {
    setExporting(true)
    setShowExportMenu(false)
    try {
      if (type === 'snapshot') {
        const dataUrl = snapshotRef.current?.() ?? null
        exportCanvasSnapshot(dataUrl, design?.name ?? 'Design')
      } else if (type === 'bom') {
        await exportBom(designId)
      } else if (type === 'material-list') {
        await exportMaterialList(designId)
      } else if (type === 'hardware-schedule') {
        await exportHardwareSchedule(designId)
      } else if (type === 'cable-schedule') {
        await exportCableSchedule(designId)
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }, [designId, design?.name])

  // Satellite auto-load: geocode OPP address → update area with lat/lng → dismiss welcome modal
  const handleAddLocation = useCallback(async () => {
    const address = (opp?.install_address as string)?.trim()
    if (!address || !activeAreaId) {
      toast.error(!address ? 'No install address on opportunity' : 'No active area selected')
      return
    }
    setSatelliteLoading(true)
    try {
      const res = await fetch('/api/org/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        toast.error(`Geocode failed (${res.status}): ${(errBody as Record<string, string>).error || 'Unknown error'}`)
        return
      }
      const { lat, lng } = await res.json()
      if (!lat || !lng) { toast.error('Geocode returned no coordinates'); return }
      const updated = await updateArea(activeAreaId, { satellite_lat: lat, satellite_lng: lng, satellite_zoom: 19 })
      if (!updated) { toast.error('Failed to save satellite coordinates'); return }
      await refetch()
      setWelcomeDismissed(true)
    } catch (err) {
      console.error('Add location failed:', err)
      toast.error(`Satellite location failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSatelliteLoading(false)
    }
  }, [opp, activeAreaId, updateArea, refetch])

  // Auto-load satellite on area open when no satellite exists and opp has address
  const autoLoadedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!activeAreaId || hasSatellite || !opp?.install_address || satelliteLoading) return
    if (autoLoadedRef.current.has(activeAreaId)) return
    autoLoadedRef.current.add(activeAreaId)
    handleAddLocation()
  }, [activeAreaId, hasSatellite, opp?.install_address, satelliteLoading, handleAddLocation])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: C.bg, color: C.textMuted, fontSize: 13 }}>Loading design...</div>
  if (error || !design) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: C.bg, color: C.red, fontSize: 13 }}>{error ?? 'Design not found'}</div>

  // --- Toolbar button style helper ---
  const toolBtn = (active: boolean, activeColor?: string) => ({
    display: 'flex' as const, alignItems: 'center' as const, gap: 3,
    padding: '3px 8px', fontSize: 10, fontWeight: 500 as const, fontFamily: 'inherit' as const,
    borderRadius: 5, cursor: 'pointer' as const,
    border: `0.5px solid ${active ? (activeColor || C.accent) : C.border}`,
    background: active ? `${activeColor || C.accent}18` : 'transparent',
    color: active ? (activeColor || C.accent) : C.textMuted,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, overflow: 'hidden' }}>
      {/* ========== SINGLE CONSOLIDATED TOP BAR — 40px ========== */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 40, minHeight: 40,
        padding: '0 10px', gap: 6,
        background: C.bgSurface, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        {/* LEFT: Back + Project Name */}
        <button onClick={() => onNavigateDashboard ? onNavigateDashboard() : router.push('/org/designs')} style={{ display: 'flex', alignItems: 'center', color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={14} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: 8, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{projectName}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{design.name}</div>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }} />

        {/* CENTER: View Tabs */}
        <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setActiveView(v.id)}
              style={{
                padding: '4px 8px', fontSize: 10, fontWeight: activeView === v.id ? 600 : 400,
                color: activeView === v.id ? C.accent : C.textMuted,
                background: activeView === v.id ? C.accentSubtle : 'transparent',
                border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Separator — only in canvas views when areas exist */}
        {activeView !== 'network_topology' && areas.length > 0 && (
          <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }} />
        )}

        {/* AREA TABS — compact inline pills, canvas views only */}
        {activeView !== 'network_topology' && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', overflow: 'hidden', flexShrink: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 2, overflow: 'auto', alignItems: 'center' }}>
              {areas.map((area) => {
                const isActive = activeAreaId === area.id
                const isEditing = editingAreaId === area.id
                return (
                  <div key={area.id}
                    onClick={() => { setActiveAreaId(area.id); setActiveTool('select'); setActiveIcon('layers') }}
                    onDoubleClick={() => handleAreaDoubleClick(area.id, area.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '2px 8px', height: 24, fontSize: 10, fontWeight: isActive ? 600 : 400,
                      color: isActive ? C.text : C.textMuted,
                      background: isActive ? C.bgActive : 'transparent',
                      border: isActive ? `1px solid ${C.border}` : '1px solid transparent',
                      borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                    {isEditing ? (
                      <input value={editAreaValue} onChange={(e) => setEditAreaValue(e.target.value)}
                        onBlur={() => handleAreaRenameBlur(area.id)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleAreaRenameBlur(area.id); if (e.key === 'Escape') setEditingAreaId(null) }}
                        autoFocus
                        style={{ background: 'transparent', border: 'none', color: C.text, fontSize: 10, width: 60, outline: 'none', fontFamily: 'inherit' }}
                      />
                    ) : (
                      <span>{area.name}</span>
                    )}
                    {isActive && areas.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); deleteArea(area.id) }}
                        style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', padding: 0, display: 'flex', lineHeight: 1 }}>
                        <X size={10} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <button onClick={() => addArea(`Area ${String.fromCharCode(65 + areas.length)}`, 'FLOOR_PLAN')}
              style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 4, color: C.textDim, cursor: 'pointer', flexShrink: 0 }}>
              <Plus size={11} />
            </button>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Mode indicator */}
        {activeTool !== 'select' && activeTool !== 'place' && (
          <span style={{ fontSize: 9, color: C.green, background: 'rgba(34,197,94,0.12)', padding: '2px 7px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase' }}>{activeTool}</span>
        )}

        {/* Save status */}
        {saveStatus !== 'idle' && (
          <span style={{
            fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 3,
            color: saveStatus === 'saving' ? C.yellow : C.green,
            background: saveStatus === 'saving' ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
            transition: 'all 0.3s',
          }}>
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </span>
        )}

        {/* RIGHT: Tool buttons — canvas views only */}
        {activeView !== 'network_topology' && (<>

        {/* ── Drawing ── */}
        <span style={{ fontSize: 8, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 0 }}>Draw</span>
        <button onClick={handleUndo} disabled={undoStack.length === 0}
          style={{ ...toolBtn(false), opacity: undoStack.length === 0 ? 0.3 : 1 }} title="Undo (Ctrl+Z)">
          <Undo2 size={12} />
        </button>
        <button onClick={handleRedo} disabled={redoStack.length === 0}
          style={{ ...toolBtn(false), opacity: redoStack.length === 0 ? 0.3 : 1 }} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={12} />
        </button>
        <button onClick={() => setSnapToGrid(!snapToGrid)} style={toolBtn(snapToGrid, C.green)} title="Snap to Grid (N)">
          <Magnet size={12} /> <span>Snap</span>
        </button>
        <button onClick={() => { setActiveTool('scale'); }} style={toolBtn(activeTool === 'scale', C.red)} title="Calibrate Scale (S)">
          <Ruler size={12} /> <span>Scale</span>
        </button>
        <button onClick={() => setActiveTool('mdf_idf')} style={toolBtn(activeTool === 'mdf_idf', C.orange)} title="Place MDF/IDF (M)">
          <Server size={12} /> <span>MDF</span>
        </button>

        <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />

        {/* ── View ── */}
        <span style={{ fontSize: 8, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 0 }}>View</span>
        <div style={{ position: 'relative' }} ref={layerMenuRef}>
          <button onClick={() => setShowLayerMenu(!showLayerMenu)} style={toolBtn(showLayerMenu)} title="Layer Visibility (L)">
            <Layers size={12} /> <span>Layers</span>
          </button>
          {showLayerMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
              background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '6px 0', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {[
                { key: 'cctv', label: 'Cameras', aliases: ['dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'] },
                { key: 'access_control', label: 'Access Control', aliases: ['door', 'door_controller', 'card_reader', 'electric_strike', 'maglock', 'intercom'] },
                { key: 'network', label: 'Network', aliases: ['switch', 'access_switch', 'rack', 'nvr', 'router', 'firewall', 'wireless_ap', 'bridge', 'server', 'monitor', 'patch_panel'] },
                { key: 'av', label: 'AV', aliases: ['speaker'] },
                { key: 'vape_environmental', label: 'Sensors', aliases: [] },
                { key: 'other', label: 'Other', aliases: [] },
              ].map((layer) => {
                const allKeys = [layer.key, ...layer.aliases]
                const isHidden = allKeys.some(k => hiddenCategories.has(k))
                return (
                  <div key={layer.key}
                    onClick={() => allKeys.forEach(k => {
                      setHiddenCategories((prev: Set<string>) => {
                        const next = new Set(prev)
                        if (isHidden) allKeys.forEach(a => next.delete(a))
                        else allKeys.forEach(a => next.add(a))
                        return next
                      })
                    })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px',
                      cursor: 'pointer', fontSize: 11, color: isHidden ? C.textDim : C.text,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>{layer.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <button onClick={() => setShowFovCones(!showFovCones)} style={toolBtn(showFovCones)} title="Toggle FOV Cones (F)">
          {showFovCones ? <Eye size={12} /> : <EyeOff size={12} />} <span>FOV</span>
        </button>
        {showFovCones && (
          <button onClick={() => setFovDisplayMode(fovDisplayMode === 'ppf' ? 'dori' : 'ppf')}
            style={toolBtn(fovDisplayMode === 'dori', C.green)} title="Toggle PPF / DORI labels">
            <span style={{ fontSize: 9, fontWeight: 600 }}>{fovDisplayMode === 'dori' ? 'DORI' : 'PPF'}</span>
          </button>
        )}
        <button onClick={() => setShowGrid(!showGrid)} style={toolBtn(showGrid)} title="Toggle Grid (G)">
          <Grid3X3 size={12} />
        </button>

        <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />

        {/* ── Floor Plan dropdown ── */}
        <div style={{ position: 'relative' }} ref={floorPlanMenuRef}>
          <button onClick={() => setShowFloorPlanMenu(!showFloorPlanMenu)} style={toolBtn(showFloorPlanMenu)} title="Floor Plan Options">
            <Upload size={12} /> <span style={{ fontSize: 9 }}>{activeFloorPlan ? 'Floor Plan' : 'Upload'}</span> <ChevronDown size={9} />
          </button>
          {showFloorPlanMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
              background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '6px 0', minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <div onClick={() => { fileInputRef.current?.click(); setShowFloorPlanMenu(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 11, color: C.text }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <Upload size={12} /> {activeFloorPlan ? 'Replace Floor Plan' : 'Upload Floor Plan'}
              </div>
              {activeFloorPlan && (
                <>
                  <div onClick={() => { setConfirmAction({ label: 'Delete floor plan?', action: handleDeleteFloorPlan }); setShowFloorPlanMenu(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 11, color: C.red }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <ImageOff size={12} /> Remove Floor Plan
                  </div>
                  <div style={{ borderTop: `1px solid ${C.border}`, margin: '4px 0' }} />
                  <div style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: C.textDim }}>Opacity</span>
                    <input type="range" min="0" max="100" value={Math.round(floorPlanOpacity * 100)}
                      onChange={(e) => setFloorPlanOpacity(parseInt(e.target.value) / 100)}
                      style={{ width: 70, height: 3, accentColor: C.accent, cursor: 'pointer' }} />
                    <span style={{ fontSize: 9, color: C.textDim, fontFamily: "'IBM Plex Mono'", minWidth: 22 }}>{Math.round(floorPlanOpacity * 100)}%</span>
                  </div>
                </>
              )}
              {/* Satellite controls — inside floor plan menu */}
              {hasSatellite && (
                <>
                  <div style={{ borderTop: `1px solid ${C.border}`, margin: '4px 0' }} />
                  <div style={{ padding: '4px 14px' }}>
                    <span style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Satellite</span>
                  </div>
                  <div style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: C.textDim }}>Opacity</span>
                    <input type="range" min="0" max="100" value={Math.round(satelliteOpacity * 100)}
                      onChange={(e) => setSatelliteOpacity(parseInt(e.target.value) / 100)}
                      style={{ width: 70, height: 3, accentColor: C.accent, cursor: 'pointer' }} />
                    <span style={{ fontSize: 9, color: C.textDim, fontFamily: "'IBM Plex Mono'", minWidth: 22 }}>{Math.round(satelliteOpacity * 100)}%</span>
                  </div>
                  <div onClick={handleAddLocation}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 11, color: C.text }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <MapIcon size={12} /> Re-geocode
                  </div>
                </>
              )}
              {/* Add Location — when no satellite yet, allow geocoding from floor plan menu */}
              {!hasSatellite && !!opp?.install_address && (
                <>
                  <div style={{ borderTop: `1px solid ${C.border}`, margin: '4px 0' }} />
                  <div onClick={() => { handleAddLocation(); setShowFloorPlanMenu(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: satelliteLoading ? 'wait' : 'pointer', fontSize: 11, color: C.text }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <MapIcon size={12} /> {satelliteLoading ? 'Loading...' : 'Add Satellite Location'}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".svg,.pdf,.png,.jpg,.jpeg" onChange={handleFloorPlanUpload} style={{ display: 'none' }} />

        {/* Satellite location — add or change */}
        {!!opp?.install_address && (
          <button onClick={handleAddLocation} disabled={satelliteLoading}
            style={{ ...toolBtn(hasSatellite, hasSatellite ? '#10b981' : undefined), cursor: satelliteLoading ? 'wait' : 'pointer', opacity: satelliteLoading ? 0.5 : 1 }}
            title={hasSatellite ? 'Re-geocode satellite from address' : `Add Satellite: ${(opp.install_address as string).slice(0, 50)}`}>
            <MapIcon size={12} /> <span style={{ fontSize: 9 }}>{satelliteLoading ? 'Loading...' : hasSatellite ? 'Location' : 'Satellite'}</span>
          </button>
        )}

        <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />

        {/* ── Panels ── */}
        <button onClick={() => setShowRequirements(!showRequirements)} style={toolBtn(showRequirements)}
          title="Requirements Bar (R)">
          <BarChart3 size={12} />
        </button>
        <button onClick={() => setShowStoragePanel(!showStoragePanel)} style={toolBtn(showStoragePanel)}
          title="Storage Panel (T)">
          <HardDrive size={12} />
        </button>
        <button onClick={() => setShowCameraAdvisor(!showCameraAdvisor)} style={toolBtn(showCameraAdvisor)}
          title="Camera Advisor">
          <Eye size={12} /> Advisor
        </button>
        <button onClick={() => setShowMinimap(!showMinimap)} style={toolBtn(showMinimap)}
          title="Minimap">
          <MapIcon size={12} />
        </button>

        {/* Export dropdown */}
        <div style={{ position: 'relative' }} ref={exportMenuRef}>
          <button onClick={() => setShowExportMenu(!showExportMenu)}
            style={{ ...toolBtn(showExportMenu), opacity: exporting ? 0.5 : 1 }}
            title="Export design" disabled={exporting}>
            <Download size={12} /> <span>{exporting ? '...' : 'Export'}</span>
          </button>
          {showExportMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
              background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '6px 0', minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {([
                { key: 'bom', label: 'Bill of Materials (XLSX)' },
                { key: 'material-list', label: 'Material List (XLSX)' },
                { key: 'hardware-schedule', label: 'Hardware Schedule (XLSX)' },
                { key: 'cable-schedule', label: 'Cable Schedule (XLSX)' },
                { key: 'snapshot', label: 'Canvas Snapshot (PNG)' },
              ] as const).map((item) => (
                <div key={item.key}
                  onClick={() => handleExport(item.key)}
                  style={{
                    padding: '6px 14px', cursor: 'pointer', fontSize: 11, color: C.text,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  {item.label}
                </div>
              ))}
              <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
              <div onClick={() => { setShowReport(true); setShowExportMenu(false) }}
                style={{ padding: '6px 14px', cursor: 'pointer', fontSize: 11, color: C.accent, fontWeight: 600, transition: 'background 0.1s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                📄 Site Report (PDF)
              </div>
            </div>
          )}
        </div>

        {/* Overflow menu (delete design etc.) */}
        <div style={{ position: 'relative' }} ref={overflowMenuRef}>
          <button onClick={() => setShowOverflowMenu(!showOverflowMenu)} style={toolBtn(showOverflowMenu)}
            title="More options">
            <MoreVertical size={12} />
          </button>
          {showOverflowMenu && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
              background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '6px 0', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <div onClick={() => { setConfirmAction({ label: 'Delete this entire design?', action: handleDeleteDesign }); setShowOverflowMenu(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 11, color: C.red }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <Trash2 size={12} /> Delete Design
              </div>
            </div>
          )}
        </div>

        </>)}
      </div>

      {/* ========== COLLAPSIBLE REQUIREMENTS BAR ========== */}
      {showRequirements && <RequirementsBar requirements={requirements} cableEstimate={cableEstimate} />}

      {/* Floor plan error banner */}
      {floorPlanError && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.3)', fontSize: 11, color: '#ef4444', flexShrink: 0 }}>
          <span>{floorPlanError}</span>
          <button onClick={() => setFloorPlanError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>x</button>
        </div>
      )}

      {/* ========== MAIN CONTENT — CANVAS + OVERLAY PANELS ========== */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {activeView === 'network_topology' ? (
            <div className="flex-1 flex overflow-hidden bg-background">
              <TopologyView
                designId={designId}
                nodes={topologyNodes}
                links={topologyLinks}
                onAddNode={addTopologyNode}
                onUpdateNode={updateTopologyNode}
                onDeleteNode={deleteTopologyNode}
                onAddLink={addTopologyLink}
                onUpdateLink={updateTopologyLink}
                onDeleteLink={deleteTopologyLink}
              />
            </div>
          ) : (
          <>
            <IconSidebar activeIcon={activeIcon} onIconChange={handleIconChange} />

            {/* Left panel — OVERLAY, does not push canvas */}
            {showLeftPanel && (
              <div style={{
                position: 'absolute', left: 52, top: 0, bottom: 0, zIndex: 10,
                boxShadow: '4px 0 12px rgba(0,0,0,0.3)',
              }}>
                <LeftPanel devices={areaDevices} selectedId={selectedDeviceId}
                  onSelectDevice={(id) => { handleSelectDevice(id); setActiveTool('select') }}
                  onChangeModel={handleChangeModel}
                  zones={zones} selectedZoneId={selectedZoneId}
                  onSelectZone={(id) => { handleSelectZone(id); setActiveTool('select') }}
                  onDeleteZone={handleDeleteZone}
                  activeCategory={activeIcon !== 'layers' ? (TAB_TO_CATEGORY[activeIcon] || activeIcon) : null}
                  onDeviceSelected={handleDeviceSelected}
                  pendingDevice={pendingDevice} />
              </div>
            )}

            <CanvasArea designId={designId} areaId={activeAreaId} floorPlan={activeFloorPlan}
              devices={areaDevices} cables={areaCables} showGrid={showGrid} activeTool={activeTool}
              selectedDeviceId={selectedDeviceId} showFovCones={showFovCones} fovData={fovData}
              scalePxPerFt={scalePxPerFt}
              zones={zones} selectedZoneId={selectedZoneId}
              walls={walls} onWallCreated={handleWallCreated} onWallDeleted={handleWallDeleted}
              onZoneCreated={handleZoneCreated} onZoneMoved={handleZoneMoved}
              onZoneResized={handleZoneResized} onSelectZone={handleSelectZone}
              onZoomChange={() => {}} onSelectDevice={handleSelectDevice}
              onDeviceMoved={handleDeviceMoved} onDeviceRotated={handleDeviceRotated}
              onSensorRotated={handleSensorRotated}
              onCanvasClick={handleCanvasClick} onDeviceCopy={handleDeviceCopy} onDeviceDelete={handleDeviceDelete}
              onCableCreated={handleCableCreated}
              onToolChange={(t) => setActiveTool(t)}
              onScaleCalibrated={(px) => setScalePxPerFt(px)}
              onFloorPlanError={(msg) => setFloorPlanError(msg)}
              pendingDeviceName={pendingDevice ? `${pendingDevice.vendor} ${pendingDevice.model}` : undefined}
              onDeviceDrop={handleDeviceDrop}
              snapToGrid={snapToGrid}
              hiddenCategories={hiddenCategories}
              onUndo={handleUndo}
              onRedo={handleRedo}
              floorPlanOpacity={floorPlanOpacity}
              onFovHandleDragged={handleFovDragged}
              fovDisplayMode={fovDisplayMode}
              highlightedPpfTier={highlightedPpfTier}
              onPpfTierClick={setHighlightedPpfTier}
              mdfIdfs={mdfIdfs.filter(n => n.area_id === activeAreaId)}
              onMdfIdfPlaced={handleMdfIdfPlaced}
              onMdfIdfMoved={handleMdfIdfMoved}
              onMdfIdfDeleted={handleMdfIdfDeleted}
              snapshotRef={snapshotRef}
              showMinimap={showMinimap}
              onShow3dPreview={(device: DesignDevice) => {
                setSelectedDeviceId(device.id)
                setShow3dPreview(true)
              }}
              satelliteConfig={activeArea?.satellite_lat != null && activeArea?.satellite_lng != null ? {
                lat: activeArea.satellite_lat,
                lng: activeArea.satellite_lng,
                zoom: activeArea.satellite_zoom ?? 19,
                opacity: satelliteOpacity,
              } : null} />

            {/* Right panel — OVERLAY, when device or zone selected */}
            {(selectedDevice || selectedZone) && (
              <div style={{
                position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
                boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
              }}>
                <RightPanel device={selectedDevice}
                  onClose={() => setSelectedDeviceId(null)} onDuplicate={handleDeviceCopy} onDelete={handleDeviceDelete}
                  onUpdateDevice={(id, updates) => { updateDevice(id, updates as Record<string, unknown>); markSaving() }}
                  onChangeModel={handleChangeModelFromPanel}
                  selectedZone={selectedZone}
                  onUpdateZone={(id, updates) => updateZone(id, updates)}
                  onDeleteZone={handleDeleteZone}
                  onCloseZone={() => setSelectedZoneId(null)}
                  zones={zones} />
              </div>
            )}

            {/* Storage panel — OVERLAY, right side */}
            {showStoragePanel && (
              <div style={{
                position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 9,
                boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
              }}>
                <StorageCalculatorPanel
                  devices={devices.filter((d: DesignDevice) => d.area_id === activeAreaId)}
                  onClose={() => setShowStoragePanel(false)}
                />
              </div>
            )}

            {/* Camera Advisor — OVERLAY, right side */}
            {showCameraAdvisor && (
              <div style={{
                position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 9,
                boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
              }}>
                <CameraAdvisor
                  onClose={() => setShowCameraAdvisor(false)}
                />
              </div>
            )}

            {/* Device Comparison — OVERLAY, right side */}
            {showComparison && (
              <div style={{
                position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 9,
                boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
              }}>
                <DeviceComparison
                  devices={devices.filter((d: DesignDevice) => d.area_id === activeAreaId)}
                  compareIds={compareIds}
                  onClose={() => setShowComparison(false)}
                  onRemove={(id) => setCompareIds((prev) => prev.filter((i) => i !== id))}
                />
              </div>
            )}

            {show3dPreview && selectedDeviceId && (
              <Camera3dPreview
                device={devices.find((d: DesignDevice) => d.id === selectedDeviceId)!}
                floorPlan={activeFloorPlan}
                scalePxPerFt={scalePxPerFt}
                onClose={() => setShow3dPreview(false)}
              />
            )}

            {/* Report Generator modal */}
            {showReport && (
              <ReportGenerator
                designName={design?.name ?? 'Untitled Design'}
                areaName={activeArea?.name}
                devices={devices.filter((d: DesignDevice) => d.area_id === activeAreaId)}
                canvasSnapshotFn={snapshotRef.current ?? undefined}
                onClose={() => setShowReport(false)}
              />
            )}

            {/* Welcome modal — shown when no floor plan and not dismissed */}
            {!activeFloorPlan && !welcomeDismissed && areaDevices.length === 0 && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,17,23,0.85)',
              }}>
                <div style={{
                  background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 12,
                  padding: '32px 36px', minWidth: 360, maxWidth: 420,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Welcome to your Design</h2>
                  <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 24px', lineHeight: 1.5 }}>
                    Get started by adding a floor plan, setting a location, or jump straight into the canvas.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      onClick={() => { fileInputRef.current?.click(); setWelcomeDismissed(true) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                        background: C.accent, color: '#fff', border: 'none', borderRadius: 8,
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <Upload size={16} />
                      <div>
                        <div>Add Floor Plan</div>
                        <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>Upload SVG, PDF, or image</div>
                      </div>
                    </button>
                    <button
                      disabled={!opp?.install_address || satelliteLoading}
                      onClick={handleAddLocation}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                        background: opp?.install_address ? C.bgActive : C.bgActive,
                        color: opp?.install_address ? C.text : C.textDim,
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        fontSize: 13, fontWeight: 500,
                        cursor: opp?.install_address && !satelliteLoading ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        opacity: opp?.install_address ? 1 : 0.6,
                        transition: 'all 0.15s',
                      }}
                    >
                      <MapIcon size={16} />
                      <div>
                        <div>{satelliteLoading ? 'Loading satellite...' : 'Add Location'}</div>
                        <div style={{ fontSize: 11, fontWeight: 400, color: C.textDim }}>
                          {opp?.install_address
                            ? `Satellite view from ${(opp.install_address as string).slice(0, 40)}${(opp.install_address as string).length > 40 ? '...' : ''}`
                            : 'No address — link an Opportunity first'}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setWelcomeDismissed(true)}
                      style={{
                        padding: '10px 16px', background: 'transparent', color: C.textMuted,
                        border: `1px solid ${C.border}`, borderRadius: 8,
                        fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Skip — start with blank canvas
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {activeView === 'network_topology' && <TopologyView designId={designId} nodes={topologyNodes} links={topologyLinks} onAddNode={addTopologyNode} onUpdateNode={updateTopologyNode} onDeleteNode={deleteTopologyNode} onAddLink={addTopologyLink} onUpdateLink={updateTopologyLink} onDeleteLink={deleteTopologyLink} />}
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setConfirmAction(null)}>
          <div style={{ background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px 24px', minWidth: 280, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>{confirmAction.label}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 16 }}>This action cannot be undone.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmAction(null)}
                style={{ padding: '5px 14px', fontSize: 11, borderRadius: 4, background: C.bgActive, color: C.text, border: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={() => { confirmAction.action(); setConfirmAction(null) }}
                style={{ padding: '5px 14px', fontSize: 11, borderRadius: 4, background: C.red, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Catalog Fullscreen Modal */}
      {showDeviceLibrary && (
        <DeviceCatalogModal 
          category={activeIcon === 'layers' || activeIcon === 'other' ? '' : activeIcon} 
          onClose={() => setShowDeviceLibrary(false)} 
          onSelect={handleDeviceSelected} 
        />
      )}
    </div>
  )
}
