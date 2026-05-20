'use client'
/**
 * DesignCanvas — Main orchestrator (Hanwha / Axis / System Surveyor style).
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │ TOP NAV (40px): ← │ Name │ Page Tabs │ Actions │ + Add Device     │
 *   ├────────────────────────────────────────────────────────────────────┤
 *   │ FLOOR PLAN TABS (32px): Area A │ Area B │ +                        │
 *   ├──┬──────┬────────────────────────────────────┬─────────────────────┤
 *   │  │      │                                    │                     │
 *   │52│ LEFT │       CANVAS (Fabric.js)           │   RIGHT PANEL       │
 *   │px│ 200px│       Devices + FOV cones          │   300px (overlay)   │
 *   │  │      │       3-handle interaction          │   Properties        │
 *   │  │      │                                    │                     │
 *   │  │      │        [Floating toolbar]          │                     │
 *   │  │      │                                    │                     │
 *   ├──┴──────┴────────────────────────────────────┴─────────────────────┤
 *   │ BOTTOM (28px): PPF Legend │ Device Counts │ Metrics │ Scale Bar   │
 *   └───────────────────────────────────────────────────────────────────┘
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Eye, EyeOff, Upload, Undo2, Redo2,
  Download, MousePointer, Hand, Ruler, Trash2, Cable, Server,
  CircleDot, ChevronDown, X, Layers, Cctv, DoorOpen,
  Wifi, Speaker, Activity, MoreHorizontal, Crosshair,
  Square, Settings, Maximize2, ZoomIn, ZoomOut, LockKeyhole, Locate, Fence, ClipboardList,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { C, type CanvasTool, type IconTabId, ICON_TABS, DEVICE_CATEGORY_COLORS } from './constants'
import type { ExportFormat } from '@/lib/export-helpers'
import { CanvasArea } from './canvas-area'
import type { DeviceFovData } from './fov-data-types'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { FovPanel } from './fov-panel'
import { DeviceProfilePanel } from './device-profile-panel'
import { MdfRightPanel } from './mdf-right-panel'
import { WallRightPanel } from './wall-right-panel'
import { FloorPlanUploadModal } from './floor-plan-upload-modal'
import { TopologyView } from './topology-view'
import { RackElevationView } from './rack-elevation-view'
import { VlanPlanner } from './vlan-planner'
import { AvSignalFlow } from './av-signal-flow'
import { InterconnectView } from './interconnect-view'
import { NetworkCheckerPanel } from './network-checker-panel'
import { WiringMapView } from './wiring-map-view'
import { WifiHeatmapPanel } from './wifi-heatmap-panel'
import { SoftwareCanvas } from './software-canvas'
import { PathTracePanel } from './path-trace-panel'
import { ReportGenerator } from './report-generator'
import { RequirementsBar, type RequirementItem } from './requirements-bar'
import { DeviceLibraryModal } from './device-library-modal'
import { BomTab } from './bom-tab'
import { DoorScheduleModal } from './door-schedule-modal'
import {
  evaluateCompatibility,
  type DoorType as ComplianceDoorType,
  type ElectrificationType,
  type OccupancyType,
} from '@/lib/door-compliance/compatibility-data'
import { useDesignCanvas } from '@/hooks/useDesignCanvas'
import { getFovConeTiers, calculatePpfAtDistance, classifyDori } from '@/lib/calculators'
import { SimulatedView } from './simulated-view'
import { buildDesignGeoContext, feetPerPixelAtZoom, canvasPixelsToLatLng } from './geo-math'
import type { DesignDevice, DeviceSearchResult } from '@/types/database'

/* ─── Props ─── */
interface Props { designId: string; onNavigateDashboard?: () => void; initialShowCatalog?: boolean }

/* ─── Icon mapping for sidebar ─── */
const SIDEBAR_ICONS: Record<IconTabId, React.ReactNode> = {
  layers: <Layers size={18} />,
  camera: <Cctv size={18} />,
  door: <DoorOpen size={18} />,
  network: <Wifi size={18} />,
  av: <Speaker size={18} />,
  sensors: <Activity size={18} />,
  other: <MoreHorizontal size={18} />,
}

/* ─── Layer category mapping (stable module-scope constant) ─── */
const CATEGORY_MAP: Record<string, string[]> = {
  camera: ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'],
  door: ['access_control'],
  network: ['network'],
  av: ['av'],
  sensors: ['vape_environmental'],
  other: ['other', 'servers_nvr'],
}

/* ─── Device label prefix map (stable module-scope constant) ─── */
const LABEL_PREFIX: Record<string, string> = {
  cctv: 'CAM', dome: 'CAM', bullet: 'CAM', turret: 'CAM', ptz: 'PTZ',
  fisheye: 'FE', multisensor_quad: 'MS', multisensor_dual: 'MS',
  access_control: 'ACS', door: 'DR', door_controller: 'CTRL',
  card_reader: 'RDR', electric_strike: 'ES', maglock: 'ML',
  network: 'NET', switch: 'SW', access_switch: 'SW', rack: 'MDF',
  nvr: 'NVR', router: 'RTR', firewall: 'FW', wireless_ap: 'AP',
  bridge: 'PTP', server: 'SVR', monitor: 'MON', patch_panel: 'PP',
  av: 'AV', speaker: 'SPK', intercom: 'INT',
  vape_environmental: 'ENV', servers_nvr: 'NVR', other: 'DEV',
}

/* ─── Page tabs (Hanwha-style top nav) ─── */
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 }

const PAGE_TABS = [
  { id: 'maps', label: 'Maps' },
  { id: 'devices', label: 'Devices' },
  { id: 'additionals', label: 'Additionals' },
  { id: 'bom', label: 'BOM' },
  { id: 'reports', label: 'Reports' },
] as const

/* ─── Component ─── */
export function DesignCanvas({ designId, onNavigateDashboard, initialShowCatalog }: Props) {
  const router = useRouter()
  const state = useDesignCanvas(designId)
  const {
    design, areas, devices, cables, mdfIdfs, floorPlans, walls: dbWalls,
    loading, error, activeAreaId, selectedDeviceId,
    setActiveAreaId, setSelectedDeviceId,
    addArea, updateArea, deleteArea, uploadFloorPlan, deleteFloorPlan,
    addDevice, updateDevice, updateDeviceProps, deleteDevice,
    addCable, updateCable, deleteCable, addInfrastructure, updateInfrastructure, deleteInfrastructure,
    addWall, updateWall: updateWallDb, deleteWall: deleteWallDb,
  } = state
  const {
    topologyNodes, topologyLinks, racks, vlans,
    addTopologyNode, updateTopologyNode, deleteTopologyNode,
    addTopologyLink, updateTopologyLink, deleteTopologyLink,
    addRack, updateRack, deleteRack,
    addVlan, updateVlan, deleteVlan,
    avoipDevices, addAvoipDevice, updateAvoipDevice, deleteAvoipDevice,
    interconnectNodes, interconnectLinks,
    addInterconnectNode, deleteInterconnectNode,
    addInterconnectLink, deleteInterconnectLink,
  } = state

  /* ── UI state ── */
  const [activeTool, setActiveTool] = useState<CanvasTool>('select')
  const [activeTab, setActiveTab] = useState<string>('maps')
  const [additionalsView, setAdditionalsView] = useState<'topology' | 'rack' | 'vlan' | 'av' | 'interconnect' | 'wiring-map' | 'wifi' | 'checker' | 'software' | 'pathtrace'>('topology')
  const [selectedImagerIdx, setSelectedImagerIdx] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<IconTabId>('camera')
  const [showGrid, setShowGrid] = useState(true)
  const [showFov, setShowFov] = useState(true)
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showCatalog, setShowCatalog] = useState(initialShowCatalog ?? false)
  const [fovMode, setFovMode] = useState<'simple' | 'ppf' | 'dori'>('simple')
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.6)
  const [scalePxPerFt, setScalePxPerFt] = useState(10)
  const [scaleFormat, setScaleFormat] = useState<'ft' | 'ratio' | 'px'>('ft')
  const [showScaleEdit, setShowScaleEdit] = useState(false)
  const [scaleEditValue, setScaleEditValue] = useState('')
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  // Walls from DB, filtered by active area
  const walls = useMemo(() =>
    dbWalls.filter(w => w.area_id === activeAreaId).map(w => ({
      id: w.id, name: w.name, points: w.points,
      wallType: w.wall_type, heightFt: w.height_ft, opacity: w.opacity, color: w.color,
    }))
  , [dbWalls, activeAreaId])
  const wallCountRef = useRef(dbWalls.length)
  const [selectedMdfId, setSelectedMdfId] = useState<string | null>(null)
  const [showIrRange, setShowIrRange] = useState(true)
  const [hiddenPpfZones, setHiddenPpfZones] = useState<Set<string>>(new Set())
  const [showBlindSpot, setShowBlindSpot] = useState(false)
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null)
  const [showSimulatedView, setShowSimulatedView] = useState(false)
  const [showFovPanel, setShowFovPanel] = useState(false)
  const [showDeviceProfile, setShowDeviceProfile] = useState(false)
  const [pendingPlaceDeviceId, setPendingPlaceDeviceId] = useState<string | null>(null)
  const [changingModelDeviceId, setChangingModelDeviceId] = useState<string | null>(null)

  /* ── Canvas ref for zoom-to-device ── */
  const canvasRef = useRef<{ zoomToDevice?: (devId: string) => void } | null>(null)
  const zoomToPointRef = useRef<((x: number, y: number) => void) | null>(null)
  const canvasActionsRef = useRef<{ zoomIn: () => void; zoomOut: () => void; fitToView: () => void } | null>(null)
  const snapshotRef = useRef<(() => string | null) | null>(null)

  const handleZoomToDevice = useCallback((devId: string) => {
    const dev = devices.find(d => d.id === devId)
    if (!dev || !zoomToPointRef.current) return
    zoomToPointRef.current(dev.position_x, dev.position_y)
  }, [devices])

  const toggleCategoryVisibility = useCallback((tabId: string) => {
    const cats = CATEGORY_MAP[tabId] || []
    setHiddenCategories(prev => {
      const next = new Set(prev)
      const allHidden = cats.every(c => next.has(c))
      if (allHidden) {
        for (const c of cats) next.delete(c)
      } else {
        for (const c of cats) next.add(c)
      }
      return next
    })
  }, [])

  /* ── Undo/Redo ── */
  const undoStack = useRef<Array<DesignDevice[]>>([])
  const redoStack = useRef<Array<DesignDevice[]>>([])
  const pushUndo = useCallback(() => {
    undoStack.current.push(JSON.parse(JSON.stringify(devices)))
    if (undoStack.current.length > 30) undoStack.current.shift()
    redoStack.current = []
  }, [devices])

  const handleUndo = useCallback(() => {
    // Basic stub logic: requires DB or context integration for full rollback
    console.log('[DesignCanvas] Undo requested')
  }, [])
  const handleRedo = useCallback(() => {
    // Basic stub logic
    console.log('[DesignCanvas] Redo requested')
  }, [])

  const handleDeviceUpdateProp = useCallback((id: string, prop: string, val: unknown) => {
    // Batch update: replace entire properties object at once
    if (prop === '__batch') {
      updateDevice(id, { properties: val })
      return
    }
    // All property updates go through updateDeviceProps which reads latest state
    // No stale closure — functional updater inside reads fresh devices
    updateDeviceProps(id, { [prop]: val })
  }, [updateDevice, updateDeviceProps])

  /* ── Derived data ── */
  const activeFloorPlan = useMemo(() =>
    floorPlans.find(fp => fp.area_id === activeAreaId) ?? null
  , [floorPlans, activeAreaId])

  const activeArea = useMemo(
    () => areas.find((a) => a.id === activeAreaId) ?? null,
    [areas, activeAreaId],
  )

  /** Google Maps satellite underlay — requires geocoded install address + area rows (see useDesignCanvas). */
  const satelliteConfig = useMemo(() => {
    if (!activeArea) return null
    const lat = activeArea.satellite_lat
    const lng = activeArea.satellite_lng
    if (lat != null && lng != null) {
      const zoom =
        typeof activeArea.satellite_zoom === 'number' &&
        activeArea.satellite_zoom >= 1 &&
        activeArea.satellite_zoom <= 22
          ? activeArea.satellite_zoom
          : 18
      return { lat, lng, zoom, opacity: 0.6 as const }
    }
    // Floor plan area without satellite coords — use a fixed center
    // so GroundOverlay and geo-math work correctly.
    // Zoom 18 at equator gives ~1.53 ft/px; scalePxPerFt is set from floor plan width.
    return { lat: 0.0001, lng: 0.0001, zoom: 18, opacity: 0 as const }
  }, [activeArea])

  // Auto-compute scalePxPerFt from satellite zoom or floor plan dimensions
  const scaleInitialized = useRef(false)
  const prevAreaIdRef = useRef(activeAreaId)
  if (prevAreaIdRef.current !== activeAreaId) {
    prevAreaIdRef.current = activeAreaId
    scaleInitialized.current = false
  }
  useEffect(() => {
    if (scaleInitialized.current) return

    // Floor plan area without real satellite coords — set scale from floor plan width
    if (activeFloorPlan?.width && (!activeArea?.satellite_lat || !activeArea?.satellite_lng)) {
      // Assume floor plan represents ~200ft across (user can calibrate via Scale tool)
      const assumedWidthFt = 200
      const pxPerFt = (activeFloorPlan.width || 1000) / assumedWidthFt
      setScalePxPerFt(pxPerFt)
      scaleInitialized.current = true
      return
    }

    // Satellite area — compute from zoom level
    if (!satelliteConfig) return
    const fpp = feetPerPixelAtZoom(satelliteConfig.zoom, satelliteConfig.lat)
    if (fpp > 0) {
      const pxPerFt = 1 / fpp
      setScalePxPerFt(pxPerFt)
      scaleInitialized.current = true
    }
  }, [satelliteConfig, activeFloorPlan, activeArea])

  /** Phase A: single geo anchor (satellite center) + scale for lat/lng ↔ `position_x`/`position_y` */
  // Fallback to default center if no satellite config — ensures markers and FOV render regardless
  // DEFAULT_CENTER defined at module level to avoid useMemo dependency warning
  const designGeoContext = useMemo(
    () => buildDesignGeoContext(
      satelliteConfig ? { lat: satelliteConfig.lat, lng: satelliteConfig.lng } : DEFAULT_CENTER,
      scalePxPerFt > 0 ? scalePxPerFt : 1,
    ),
    [satelliteConfig, scalePxPerFt],
  )

  const areaDevices = useMemo(() =>
    devices.filter(d => d.area_id === activeAreaId)
  , [devices, activeAreaId])

  // Devices placed on canvas (excludes un-placed / BOM-only devices)
  const canvasDevices = useMemo(() =>
    areaDevices.filter(d => {
      if (d.placed === false) return false
      return !(d.properties as Record<string, unknown> | null)?.unplaced
    })
  , [areaDevices])

  const areaCables = useMemo(() =>
    cables.filter(c => c.area_id === activeAreaId)
  , [cables, activeAreaId])

  const selectedDevice = useMemo(() =>
    devices.find(d => d.id === selectedDeviceId) ?? null
  , [devices, selectedDeviceId])

  /* ── Device counts ── */
  const cameraCount = useMemo(() => areaDevices.filter(d => ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'].includes(d.category)).length, [areaDevices])
  const doorCount = useMemo(() => areaDevices.filter(d => d.category === 'access_control').length, [areaDevices])
  const networkCount = useMemo(() => areaDevices.filter(d => d.category === 'network').length, [areaDevices])

  // Live requirements for the persistent dashboard bar
  const requirementsItems = useMemo((): RequirementItem[] => {
    const totalCableFt = areaCables.reduce((s, c) => s + (c.length_ft || 0), 0)
    // Count multi-sensor channels
    const channelCount = areaDevices.filter(d => ['cctv','dome','bullet','turret','ptz','fisheye','multisensor_quad','multisensor_dual'].includes(d.category))
      .reduce((s, d) => {
        if (d.category === 'multisensor_quad') return s + 4
        if (d.category === 'multisensor_dual') return s + 2
        return s + 1
      }, 0)
    // PoE watts estimate
    const poeWatts = areaDevices.reduce((s, d) => {
      const p = (d.properties ?? {}) as Record<string, unknown>
      return s + (Number(p.poe_watts) || (d.category === 'ptz' ? 60 : ['cctv','dome','bullet','turret','fisheye','multisensor_quad','multisensor_dual'].includes(d.category) ? 25 : d.category === 'access_control' ? 15 : 0))
    }, 0)
    // Ports = cameras + doors + network devices
    const portCount = areaDevices.filter(d => ['cctv','dome','bullet','turret','ptz','fisheye','multisensor_quad','multisensor_dual','access_control','network'].includes(d.category)).length

    return [
      { label: 'Cameras', value: cameraCount, unit: '', status: 'normal' as const },
      { label: 'Channels', value: channelCount, unit: 'ch', status: 'normal' as const },
      { label: 'Doors', value: doorCount, unit: '', status: 'normal' as const },
      { label: 'Network', value: networkCount, unit: '', status: 'normal' as const },
      { label: 'Total', value: areaDevices.length, unit: 'dev', status: 'normal' as const },
      { label: 'PoE', value: poeWatts, unit: 'W', status: 'normal' as const, required: poeWatts * 1.2 || 100 },
      { label: 'Ports', value: portCount, unit: '', status: 'normal' as const, required: portCount * 1.2 || 24 },
      { label: 'Cables', value: areaCables.length, unit: 'runs', status: 'normal' as const, required: areaCables.length * 1.1 || 10 },
    ]
  }, [areaDevices, areaCables, cameraCount, doorCount, networkCount])

  /* ── FOV data computation (cameras + non-camera coverage boundaries) ── */
  const fovData = useMemo(() => {
    const map = new Map<string, DeviceFovData>()

    // Non-camera device coverage boundaries (System Surveyor "Boundaries" feature)
    // Speakers, motion detectors, environmental sensors get circular coverage
    const NON_CAM_COVERAGE: Record<string, { radiusFt: number; color: string; fov: number }> = {
      'speaker': { radiusFt: 25, color: '#8b5cf6', fov: 360 },
      'vape_environmental': { radiusFt: 15, color: '#14b8a6', fov: 360 },
    }
    for (const d of canvasDevices) {
      const cat = d.category
      const coverage = NON_CAM_COVERAGE[cat]
      if (!coverage) continue
      const props = (d.properties ?? {}) as Record<string, unknown>
      const covRadius = Number(props.coverage_radius) || coverage.radiusFt
      map.set(d.id, {
        hFov: coverage.fov,
        rotation: d.rotation || 0,
        tiers: [{ distanceFt: covRadius, color: coverage.color, opacity: 0.10 }],
        colorHex: d.color_hex || coverage.color,
      })
    }

    for (const d of canvasDevices) {
      const cat = d.category
      if (!['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'].includes(cat)) continue

      const props = (d.properties ?? {}) as Record<string, unknown>
      const isFisheye = cat === 'fisheye'
      // Default FOV: use AOV from device library if available, else category defaults
      const defaultFov = cat === 'multisensor_quad' ? 90 : cat === 'multisensor_dual' ? 90 : isFisheye ? 180 : 90
      const aovAngle = Number(props.fov_angle_from_aov) || 0
      const fovAngle = Number(props.fov_angle) || aovAngle || defaultFov
      const targetDist = Number(props.target_distance) || 30
      const focalLength = Number(props.focal_length) || 3 // fallback 3mm per Dexter
      let sensorW = Number(props.sensor_w) || Number(props.sensor_width) || 0
      const resW = Number(props.resolution_w) || 0
      // Fallback sensor_w = 1/2.8" = 5.14mm per Dexter
      if (sensorW === 0) {
        sensorW = 5.14
      }

      let hFov: number
      if (isFisheye) {
        // Fisheye: use fisheye_view property (180 or 360), NOT the rectilinear formula
        const fisheyeView = Number(props.fisheye_view) || 180
        hFov = fisheyeView
      } else if (aovAngle > 0) {
        // Manufacturer AOV from device library — most accurate, matches IPVM
        const userOverride = Number(props.fov_angle) || 0
        if (userOverride > 0) {
          hFov = Math.min(userOverride, aovAngle) // user can narrow but not exceed manufacturer AOV
        } else {
          hFov = aovAngle
        }
      } else if (focalLength > 0 && sensorW > 0) {
        // Thin-lens approximation as fallback when no AOV in library
        const thinLens = 2 * Math.atan(sensorW / (2 * focalLength)) * (180 / Math.PI)
        const userOverride = Number(props.fov_angle) || 0
        if (userOverride > 0) {
          hFov = Math.min(userOverride, thinLens) // user can narrow but not exceed computed max
        } else {
          hFov = thinLens
        }
      } else {
        hFov = defaultFov
      }

      const deviceColor = d.color_hex || '#3b82f6'
      const hasFullSpecs = focalLength > 0 && sensorW > 0 && resW > 0

      let tiers: { distanceFt: number; color: string; opacity: number }[]

      if (hasFullSpecs) {
        // Use proper DORI-based tier distances from the FOV calculator
        const doriTiers = getFovConeTiers({
          resolutionW: resW,
          resolutionH: Number(props.resolution_h) || Math.round(resW * 9 / 16),
          sensorW,
          sensorH: Number(props.sensor_h) || Number(props.sensor_height) || sensorW * 0.75,
          focalLength,
          mountHeight: Number(props.install_height) || 9,
          targetDistance: targetDist,
        })
        // Cone distance = targetDist (user-set or 30ft default). DORI tiers are bands within.
        // Sort DORI tiers by distance descending for graduated rendering.
        const sortedDori = [...doriTiers].sort((a, b) => b.distanceFt - a.distanceFt)
        // Build tiers capped at targetDist — DORI zones that exceed the cone are clamped
        tiers = sortedDori
          .filter(t => t.distanceFt > 0)
          .map((t, i) => ({
            distanceFt: Math.min(t.distanceFt, targetDist),
            color: deviceColor,
            opacity: 0.12 + i * 0.10, // Inner tiers more opaque (IPVM style)
          }))
        // Ensure at least one tier
        if (tiers.length === 0) {
          tiers = [{ distanceFt: targetDist, color: deviceColor, opacity: 0.15 }]
        }
        // Store DORI distances for optional PPF zone display
        const doriDistances = sortedDori.map(t => Math.min(t.distanceFt, targetDist))
        ;(map as unknown as Record<string, unknown>)[`__dori_${d.id}`] = doriDistances
      } else {
        // Fallback: same IPVM pattern — single color graduated opacity
        tiers = [
          { distanceFt: targetDist, color: deviceColor, opacity: 0.15 },
          { distanceFt: targetDist * 0.65, color: deviceColor, opacity: 0.25 },
          { distanceFt: targetDist * 0.35, color: deviceColor, opacity: 0.40 },
          { distanceFt: targetDist * 0.12, color: deviceColor, opacity: 0.55 },
        ]
      }

      // Multi-sensor: compute per-sensor rotation offsets
      let sensorAngles: number[] | undefined
      if (cat === 'multisensor_dual') {
        const base = d.rotation || 0
        const angles = (props.sensor_angles as number[] | undefined)
        sensorAngles = angles && angles.length === 2 ? angles : [base - 45, base + 45]
      } else if (cat === 'multisensor_quad') {
        const base = d.rotation || 0
        const angles = (props.sensor_angles as number[] | undefined)
        sensorAngles = angles && angles.length === 4 ? angles : [base, base + 90, base + 180, base + 270]
      }

      // Blind spot: compute from install height, tilt, and vertical FOV
      const installHeight = Number(props.install_height) || 9
      const tiltAngle = Number(props.tilt_angle) || 0
      const vFovHalf = (hFov * 0.75 / 2) * Math.PI / 180
      const tiltRad = tiltAngle * Math.PI / 180
      const lowerAngle = tiltRad + vFovHalf
      const blindSpotFt = lowerAngle < Math.PI / 2 ? installHeight * Math.tan(Math.PI / 2 - lowerAngle) : 0

      // Per-imager data for multisensor cameras (IPVM: each imager independently adjustable)
      const perImagerRaw = props.per_imager_props as Array<{ distance?: number; hfov?: number; color?: string }> | undefined
      const sensorColors = ['#3b82f6', '#22c55e', '#f97316', '#a855f7']
      let perImagerData: Array<{ tiers: typeof tiers; hFov: number; colorHex?: string }> | undefined
      if (sensorAngles && sensorAngles.length > 1) {
        perImagerData = sensorAngles.map((_, idx) => {
          const imagerProps = perImagerRaw?.[idx] || {}
          const imagerDist = imagerProps.distance || targetDist
          const imagerHFov = imagerProps.hfov || hFov
          const imagerColor = imagerProps.color || sensorColors[idx % sensorColors.length]

          let imagerTiers: typeof tiers
          if (hasFullSpecs) {
            const doriTiers = getFovConeTiers({
              resolutionW: resW, resolutionH: Number(props.resolution_h) || Math.round(resW * 9 / 16),
              sensorW, sensorH: Number(props.sensor_h) || Number(props.sensor_height) || sensorW * 0.75,
              focalLength, mountHeight: installHeight, targetDistance: imagerDist,
            })
            imagerTiers = doriTiers.map((t, i) => ({
              distanceFt: Math.min(t.distanceFt, imagerDist),
              color: t.color,
              opacity: [0.04, 0.06, 0.09, 0.12, 0.15, 0.20][i] ?? 0.10,
            }))
          } else {
            imagerTiers = [
              { distanceFt: imagerDist, color: imagerColor, opacity: 0.06 },
              { distanceFt: imagerDist * 0.7, color: imagerColor, opacity: 0.10 },
              { distanceFt: imagerDist * 0.45, color: imagerColor, opacity: 0.14 },
              { distanceFt: imagerDist * 0.2, color: imagerColor, opacity: 0.20 },
            ]
          }
          return { tiers: imagerTiers, hFov: imagerHFov, colorHex: imagerColor }
        })
      }

      map.set(d.id, {
        hFov, rotation: d.rotation || 0, tiers,
        sensorAngles,
        resolutionW: resW || undefined,
        sensorW: sensorW || undefined,
        focalLength: focalLength || undefined,
        colorHex: d.color_hex || undefined,
        blindSpotFt: blindSpotFt > 0 ? blindSpotFt : undefined,
        perImagerData,
      })
    }
    return map
  }, [canvasDevices])

  /* ── Event handlers ── */
  const handleSelectDevice = useCallback((id: string | null) => {
    setSelectedDeviceId(id)
    if (id) setActiveTool('select')
  }, [setSelectedDeviceId])

  const handleDeviceMoved = useCallback((id: string, x: number, y: number) => {
    updateDevice(id, { position_x: x, position_y: y })
    // Move correct cable endpoint to follow device (first wp for from_device, last wp for to_device)
    const hasGeometry = typeof google !== 'undefined' && google.maps?.geometry?.spherical?.computeDistanceBetween

    for (const c of cables) {
      if (c.from_device_id === id || c.to_device_id === id) {
        if (!c.waypoints || c.waypoints.length < 2) continue
        const newWp = [...c.waypoints]
        const isFrom = c.from_device_id === id
        if (isFrom) {
          newWp[0] = { x: Math.round(x), y: Math.round(y) }
        } else {
          newWp[newWp.length - 1] = { x: Math.round(x), y: Math.round(y) }
        }

        let lengthFt: number
        if (designGeoContext && hasGeometry) {
          // Geodesic distance (accurate)
          let totalMeters = 0
          for (let i = 1; i < newWp.length; i++) {
            const a = canvasPixelsToLatLng(newWp[i - 1].x, newWp[i - 1].y, designGeoContext)
            const b = canvasPixelsToLatLng(newWp[i].x, newWp[i].y, designGeoContext)
            totalMeters += google.maps.geometry.spherical.computeDistanceBetween(
              new google.maps.LatLng(a.lat, a.lng),
              new google.maps.LatLng(b.lat, b.lng),
            )
          }
          lengthFt = Math.round(totalMeters * 3.28084)
        } else {
          // Fallback: pixel Euclidean
          const len = newWp.reduce((sum, wp, i) => {
            if (i === 0) return 0
            const dx = wp.x - newWp[i - 1].x, dy = wp.y - newWp[i - 1].y
            return sum + Math.sqrt(dx * dx + dy * dy)
          }, 0)
          lengthFt = scalePxPerFt > 0 ? Math.round(len / scalePxPerFt) : Math.round(len)
        }

        updateCable(c.id, { waypoints: newWp, length_ft: lengthFt })
      }
    }
  }, [updateDevice, cables, updateCable, scalePxPerFt, designGeoContext])

  const handleDeviceRotated = useCallback((id: string, angle: number) => {
    updateDevice(id, { rotation: angle })
  }, [updateDevice])

  const handleFovDragged = useCallback((id: string, distFt: number) => {
    updateDeviceProps(id, { target_distance: distFt })
  }, [updateDeviceProps])

  const handleFovAngleChanged = useCallback((id: string, angle: number) => {
    // Update FOV angle — updateDeviceProps reads latest state, no stale closure
    updateDeviceProps(id, { fov_angle: angle })
  }, [updateDeviceProps])

  const handleDeviceCopy = useCallback((id: string) => {
    const dev = devices.find(d => d.id === id)
    if (!dev) return
    pushUndo()
    addDevice({
      design_id: designId, area_id: dev.area_id, category: dev.category,
      label: `${dev.label} (copy)`, position_x: dev.position_x + 40,
      position_y: dev.position_y + 40, rotation: dev.rotation,
      properties: dev.properties, color_hex: dev.color_hex,
      mount_type: dev.mount_type, device_library_item_id: dev.device_library_item_id ?? null,
    })
  }, [devices, addDevice, designId, pushUndo])

  const handleDeviceDelete = useCallback((id: string) => {
    pushUndo()
    deleteDevice(id)
  }, [deleteDevice, pushUndo])

  // Remove from map (soft-delete: sets unplaced=true, device stays in pool)
  const handleRemoveFromMap = useCallback((id: string) => {
    updateDeviceProps(id, { unplaced: true })
  }, [updateDeviceProps])

  // Place device: enter place mode, next canvas click positions it
  const handlePlaceDevice = useCallback((id: string) => {
    setPendingPlaceDeviceId(id)
    setActiveTool('select') // cursor stays normal, canvas click handles placement
  }, [])

  // Canvas click handler for placing a pending device
  const handleCanvasClickForPlacement = useCallback((x: number, y: number) => {
    if (!pendingPlaceDeviceId) return
    updateDeviceProps(pendingPlaceDeviceId, { unplaced: false })
    updateDevice(pendingPlaceDeviceId, { position_x: Math.round(x), position_y: Math.round(y) })
    setSelectedDeviceId(pendingPlaceDeviceId)
    setPendingPlaceDeviceId(null)
  }, [pendingPlaceDeviceId, updateDeviceProps, updateDevice, setSelectedDeviceId])

  // Update quantity for a model: add or remove unplaced devices
  const handleUpdateModelQuantity = useCallback(async (
    libraryItemId: string, newQty: number, templateDevice: DesignDevice,
  ) => {
    const allForModel = devices.filter(d => d.device_library_item_id === libraryItemId)
    const currentQty = allForModel.length
    if (newQty === currentQty) return

    if (newQty > currentQty) {
      // Add more unplaced devices
      const toAdd = newQty - currentQty
      const templateProps = (templateDevice.properties ?? {}) as Record<string, unknown>
      for (let i = 0; i < toAdd; i++) {
        const prefix = LABEL_PREFIX[templateDevice.category] || 'DEV'
        const sameCategory = devices.filter(d => (LABEL_PREFIX[d.category] || 'DEV') === prefix)
        const seq = String(sameCategory.length + 1 + i).padStart(3, '0')
        const label = `${prefix}-${seq} — ${templateProps.vendor || ''} ${templateProps.model || ''}`.trim()
        await addDevice({
          design_id: designId, area_id: templateDevice.area_id,
          category: templateDevice.category, label,
          position_x: 400, position_y: 300, rotation: 0,
          properties: { ...templateProps, unplaced: true },
          color_hex: templateDevice.color_hex,
          device_library_item_id: libraryItemId,
        })
      }
    } else {
      // Remove unplaced devices (never remove placed ones)
      const unplaced = allForModel.filter(d =>
        !!(d.properties as Record<string, unknown> | null)?.unplaced
      )
      const toRemove = currentQty - newQty
      for (let i = 0; i < Math.min(toRemove, unplaced.length); i++) {
        deleteDevice(unplaced[i].id)
      }
    }
  }, [devices, addDevice, deleteDevice, designId])

  // Change Model: opens library modal, on select updates existing device instead of creating new
  const handleChangeModel = useCallback((deviceId: string) => {
    setChangingModelDeviceId(deviceId)
    setShowCatalog(true)
  }, [])

  // Auto-label prefix by category
  const getNextLabel = useCallback((category: string) => {
    const prefix = LABEL_PREFIX[category] || 'DEV'
    // Include area abbreviation if available
    const areaAbbr = activeArea?.name
      ? activeArea.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()
      : ''
    const areaDevices = devices.filter(d =>
      d.area_id === activeAreaId && (LABEL_PREFIX[d.category] || 'DEV') === prefix
    )
    const seq = String(areaDevices.length + 1).padStart(3, '0')
    return areaAbbr ? `${prefix}-${areaAbbr}-${seq}` : `${prefix}-${seq}`
  }, [devices, activeArea, activeAreaId])

  const handleDeviceSelected = useCallback(async (item: DeviceSearchResult) => {
    setShowCatalog(false)

    // ── Build full catalog specs from library item (shared by new-device and change-model) ──
    const catalogSpecs: Record<string, unknown> = { ...(item.specs ?? {}) }
    if (item.resolution) {
      catalogSpecs.resolution = item.resolution
      const [w, h] = item.resolution.split('x').map(Number)
      if (w && h) {
        catalogSpecs.resolution_w = w; catalogSpecs.resolution_h = h
      } else {
        const res = item.resolution.toLowerCase().replace(/\s/g, '')
        const mpMatch = res.match(/^([\d.]+)mp/)
        const pMatch = res.match(/^(\d+)p$/)
        if (res.includes('4k') || res.includes('uhd')) {
          catalogSpecs.resolution_w = 3840; catalogSpecs.resolution_h = 2160
        } else if (res.includes('8k')) {
          catalogSpecs.resolution_w = 7680; catalogSpecs.resolution_h = 4320
        } else if (pMatch) {
          const pH = parseInt(pMatch[1], 10)
          catalogSpecs.resolution_h = pH
          catalogSpecs.resolution_w = Math.round(pH * 16 / 9)
        } else if (mpMatch) {
          const mp = parseFloat(mpMatch[1])
          const mpToPixels: Record<string, [number, number]> = {
            '1.3': [1280, 960], '2': [1920, 1080], '3': [2048, 1536],
            '4': [2560, 1440], '5': [2592, 1944], '6': [3072, 2048],
            '8': [3840, 2160], '10': [3648, 2736], '12': [4000, 3000],
            '12.5': [4000, 3000], '16': [4608, 3456], '20': [5120, 3840],
            '32': [6528, 4896],
          }
          const exact = mpToPixels[String(mp)]
          if (exact) { catalogSpecs.resolution_w = exact[0]; catalogSpecs.resolution_h = exact[1] }
          else { const rW = Math.round(Math.sqrt(mp * 1_000_000 * (4 / 3))); catalogSpecs.resolution_w = rW; catalogSpecs.resolution_h = Math.round(rW * 3 / 4) }
        }
      }
    }
    if (item.poe_standard) catalogSpecs.poe_standard = item.poe_standard
    if (item.wattage != null) catalogSpecs.wattage = item.wattage
    if (item.ndaa_compliant != null) catalogSpecs.ndaa_compliant = item.ndaa_compliant
    if (item.ul_listed != null) catalogSpecs.ul_listed = item.ul_listed
    if (item.ul_listing_code) catalogSpecs.ul_listing_code = item.ul_listing_code
    if (item.vendor) catalogSpecs.vendor = item.vendor
    if (item.model) catalogSpecs.model = item.model
    if (item.partnumber) catalogSpecs.partnumber = item.partnumber
    if (item.fps) { const fpsNum = parseInt(item.fps, 10); if (fpsNum) catalogSpecs.fps = fpsNum }
    if (item.focal_length) catalogSpecs.focal_length = parseFloat(item.focal_length)
    if (item.focal_type) catalogSpecs.focal_type = item.focal_type
    if (item.aov) catalogSpecs.aov = item.aov
    if (item.form) catalogSpecs.form = item.form
    if (item.ir) catalogSpecs.ir = item.ir
    if (item.imager_count) catalogSpecs.imager_count = item.imager_count
    if (item.multi_imager_type) catalogSpecs.multi_imager_type = item.multi_imager_type
    if (item.environment) catalogSpecs.environment = item.environment
    if (item.codecs) catalogSpecs.codecs = item.codecs
    if (item.super_low_light != null) catalogSpecs.super_low_light = item.super_low_light
    // Normalize JSONB spec keys
    if (catalogSpecs.focal_length_mm && !catalogSpecs.focal_length) catalogSpecs.focal_length = parseFloat(String(catalogSpecs.focal_length_mm))
    if (catalogSpecs.max_resolution_h && !catalogSpecs.resolution_w) catalogSpecs.resolution_w = Number(catalogSpecs.max_resolution_h)
    if (catalogSpecs.max_resolution_v && !catalogSpecs.resolution_h) catalogSpecs.resolution_h = Number(catalogSpecs.max_resolution_v)
    if (!catalogSpecs.sensor_w) {
      const sw = catalogSpecs.sensor_width ?? catalogSpecs.sensor_size_w ?? catalogSpecs.sensor_w_mm
      if (sw) catalogSpecs.sensor_w = parseFloat(String(sw))
    }
    if (!catalogSpecs.sensor_h) {
      const sh = catalogSpecs.sensor_height ?? catalogSpecs.sensor_size_h ?? catalogSpecs.sensor_h_mm
      if (sh) catalogSpecs.sensor_h = parseFloat(String(sh))
    }
    if (!catalogSpecs.sensor_w) { catalogSpecs.sensor_w = 5.14; catalogSpecs.sensor_h = 3.86 }

    // ── If changing model on existing device, update specs without creating new ──
    if (changingModelDeviceId) {
      const devId = changingModelDeviceId
      setChangingModelDeviceId(null)
      const existingDev = devices.find(d => d.id === devId)
      if (existingDev) {
        const existingProps = (existingDev.properties ?? {}) as Record<string, unknown>
        // Preserve user-set layout properties (position, rotation, unplaced, color, etc.)
        const preserveKeys = ['unplaced', 'target_distance', 'install_height', 'tilt_angle', 'recording_schedule_grid', 'retention_days']
        const preserved: Record<string, unknown> = {}
        for (const k of preserveKeys) { if (existingProps[k] !== undefined) preserved[k] = existingProps[k] }
        const merged = { ...catalogSpecs, ...preserved }
        await updateDevice(devId, {
          device_library_item_id: item.id,
          properties: merged,
          label: `${existingDev.label?.split(' — ')[0] || 'DEV'} — ${item.vendor} ${item.model}`,
        })
      }
      return
    }

    // Derive specific camera type from subcategory OR form for correct icon + FOV matching
    // e.g., subcategory="dome" OR form="Dome" → category="dome" instead of generic "cctv"
    let effectiveCategory = item.category
    if (item.category === 'cctv') {
      const sub = (item.subcategory || item.form || '').toLowerCase()
      if (sub.includes('dome') && !sub.includes('mini')) effectiveCategory = 'dome'
      else if (sub.includes('mini') && sub.includes('dome')) effectiveCategory = 'dome'
      else if (sub.includes('bullet')) effectiveCategory = 'bullet'
      else if (sub.includes('turret')) effectiveCategory = 'turret'
      else if (sub.includes('ptz')) effectiveCategory = 'ptz'
      else if (sub.includes('fisheye')) effectiveCategory = 'fisheye'
      else if (sub.includes('multisensor') || sub.includes('multi-sensor') || sub.includes('multi_sensor') || sub.includes('multi directional')) {
        effectiveCategory = sub.includes('dual') ? 'multisensor_dual' : 'multisensor_quad'
      }
      else if (sub.includes('box') || sub.includes('covert')) effectiveCategory = 'box'
    }

    const autoLabel = getNextLabel(effectiveCategory)

    // catalogSpecs already built above — just mark as unplaced for pool
    catalogSpecs.unplaced = true

    try {
      const dev = await addDevice({
        design_id: designId, area_id: activeAreaId, category: effectiveCategory,
        label: `${autoLabel} — ${item.vendor} ${item.model}`,
        position_x: 400, position_y: 300,
        rotation: 0, properties: catalogSpecs,
        device_library_item_id: item.id,
      })
      if (dev) {
        // Don't auto-select or place — device goes to pool
      }
    } catch (err) {
      console.error('Failed to add device:', err)
    }
  }, [addDevice, designId, activeAreaId, getNextLabel, changingModelDeviceId, devices, updateDevice])

  const handleUpdateDevice = useCallback((id: string, updates: Record<string, unknown>) => {
    updateDevice(id, updates)
  }, [updateDevice])

  const [showFloorPlanModal, setShowFloorPlanModal] = useState(false)
  const [showObservations, setShowObservations] = useState(false)
  const [showReportGenerator, setShowReportGenerator] = useState(false)
  const [showDoorSchedule, setShowDoorSchedule] = useState(false)

  /* ── ACS device compliance summary (for Door Schedule button badge) ── */
  const ACS_CATEGORIES = useMemo(
    () => new Set(['access_control', 'door', 'door_controller', 'card_reader', 'electric_strike', 'maglock']),
    [],
  )
  const doorScheduleSummary = useMemo(() => {
    const acs = devices.filter(d => ACS_CATEGORIES.has(d.category))
    let critical = 0
    let warning = 0
    for (const d of acs) {
      const p = (d.properties ?? {}) as Record<string, unknown>
      const lockType = String(p.lock_type || 'Electric Strike')
      const construction = String(p.door_construction || 'single') as ComplianceDoorType
      const electrification = String(
        p.electrification ||
          (lockType === 'Magnetic Lock'
            ? 'surface_maglock'
            : lockType === 'Electrified Hardware'
            ? 'electric_latch_retraction'
            : 'electrified_trim'),
      ) as ElectrificationType
      const occupancy = String(p.occupancy || 'business') as OccupancyType
      const fireRated = !!p.fire_rated
      const findings = evaluateCompatibility(construction, fireRated, electrification, occupancy, false)
      if (findings.flags.some(f => f.level === 'critical')) critical++
      else if (findings.flags.some(f => f.level === 'warning')) warning++
    }
    return { count: acs.length, critical, warning }
  }, [devices, ACS_CATEGORIES])

  const handleFloorPlanImport = useCallback(async (result: {
    file: File; width: number; height: number; mode: 'new_area' | 'overlay'; areaName?: string
  }) => {
    try {
      if (result.mode === 'new_area') {
        // Create new area, then upload floor plan to it
        const newArea = await addArea(result.areaName || 'Floor Plan', 'FLOOR_PLAN')
        if (!newArea) { toast.error('Failed to create area'); return }
        await uploadFloorPlan(newArea.id, result.file, result.width, result.height)
        setActiveAreaId(newArea.id)
      } else {
        // Overlay on current area
        if (!activeAreaId) { toast.error('No active area'); return }
        await uploadFloorPlan(activeAreaId, result.file, result.width, result.height)
      }
      setShowFloorPlanModal(false)
    } catch (err) {
      console.error('Floor plan import failed:', err)
    }
  }, [activeAreaId, addArea, uploadFloorPlan, setActiveAreaId])

  /* ── Loading / Error ── */
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.bg, color: C.textMuted, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      Loading design…
    </div>
  )
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.bg, color: C.red, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      Error: {error}
    </div>
  )

  return (
    <div className="light" style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: C.bg, color: C.text, fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>

      {/* ═══════════════════════════════════════════════════════════════════
          TOP NAV BAR (40px) — Hanwha DesignPro style
         ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center',
        height: 40, padding: '0 12px', background: C.bgSurface,
        borderBottom: `1px solid ${C.border}`, zIndex: 50, flexShrink: 0,
      }}>
        {/* Back + Logo */}
        <button onClick={() => onNavigateDashboard ? onNavigateDashboard() : router.back()}
          style={{ ...btnStyle(false), marginRight: 8, padding: '4px 6px' }}>
          <ArrowLeft size={15} />
        </button>

        {/* Project name */}
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: -0.3 }}>
          {design?.name || 'Design'}
        </span>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: C.border, margin: '0 12px' }} />

        {/* Page tabs (Hanwha-style) */}
        {PAGE_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              ...btnStyle(false),
              padding: '6px 14px', fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? C.text : C.textMuted,
              borderBottom: activeTab === tab.id ? `2px solid ${C.accent}` : '2px solid transparent',
              borderRadius: 0, background: 'transparent',
            }}>
            {tab.label}
          </button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right actions */}
        <button onClick={() => setShowFloorPlanModal(true)} style={{ ...btnStyle(false), padding: '4px 10px', gap: 4 }} title="Import Floor Plan">
          <Upload size={13} />
          <span style={{ fontSize: 10 }}>Floor Plan</span>
        </button>
        <button onClick={() => setShowObservations(!showObservations)} style={{ ...btnStyle(showObservations), padding: '4px 10px', gap: 4 }} title="Site Observations">
          <ClipboardList size={13} />
          <span style={{ fontSize: 10 }}>Notes</span>
        </button>
        {doorScheduleSummary.count > 0 && (
          <button
            onClick={() => setShowDoorSchedule(true)}
            style={{ ...btnStyle(false), padding: '4px 10px', gap: 4 }}
            title="Door Schedule & Compliance"
          >
            <DoorOpen size={13} />
            <span style={{ fontSize: 10 }}>
              Doors ({doorScheduleSummary.count})
              {doorScheduleSummary.critical > 0 && (
                <span style={{ color: '#dc2626', marginLeft: 4, fontWeight: 700 }}>
                  {doorScheduleSummary.critical}C
                </span>
              )}
              {doorScheduleSummary.warning > 0 && (
                <span style={{ color: '#d97706', marginLeft: 4, fontWeight: 700 }}>
                  {doorScheduleSummary.warning}W
                </span>
              )}
            </span>
          </button>
        )}
        {activeFloorPlan && (
          <button
            onClick={async () => {
              if (!confirm('Delete this floor plan?')) return
              await deleteFloorPlan(activeFloorPlan.id)
            }}
            style={{ ...btnStyle(false), padding: '4px 8px', gap: 3, color: C.red }}
            title="Delete Floor Plan"
          >
            <Trash2 size={13} />
            <span style={{ fontSize: 10 }}>Remove</span>
          </button>
        )}

        <button onClick={() => setShowCatalog(true)} style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px',
          background: C.accent, color: '#fff', border: 'none',
          borderRadius: 4, fontSize: 11, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <Plus size={13} />
          Add Device
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FLOOR PLAN TAB BAR (32px) + Tool Strip
         ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        height: 32, padding: '0 12px', background: C.bgPanel,
        borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        {/* Area tabs */}
        {areas.map(area => (
          <button key={area.id}
            onClick={() => setActiveAreaId(area.id)}
            style={{
              padding: '4px 12px', fontSize: 11, fontWeight: area.id === activeAreaId ? 600 : 400,
              background: area.id === activeAreaId ? C.bgActive : 'transparent',
              border: area.id === activeAreaId ? `1px solid ${C.border}` : '1px solid transparent',
              borderBottom: area.id === activeAreaId ? `2px solid ${C.accent}` : '2px solid transparent',
              borderRadius: '4px 4px 0 0', color: area.id === activeAreaId ? C.text : C.textMuted,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {area.name}
          </button>
        ))}

        {/* + Add area */}
        <button style={{
          padding: '2px 8px', fontSize: 13, color: C.textDim,
          background: 'transparent', border: `1px dashed ${C.border}`,
          borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit',
        }} onClick={() => addArea(`Area ${areas.length + 1}`, 'grid')}>
          +
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: C.border, margin: '0 8px' }} />

        {/* Tool strip — grouped: Navigation | Drawing | Infrastructure */}
        {[
          { id: 'select' as CanvasTool, icon: <MousePointer size={13} />, label: 'Select' },
          { id: 'pan' as CanvasTool, icon: <Hand size={13} />, label: 'Pan' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)}
            title={t.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, padding: '3px 7px',
              background: activeTool === t.id ? C.accentSubtle : 'transparent',
              border: activeTool === t.id ? `1px solid ${C.accent}40` : '1px solid transparent',
              borderRadius: 3, color: activeTool === t.id ? C.accent : C.textMuted,
              fontSize: 10, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
        <div style={{ width: 1, height: 14, background: C.border, margin: '0 2px', opacity: 0.5 }} />
        {[
          { id: 'measure' as CanvasTool, icon: <Ruler size={13} />, label: 'Measure' },
          { id: 'scale' as CanvasTool, icon: <Crosshair size={13} />, label: 'Scale' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)}
            title={t.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, padding: '3px 7px',
              background: activeTool === t.id ? C.accentSubtle : 'transparent',
              border: activeTool === t.id ? `1px solid ${C.accent}40` : '1px solid transparent',
              borderRadius: 3, color: activeTool === t.id ? C.accent : C.textMuted,
              fontSize: 10, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
        <div style={{ width: 1, height: 14, background: C.border, margin: '0 2px', opacity: 0.5 }} />
        {[
          { id: 'cable' as CanvasTool, icon: <Cable size={13} />, label: 'Cable' },
          { id: 'mdf_idf' as CanvasTool, icon: <Server size={13} />, label: 'MDF/IDF' },
          { id: 'wall' as CanvasTool, icon: <Fence size={13} />, label: 'Wall' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)}
            title={t.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, padding: '3px 7px',
              background: activeTool === t.id ? C.accentSubtle : 'transparent',
              border: activeTool === t.id ? `1px solid ${C.accent}40` : '1px solid transparent',
              borderRadius: 3, color: activeTool === t.id ? C.accent : C.textMuted,
              fontSize: 10, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: C.border, margin: '0 4px' }} />

        {/* FOV toggle + DORI toggle */}
        <button onClick={() => setShowFov(!showFov)}
          style={{
            ...btnStyle(showFov), padding: '3px 7px', fontSize: 10, gap: 3,
            color: showFov ? C.accent : C.textMuted,
          }} title="Toggle FOV">
          {showFov ? <Eye size={13} /> : <EyeOff size={13} />}
          <span>FOV</span>
        </button>

        {showFov && (
          <select value={fovMode}
            onChange={e => setFovMode(e.target.value as 'simple' | 'ppf' | 'dori')}
            style={{
              background: C.bgActive, border: `1px solid ${C.border}`,
              borderRadius: 3, color: C.text, fontSize: 10, padding: '2px 4px',
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
            <option value="simple">Simple</option>
            <option value="ppf">PPF</option>
            <option value="dori">DORI</option>
          </select>
        )}

        <div style={{ flex: 1 }} />

        {/* Zoom controls (right side) */}
        <button onClick={() => canvasActionsRef.current?.zoomIn()} style={btnStyle(false)} title="Zoom In"><ZoomIn size={13} /></button>
        <button onClick={() => canvasActionsRef.current?.zoomOut()} style={btnStyle(false)} title="Zoom Out"><ZoomOut size={13} /></button>
        <button onClick={() => canvasActionsRef.current?.fitToView()} style={btnStyle(false)} title="Fit to View"><Maximize2 size={13} /></button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT: Icon Sidebar + Left Panel + Canvas + Right Panel
         ═══════════════════════════════════════════════════════════════════ */}
      {/* ── INFRASTRUCTURE OBSERVATIONS PANEL ── */}
      {showObservations && activeArea && (
        <div style={{
          position: 'absolute', top: 110, right: 16, width: 320, maxHeight: '70vh', zIndex: 40,
          background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'auto',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Site Observations</div>
              <div style={{ fontSize: 9, color: C.textDim }}>{activeArea.name}</div>
            </div>
            <button onClick={() => setShowObservations(false)} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer' }}><X size={14} /></button>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              ['mdf_locations', 'MDF/IDF Locations', 'Describe MDF/IDF closet locations, access...'],
              ['conduit_paths', 'Conduit & Pathways', 'Available conduit, j-hooks, cable trays...'],
              ['power_sources', 'Power Sources', 'Proximity to power outlets, dedicated circuits...'],
              ['existing_network', 'Existing Network', 'Current switches, patch panels, cabling...'],
              ['ceiling_type', 'Ceiling Type', 'Drop ceiling, open plenum, drywall, exposed...'],
              ['site_access', 'Site Access', 'After-hours access, keys, alarm codes, escort...'],
              ['general_notes', 'General Notes', 'Any other site observations...'],
            ] as [string, string, string][]).map(([key, label, placeholder]) => {
              const obs = (activeArea.infrastructure_observations ?? {}) as Record<string, string>
              return (
                <div key={key}>
                  <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                  <textarea
                    value={obs[key] || ''}
                    placeholder={placeholder}
                    rows={2}
                    onChange={e => {
                      const updated = { ...(activeArea.infrastructure_observations ?? {}), [key]: e.target.value }
                      updateArea(activeArea.id, { infrastructure_observations: updated })
                    }}
                    style={{
                      width: '100%', padding: '4px 8px', background: C.bgActive,
                      border: `1px solid ${C.border}`, borderRadius: 4,
                      color: C.text, fontSize: 10, fontFamily: 'inherit', outline: 'none',
                      resize: 'vertical', lineHeight: 1.4,
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── REQUIREMENTS DASHBOARD (persistent) ── */}
      {activeTab === 'maps' && (
        <RequirementsBar
          requirements={requirementsItems}
          cableEstimate={areaCables.length > 0 ? `${areaCables.reduce((s, c) => s + (c.length_ft || 0), 0).toLocaleString()} ft` : undefined}
        />
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

        {/* ── 52px ICON SIDEBAR ── */}
        <div style={{
          width: 52, flexShrink: 0, background: C.bgSurface,
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 8, gap: 2,
        }}>
          {ICON_TABS.map(tab => {
            const active = activeCategory === tab.id
            const cats = CATEGORY_MAP[tab.id] || []
            const isHidden = cats.length > 0 && cats.every(c => hiddenCategories.has(c))
            const isLayersTab = tab.id === 'layers'
            return (
              <div key={tab.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  onClick={() => setActiveCategory(tab.id)}
                  title={tab.label}
                  style={{
                    width: 40, height: 40,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 1, border: active ? `1px solid ${C.accent}` : '1px solid transparent',
                    borderRadius: 6,
                    background: active ? C.accentSubtle : 'transparent',
                    color: isHidden ? C.textDim + '44' : active ? C.accent : C.textDim,
                    cursor: 'pointer', fontSize: 8, fontWeight: 500, fontFamily: 'inherit',
                    transition: 'all 0.12s',
                    opacity: isHidden ? 0.4 : 1,
                  }}>
                  {SIDEBAR_ICONS[tab.id]}
                  <span style={{ marginTop: 1, maxWidth: 46, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.label}</span>
                </button>
                {/* Eye toggle for non-layers tabs */}
                {!isLayersTab && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleCategoryVisibility(tab.id) }}
                    title={isHidden ? `Show ${tab.label}` : `Hide ${tab.label}`}
                    style={{
                      width: 16, height: 16, padding: 0, border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      color: isHidden ? '#ef4444' : C.textDim,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: -2, marginBottom: 2, opacity: 0.6,
                      transition: 'opacity 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                  >
                    {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* ── LEFT PANEL (200px) ── */}
        {showLeftPanel && activeTab !== 'reports' && activeTab !== 'additionals' && (
          <LeftPanel
            devices={areaDevices}
            selectedId={selectedDeviceId}
            onSelect={handleSelectDevice}
            onAddDevice={() => setShowCatalog(true)}
            onDeleteDevice={handleDeviceDelete}
            onZoomToDevice={handleZoomToDevice}
            onPlaceDevice={handlePlaceDevice}
            onRemoveFromMap={handleRemoveFromMap}
            onUpdateQuantity={handleUpdateModelQuantity}
          />
        )}

        {/* ── ADDITIONALS TAB — Network Topology, Rack Elevation, VLAN Planner ── */}
        {activeTab === 'additionals' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>
            {/* Sub-tab bar */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bgSurface, flexShrink: 0 }}>
              {([
                { id: 'topology' as const, label: 'Network Topology' },
                { id: 'rack' as const, label: 'Rack Elevation' },
                { id: 'vlan' as const, label: 'VLAN / Subnet' },
                { id: 'av' as const, label: 'AV Signal Flow' },
                { id: 'interconnect' as const, label: 'Interconnect Wiring' },
                { id: 'wiring-map' as const, label: 'Wiring Map' },
                { id: 'wifi' as const, label: 'WiFi Heatmap' },
                { id: 'checker' as const, label: 'Network Checker' },
                { id: 'software' as const, label: 'Software Quote' },
                { id: 'pathtrace' as const, label: 'Path Trace' },
              ]).map(t => (
                <button key={t.id} onClick={() => setAdditionalsView(t.id)}
                  style={{
                    padding: '8px 16px', fontSize: 11, fontWeight: additionalsView === t.id ? 600 : 400,
                    color: additionalsView === t.id ? C.text : C.textMuted,
                    borderBottom: `2px solid ${additionalsView === t.id ? C.accent : 'transparent'}`,
                    background: 'transparent', border: 'none', borderBottomStyle: 'solid',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{t.label}</button>
              ))}
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {additionalsView === 'topology' && (
                <TopologyView designId={designId} nodes={topologyNodes} links={topologyLinks}
                  onAddNode={addTopologyNode} onUpdateNode={updateTopologyNode} onDeleteNode={deleteTopologyNode}
                  onAddLink={addTopologyLink} onUpdateLink={updateTopologyLink} onDeleteLink={deleteTopologyLink} />
              )}
              {additionalsView === 'rack' && (
                <RackElevationView designId={designId} racks={racks} infrastructure={mdfIdfs}
                  onAddRack={addRack} onUpdateRack={updateRack} onDeleteRack={deleteRack} />
              )}
              {additionalsView === 'vlan' && (
                <VlanPlanner designId={designId} vlans={vlans}
                  onAddVlan={addVlan} onUpdateVlan={updateVlan} onDeleteVlan={deleteVlan} />
              )}
              {additionalsView === 'av' && (
                <AvSignalFlow designId={designId} avoipDevices={avoipDevices}
                  onAddDevice={addAvoipDevice} onUpdateDevice={updateAvoipDevice} onDeleteDevice={deleteAvoipDevice} />
              )}
              {additionalsView === 'interconnect' && (
                <InterconnectView designId={designId} nodes={interconnectNodes} links={interconnectLinks}
                  onAddNode={addInterconnectNode} onUpdateNode={async () => {}} onDeleteNode={deleteInterconnectNode}
                  onAddLink={addInterconnectLink} onUpdateLink={async () => {}} onDeleteLink={deleteInterconnectLink} />
              )}
              {additionalsView === 'wiring-map' && (
                <WiringMapView
                  designName={design?.name || 'Design'}
                  devices={areaDevices}
                  cables={areaCables}
                  mdfIdfs={mdfIdfs.filter(m => m.area_id === activeAreaId)}
                />
              )}
              {additionalsView === 'wifi' && (
                <WifiHeatmapPanel
                  designId={designId}
                  areaId={activeAreaId ?? undefined}
                  walls={[]}
                  canvasWidth={activeFloorPlan?.width || 1200}
                  canvasHeight={activeFloorPlan?.height || 800}
                  scalePxPerFt={scalePxPerFt}
                />
              )}
              {additionalsView === 'checker' && (
                <NetworkCheckerPanel
                  devices={areaDevices} cables={areaCables}
                  mdfIdfs={mdfIdfs.filter(m => m.area_id === activeAreaId)}
                  topologyNodes={topologyNodes} topologyLinks={topologyLinks} vlans={vlans} />
              )}
              {additionalsView === 'software' && (
                <SoftwareCanvas designId={designId} designName={design?.name || 'Design'}
                  oppNumber={design?.opp_id ? `OPP-${design.opp_id.slice(0, 6)}` : undefined}
                  customerName={''} />
              )}
              {additionalsView === 'pathtrace' && (
                <PathTracePanel nodes={topologyNodes} links={topologyLinks} />
              )}
            </div>
          </div>
        )}

        {/* ── BOM TAB — editable material list that feeds the xlsm export ── */}
        {activeTab === 'bom' && (
          <BomTab
            designId={designId}
            devices={devices}
            activeAreaId={activeAreaId}
            addDevice={addDevice}
            updateDeviceProps={updateDeviceProps}
            deleteDevice={deleteDevice}
          />
        )}

        {/* ── REPORTS TAB — multi-format export ── */}
        {activeTab === 'reports' && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', overflow: 'auto', background: C.bg, padding: 24 }}>
            <div style={{ width: '100%', maxWidth: 640 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>Export Reports</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  { label: 'Bill of Materials (BOM)', desc: 'Device quantities grouped by model with costs', key: 'bom' },
                  { label: 'Hardware Schedule', desc: 'Devices grouped by area with install details', key: 'hw' },
                  { label: 'Cable Schedule', desc: 'All cable runs with lengths, types, MDF assignments', key: 'cable' },
                  { label: 'Material List', desc: 'Every device with full properties', key: 'material' },
                  { label: 'IP Scheme Document', desc: 'VLAN/Subnet assignments from planner', key: 'ip-scheme' },
                  { label: 'Rack Elevation', desc: 'Per-rack device assignments and power', key: 'rack' },
                  { label: 'AV Signal Flow', desc: 'AV device signal flow diagram', key: 'av-flow' },
                ] as const).map(item => (
                  <div key={item.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: C.bgPanel, border: `1px solid ${C.border}`,
                    borderRadius: 8,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.label}</div>
                      <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {((item.key === 'bom' ? ['xlsm', 'xlsx', 'pdf', 'docx'] : ['xlsx', 'pdf', 'docx']) as readonly ExportFormat[]).map(fmt => (
                        <button key={fmt} onClick={() => {
                          const run = async () => {
                            const m = await import('@/lib/export-helpers')
                            if (item.key === 'bom') await m.exportBom(designId, fmt)
                            else if (item.key === 'hw') await m.exportHardwareSchedule(designId, fmt)
                            else if (item.key === 'cable') await m.exportCableSchedule(designId, fmt)
                            else if (item.key === 'material') await m.exportMaterialList(designId, fmt)
                            else if (item.key === 'ip-scheme') {
                              const rows = vlans.map((v, i) => ({ '#': i + 1, 'VLAN ID': v.vlan_id, 'Name': v.vlan_name || '', 'Subnet': v.subnet || '', 'Gateway': v.gateway || '', 'DHCP Start': v.dhcp_range_start || '', 'DHCP End': v.dhcp_range_end || '' }))
                              const cols = ['#', 'VLAN ID', 'Name', 'Subnet', 'Gateway', 'DHCP Start', 'DHCP End']
                              await m.exportInFormat(`IP Scheme — ${design?.name || 'Design'}`, rows, cols, 'IP_Scheme.xlsx', fmt)
                            }
                            else if (item.key === 'rack') {
                              const rows = racks.flatMap((r, ri) => r.slots.filter(s => s.device_name).map((s, si) => ({ '#': ri * 100 + si + 1, 'Rack': r.rack_name, 'U Position': s.u_position, 'Device': s.device_name || '', 'RU Height': s.ru_height, 'PoE (W)': s.poe_draw_w, 'Power (W)': s.power_draw_w })))
                              const cols = ['#', 'Rack', 'U Position', 'Device', 'RU Height', 'PoE (W)', 'Power (W)']
                              await m.exportInFormat(`Rack Elevation — ${design?.name || 'Design'}`, rows, cols, 'Rack_Elevation.xlsx', fmt)
                            }
                            else if (item.key === 'av-flow') {
                              const rows = avoipDevices.map((d, i) => ({ '#': i + 1, 'Device': d.device_name || '', 'Protocol': d.protocol, 'IP': d.ip_address || '', 'VLAN': d.vlan_id || '', 'NIC': d.nic_type }))
                              const cols = ['#', 'Device', 'Protocol', 'IP', 'VLAN', 'NIC']
                              await m.exportInFormat(`AV Signal Flow — ${design?.name || 'Design'}`, rows, cols, 'AV_Signal_Flow.xlsx', fmt)
                            }
                          }
                          run().catch(console.error)
                        }}
                          style={{
                            padding: '4px 10px', fontSize: 9, fontWeight: 700,
                            background: fmt === 'xlsm' ? 'rgba(34,197,94,0.12)' : fmt === 'xlsx' ? `${C.accent}15` : fmt === 'pdf' ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                            color: fmt === 'xlsm' ? '#16a34a' : fmt === 'xlsx' ? C.accent : fmt === 'pdf' ? '#ef4444' : '#3b82f6',
                            border: `1px solid ${fmt === 'xlsm' ? 'rgba(34,197,94,0.3)' : fmt === 'xlsx' ? `${C.accent}30` : fmt === 'pdf' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`,
                            borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                            textTransform: 'uppercase',
                          }}>
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Additional actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowReportGenerator(true)}
                  style={{
                    flex: 1, padding: '12px 16px', background: C.bgPanel, border: `1px solid ${C.accent}`, borderRadius: 8,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>Generate Printable Report</div>
                  <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>Camera coverage, DORI analysis, system summary — opens print dialog</div>
                </button>
                <button onClick={() => {
                  const url = snapshotRef.current?.()
                  if (url) {
                    // Download the static map image
                    const a = document.createElement('a')
                    a.href = url
                    a.target = '_blank'
                    a.download = `${design?.name || 'Canvas'}_Snapshot.png`
                    document.body.appendChild(a); a.click(); document.body.removeChild(a)
                  } else {
                    toast.info('Switch to Maps tab first, then try again')
                  }
                }}
                  style={{
                    flex: 1, padding: '12px 16px', background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Canvas Snapshot</div>
                  <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>Download current canvas view as PNG image</div>
                </button>
              </div>
              {/* Field Installation Manual */}
              <button onClick={() => {
                import('@/lib/export-helpers').then(m => m.exportFieldManual(designId)).catch(console.error)
              }}
                style={{ marginTop: 8, width: '100%', padding: '12px 16px', background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Field Installation Manual</div>
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>DOCX with equipment list, per-area install instructions, cable schedule, quality checklist</div>
              </button>

              {/* ISO Compliance */}
              <button onClick={() => {
                import('@/lib/export-helpers').then(async m => {
                  const { calculatePpfAtDistance, classifyDori } = await import('@/lib/calculators')
                  const camDevs = areaDevices.filter(d => ['cctv','dome','bullet','turret','ptz','fisheye','multisensor_quad','multisensor_dual'].includes(d.category))
                  const reqs: Record<string, 'detection' | 'observation' | 'recognition' | 'identification'> = {}
                  camDevs.forEach(d => { reqs[d.id] = 'detection' })
                  const ppfCalc = (d: { properties: Record<string, unknown> | null }) => {
                    const p = (d.properties ?? {}) as Record<string, unknown>
                    return calculatePpfAtDistance(Number(p.resolution_w) || 0, Number(p.sensor_w) || 5.14, Number(p.focal_length) || 4, Number(p.target_distance) || 30)
                  }
                  const results = m.checkIsoCompliance(camDevs, reqs, ppfCalc, classifyDori)
                  await m.exportIsoComplianceReport(designId, results, design?.name || 'Design')
                }).catch(console.error)
              }}
                style={{ marginTop: 8, width: '100%', padding: '12px 16px', background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>ISO 62676 Compliance Report</div>
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>DORI pass/fail analysis per camera against IEC 62676-4 thresholds</div>
              </button>
            </div>
          </div>
        )}

        {/* ── CANVAS ── */}
        {activeTab !== 'reports' && activeTab !== 'additionals' && <CanvasArea
          designId={designId}
          areaId={activeAreaId}
          floorPlan={activeFloorPlan}
          satelliteConfig={satelliteConfig}
          geoContext={designGeoContext}
          devices={canvasDevices}
          cables={areaCables}
          showGrid={showGrid}
          activeTool={activeTool}
          selectedDeviceId={selectedDeviceId}
          showFovCones={showFov}
          fovData={fovData}
          scalePxPerFt={scalePxPerFt}
          onSelectDevice={(id) => { handleSelectDevice(id); setSelectedMdfId(null) }}
          onDeviceMoved={handleDeviceMoved}
          onDeviceRotated={handleDeviceRotated}
          onDeviceCopy={handleDeviceCopy}
          onDeviceUpdateProp={handleDeviceUpdateProp}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onDeviceDelete={handleDeviceDelete}
          onToolChange={setActiveTool}
          onScaleCalibrated={setScalePxPerFt}
          onFovHandleDragged={handleFovDragged}
          onFovAngleChanged={handleFovAngleChanged}
          floorPlanOpacity={floorPlanOpacity}
          fovDisplayMode={fovMode}
          onCanvasClick={(x, y) => {
            if (pendingPlaceDeviceId) {
              handleCanvasClickForPlacement(x, y)
            } else if (activeTool === 'mdf_idf') {
              addInfrastructure({ design_id: designId, area_id: activeAreaId, name: `MDF-${(mdfIdfs.filter(m => m.area_id === activeAreaId).length + 1).toString().padStart(2, '0')}`, position_x: Math.round(x), position_y: Math.round(y) })
              setActiveTool('select')
            }
          }}
          onCableCreated={async (cable) => {
            // Route MDF IDs to mdf_idf_id instead of from/to_device_id (FK constraint)
            const mdfIds = new Set(mdfIdfs.map(m => m.id))
            const fromIsMdf = mdfIds.has(cable.from_device_id)
            const toIsMdf = cable.to_device_id ? mdfIds.has(cable.to_device_id) : false

            // Limit 1 Cat6 cable per device to MDF (skip for MDF→MDF links)
            if (!fromIsMdf || !toIsMdf) {
              const deviceId = fromIsMdf ? cable.to_device_id : cable.from_device_id
              if (deviceId) {
                const existing = cables.find(c =>
                  c.from_device_id === deviceId || c.to_device_id === deviceId
                )
                if (existing) {
                  toast.warning('Device already has a cable to MDF. Remove existing cable first.')
                  return
                }
              }
            }

            const payload: Record<string, unknown> = { ...cable, design_id: designId, area_id: activeAreaId }
            if (fromIsMdf) {
              payload.mdf_idf_id = cable.from_device_id
              delete payload.from_device_id
            }
            if (cable.to_device_id && toIsMdf) {
              payload.mdf_idf_id = cable.to_device_id
              delete payload.to_device_id
            }
            // Auto-color cable to match connected device category (IPVM pattern)
            const connDeviceId = fromIsMdf ? cable.to_device_id : cable.from_device_id
            if (connDeviceId) {
              const dev = devices.find(d => d.id === connDeviceId)
              if (dev) payload.color_hex = DEVICE_CATEGORY_COLORS[dev.category] || '#3b82f6'
            }
            if (!payload.cable_type) payload.cable_type = 'cat6'
            await addCable(payload)
          }}
          onCableUpdated={async (cableId, waypoints, lengthFt) => {
            const cable = cables.find(c => c.id === cableId)
            await updateCable(cableId, { waypoints, length_ft: lengthFt })
          }}
          mdfIdfs={mdfIdfs.filter(n => n.area_id === activeAreaId)}
          onMdfIdfPlaced={async (x, y) => {
            await addInfrastructure({ design_id: designId, area_id: activeAreaId, name: 'MDF', position_x: x, position_y: y })
          }}
          onMdfIdfMoved={async (id, x, y) => {
            await updateInfrastructure(id, { position_x: x, position_y: y })
            const hasGeo = typeof google !== 'undefined' && google.maps?.geometry?.spherical?.computeDistanceBetween
            // Move cable start waypoint to follow MDF
            for (const c of cables) {
              if (c.mdf_idf_id === id) {
                if (!c.waypoints || c.waypoints.length < 2) continue
                const newWp = [...c.waypoints]
                newWp[0] = { x: Math.round(x), y: Math.round(y) }
                let lengthFt: number
                if (designGeoContext && hasGeo) {
                  let totalMeters = 0
                  for (let i = 1; i < newWp.length; i++) {
                    const a = canvasPixelsToLatLng(newWp[i - 1].x, newWp[i - 1].y, designGeoContext)
                    const b = canvasPixelsToLatLng(newWp[i].x, newWp[i].y, designGeoContext)
                    totalMeters += google.maps.geometry.spherical.computeDistanceBetween(
                      new google.maps.LatLng(a.lat, a.lng), new google.maps.LatLng(b.lat, b.lng))
                  }
                  lengthFt = Math.round(totalMeters * 3.28084)
                } else {
                  const len = newWp.reduce((sum, wp, i) => {
                    if (i === 0) return 0
                    const dx = wp.x - newWp[i - 1].x, dy = wp.y - newWp[i - 1].y
                    return sum + Math.sqrt(dx * dx + dy * dy)
                  }, 0)
                  lengthFt = scalePxPerFt > 0 ? Math.round(len / scalePxPerFt) : Math.round(len)
                }
                await updateCable(c.id, { waypoints: newWp, length_ft: lengthFt })
              }
            }
          }}
          onMdfIdfDeleted={async (id) => {
            await deleteInfrastructure(id)
          }}
          onDragCommit={() => {}}
          hiddenCategories={hiddenCategories}
          zoomToPointRef={zoomToPointRef}
          canvasActionsRef={canvasActionsRef}
          snapshotRef={snapshotRef}
          walls={walls}
          onWallCreated={async (pts) => {
            wallCountRef.current += 1
            await addWall({
              design_id: designId, area_id: activeAreaId,
              name: `Wall ${wallCountRef.current}`, points: pts,
            })
            toast.success('Wall created')
          }}
          onWallDeleted={async (id) => {
            await deleteWallDb(id)
            if (selectedWallId === id) setSelectedWallId(null)
          }}
          onWallUpdated={async (id, updates) => {
            // Map frontend field names to DB column names
            const dbUpdates: Record<string, unknown> = {}
            if (updates.points !== undefined) dbUpdates.points = updates.points
            if (updates.name !== undefined) dbUpdates.name = updates.name
            if (updates.wallType !== undefined) dbUpdates.wall_type = updates.wallType
            if (updates.heightFt !== undefined) dbUpdates.height_ft = updates.heightFt
            if (updates.opacity !== undefined) dbUpdates.opacity = updates.opacity
            if (updates.color !== undefined) dbUpdates.color = updates.color
            await updateWallDb(id, dbUpdates)
          }}
          selectedWallId={selectedWallId}
          onMdfSelected={(id) => { setSelectedMdfId(id); setSelectedDeviceId(null) }}
          showIrRange={showIrRange}
          hiddenPpfZones={hiddenPpfZones}
          showBlindSpot={showBlindSpot}
          onWallSelected={(id) => { setSelectedWallId(id); if (id) { setSelectedDeviceId(null); setSelectedMdfId(null) } }}
          onSelectImager={(idx) => setSelectedImagerIdx(idx)}
        />}

        {/* ── RIGHT PANEL + STACKING PANELS ── */}
        {selectedDevice && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
            display: 'flex',
          }}>
            {/* Device Profile Panel (540px, leftmost when open) */}
            {showDeviceProfile && (
              <DeviceProfilePanel
                device={selectedDevice}
                onClose={() => setShowDeviceProfile(false)}
                onUpdateDevice={handleUpdateDevice}
                mdfIdfs={mdfIdfs.filter(n => n.area_id === activeAreaId)}
                onChangeModel={handleChangeModel}
                cables={cables.filter(c => c.area_id === activeAreaId)}
              />
            )}

            {/* FoV Panel (680px, between device profile and right panel) */}
            {showFovPanel && (
              <FovPanel
                device={selectedDevice}
                onClose={() => setShowFovPanel(false)}
                onUpdateDevice={handleUpdateDevice}
              />
            )}

            {/* Right Panel (280px, always rightmost when device selected) */}
            <div style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.5)' }}>
            <RightPanel
              device={selectedDevice}
              onClose={() => { setSelectedDeviceId(null); setShowFovPanel(false); setShowDeviceProfile(false) }}
              onUpdateDevice={handleUpdateDevice}
              onDuplicate={handleDeviceCopy}
              onDelete={handleDeviceDelete}
              onRemoveFromMap={handleRemoveFromMap}
              scalePxPerFt={scalePxPerFt}
              onChangeModel={handleChangeModel}
              cables={cables.filter(c => c.area_id === activeAreaId)}
              mdfIdfs={mdfIdfs.filter(n => n.area_id === activeAreaId)}
              showIrRange={showIrRange}
              onToggleIrRange={setShowIrRange}
              hiddenPpfZones={hiddenPpfZones}
              onTogglePpfZone={(zone) => setHiddenPpfZones(prev => {
                const next = new Set(prev)
                next.has(zone) ? next.delete(zone) : next.add(zone)
                return next
              })}
              showBlindSpot={showBlindSpot}
              onToggleBlindSpot={setShowBlindSpot}
              selectedImagerIdx={selectedImagerIdx}
              onSelectImager={(idx) => setSelectedImagerIdx(idx)}
              onDisconnectCable={async (deviceId) => {
                const toDelete = areaCables.filter(
                  c => c.from_device_id === deviceId || c.to_device_id === deviceId
                )
                for (const c of toDelete) await deleteCable(c.id)
              }}
              onConnectToMdf={async (deviceId) => {
                // Auto-connect device to nearest MDF with straight-line cable
                const dev = devices.find(d => d.id === deviceId)
                const areaMdfs = mdfIdfs.filter(m => m.area_id === activeAreaId)
                if (!dev || areaMdfs.length === 0) { toast.warning('No MDF/IDF in this area'); return }
                // Check if device already cabled
                const alreadyCabled = cables.find(c => c.from_device_id === deviceId || c.to_device_id === deviceId)
                if (alreadyCabled) { toast.warning('Device already has a cable to MDF. Remove existing cable first.'); return }
                // Find nearest MDF
                let nearest = areaMdfs[0]
                let minDist = Infinity
                for (const m of areaMdfs) {
                  const dx = dev.position_x - m.position_x
                  const dy = dev.position_y - m.position_y
                  const dist = Math.sqrt(dx * dx + dy * dy)
                  if (dist < minDist) { minDist = dist; nearest = m }
                }
                const waypoints = [{ x: nearest.position_x, y: nearest.position_y }, { x: dev.position_x, y: dev.position_y }]
                const lengthFt = scalePxPerFt > 0 ? Math.round(minDist / scalePxPerFt) : Math.round(minDist)
                const color = DEVICE_CATEGORY_COLORS[dev.category] || '#3b82f6'
                await addCable({ design_id: designId, area_id: activeAreaId, mdf_idf_id: nearest.id, from_device_id: deviceId, waypoints, length_ft: lengthFt, color_hex: color })
                toast.success(`Connected to ${nearest.name}`)
              }}
              onShowSimulatedView={() => setShowSimulatedView(true)}
              onOpenFovPanel={() => setShowFovPanel(prev => !prev)}
              onOpenDeviceProfile={() => setShowDeviceProfile(prev => !prev)}
            />
            </div>
          </div>
        )}

        {/* ── SIMULATED VIEW OVERLAY ── */}
        {showSimulatedView && selectedDevice && (() => {
          const devProps = (selectedDevice.properties ?? {}) as Record<string, unknown>
          const resW = Number(devProps.resolution_w) || 0
          const senW = Number(devProps.sensor_width) || 0
          const fl = Number(devProps.focal_length) || 4
          const td = Number(devProps.target_distance) || 30
          const ih = Number(devProps.install_height) || 9
          const ppf = (resW > 0 && senW > 0 && fl > 0) ? calculatePpfAtDistance(resW, senW, fl, td) : 0
          const dori = ppf > 0 ? classifyDori(ppf) : 'none' as const
          return (
            <SimulatedView
              resolutionW={resW}
              sensorW={senW}
              focalLength={fl}
              targetDistFt={td}
              installHeight={ih}
              ppf={ppf}
              dori={dori}
              onClose={() => setShowSimulatedView(false)}
            />
          )
        })()}

        {/* ── MDF RIGHT PANEL ── */}
        {!selectedDevice && selectedMdfId && (() => {
          const selectedMdf = mdfIdfs.find(m => m.id === selectedMdfId)
          if (!selectedMdf) return null
          return (
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
              boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
            }}>
              <MdfRightPanel
                mdf={selectedMdf}
                cables={areaCables}
                devices={areaDevices}
                scalePxPerFt={scalePxPerFt}
                onClose={() => setSelectedMdfId(null)}
                onDelete={async (id) => { await deleteInfrastructure(id); setSelectedMdfId(null) }}
                onUpdateMdf={async (id, updates) => { await updateInfrastructure(id, updates) }}
                onUpdateCable={async (id, updates) => { await updateCable(id, updates) }}
                onDisconnectDevice={async (cableId) => {
                  await deleteCable(cableId)
                }}
                onStartCableFromMdf={() => { setActiveTool('cable'); setSelectedMdfId(null) }}
              />
            </div>
          )
        })()}

        {/* ── WALL RIGHT PANEL ── */}
        {!selectedDevice && !selectedMdfId && selectedWallId && (() => {
          const selectedWall = walls.find(w => w.id === selectedWallId)
          if (!selectedWall) return null
          return (
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
              boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
            }}>
              <WallRightPanel
                wall={selectedWall}
                onClose={() => setSelectedWallId(null)}
                onUpdateWall={async (id, updates) => {
                  const dbUpdates: Record<string, unknown> = {}
                  if (updates.points !== undefined) dbUpdates.points = updates.points
                  if (updates.name !== undefined) dbUpdates.name = updates.name
                  if (updates.wallType !== undefined) dbUpdates.wall_type = updates.wallType
                  if (updates.heightFt !== undefined) dbUpdates.height_ft = updates.heightFt
                  if (updates.opacity !== undefined) dbUpdates.opacity = updates.opacity
                  if (updates.color !== undefined) dbUpdates.color = updates.color
                  await updateWallDb(id, dbUpdates)
                }}
                onDelete={async (id) => {
                  await deleteWallDb(id)
                  setSelectedWallId(null)
                }}
                scalePxPerFt={scalePxPerFt}
              />
            </div>
          )
        })()}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM BAR (28px) — PPF Legend + Device Counts + Scale
         ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        height: 28, padding: '0 12px',
        background: C.bgSurface, borderTop: `1px solid ${C.border}`,
        fontSize: 10, color: C.textMuted, flexShrink: 0,
      }}>
        {/* Device counts */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Cctv size={11} /> {cameraCount} {cameraCount === 1 ? 'camera' : 'cameras'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <DoorOpen size={11} /> {doorCount} {doorCount === 1 ? 'door' : 'doors'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Wifi size={11} /> {networkCount} network
          </span>
          <span>Total: {areaDevices.length}</span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: C.border, margin: '0 8px' }} />

        {/* Cable tally */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Cable size={11} /> {areaCables.length} {areaCables.length === 1 ? 'run' : 'runs'}
          </span>
          <span style={{ fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace", fontWeight: 600 }}>
            {areaCables.reduce((sum, c) => sum + (c.length_ft || 0), 0)} ft
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Scale control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          {/* Scale bar visual */}
          <div style={{ width: 50, height: 4, background: C.accent, borderRadius: 1, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: -2, width: 1, height: 8, background: C.accent }} />
            <div style={{ position: 'absolute', right: 0, top: -2, width: 1, height: 8, background: C.accent }} />
          </div>
          {/* Clickable scale value */}
          <button
            onClick={() => { setShowScaleEdit(!showScaleEdit); setScaleEditValue(String(scalePxPerFt)) }}
            style={{
              fontSize: 10, fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
              color: C.accent, background: 'none', border: `1px solid ${C.border}`, borderRadius: 3,
              padding: '1px 6px', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {scaleFormat === 'ft' && `1" = ${(50 / scalePxPerFt).toFixed(1)} ft`}
            {scaleFormat === 'ratio' && `1:${Math.round(50 / scalePxPerFt * 12)}`}
            {scaleFormat === 'px' && `${scalePxPerFt.toFixed(1)} px/ft`}
          </button>
          {/* Format toggle */}
          <select
            value={scaleFormat}
            onChange={e => setScaleFormat(e.target.value as 'ft' | 'ratio' | 'px')}
            style={{
              fontSize: 9, background: C.bgActive, border: `1px solid ${C.border}`,
              borderRadius: 3, color: C.textMuted, padding: '1px 4px', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <option value="ft">1&quot;=Xft</option>
            <option value="ratio">1:X</option>
            <option value="px">px/ft</option>
          </select>

          {/* Scale edit popover */}
          {showScaleEdit && (
            <div style={{
              position: 'absolute', bottom: 28, right: 0, background: C.bgPanel,
              border: `1px solid ${C.border}`, borderRadius: 6, padding: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 50, minWidth: 180,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 8 }}>Set Scale</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="number" step="0.1" min="0.1"
                  value={scaleEditValue}
                  onChange={e => setScaleEditValue(e.target.value)}
                  style={{
                    width: 70, padding: '4px 8px', background: C.bgActive,
                    border: `1px solid ${C.border}`, borderRadius: 4,
                    color: C.text, fontSize: 12, fontFamily: "'SF Mono', monospace",
                  }}
                />
                <span style={{ fontSize: 10, color: C.textMuted }}>px/ft</span>
                <button
                  onClick={() => {
                    const v = parseFloat(scaleEditValue)
                    if (v > 0) { setScalePxPerFt(v); setShowScaleEdit(false) }
                  }}
                  style={{
                    padding: '4px 10px', background: C.accent, color: '#fff',
                    border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >Set</button>
              </div>
              <div style={{ fontSize: 9, color: C.textDim, marginTop: 6 }}>
                Or use the Scale tool to measure two points
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ DEVICE CATALOG MODAL ═══════ */}
      {showCatalog && (
        <DeviceLibraryModal
          category={activeCategory === 'door' ? 'access_control' : activeCategory === 'network' ? 'network' : activeCategory === 'av' ? 'av' : 'cctv'}
          onClose={() => setShowCatalog(false)}
          onSelect={handleDeviceSelected}
        />
      )}

      {/* ═══════ REPORT GENERATOR ═══════ */}
      {showReportGenerator && (
        <ReportGenerator
          designName={design?.name || 'Design'}
          areaName={activeArea?.name}
          devices={areaDevices}
          onClose={() => setShowReportGenerator(false)}
        />
      )}

      {/* ═══════ FLOOR PLAN UPLOAD MODAL ═══════ */}
      {showFloorPlanModal && (
        <FloorPlanUploadModal
          onSubmit={handleFloorPlanImport}
          onClose={() => setShowFloorPlanModal(false)}
          hasActiveArea={!!activeAreaId}
          suggestedAreaName={`Area ${String.fromCharCode(65 + areas.length)}`}
        />
      )}

      {/* ═══════ DOOR SCHEDULE MODAL ═══════ */}
      {showDoorSchedule && (
        <DoorScheduleModal
          designName={design?.name || 'Design'}
          devices={devices}
          onClose={() => setShowDoorSchedule(false)}
          onSelectDevice={(id) => { setSelectedDeviceId(id); setShowDoorSchedule(false) }}
        />
      )}
    </div>
  )
}

/* ─── Helper ─── */
function btnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 6px',
    background: active ? C.accentSubtle : 'transparent',
    border: active ? `1px solid ${C.accent}40` : '1px solid transparent',
    borderRadius: 4, color: active ? C.accent : C.textMuted,
    fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.12s',
  }
}

