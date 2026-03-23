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
  Square, Settings, Maximize2, ZoomIn, ZoomOut, LockKeyhole, Locate, Fence,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { C, PPF_CHART, type CanvasTool, type IconTabId, ICON_TABS } from './constants'
import { CanvasArea, type DeviceFovData } from './canvas-area'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { MdfRightPanel } from './mdf-right-panel'
import { WallRightPanel } from './wall-right-panel'
import { DeviceCatalogModal } from './device-catalog-modal'
import { useDesignCanvas } from '@/hooks/useDesignCanvas'
import { getFovConeTiers } from '@/lib/calculators'
import type { DesignDevice, DeviceSearchResult } from '@/types/database'

/* ─── Props ─── */
interface Props { designId: string; onNavigateDashboard?: () => void }

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

/* ─── Page tabs (Hanwha-style top nav) ─── */
const PAGE_TABS = [
  { id: 'maps', label: 'Maps' },
  { id: 'devices', label: 'Devices' },
  { id: 'additionals', label: 'Additionals' },
  { id: 'reports', label: 'Reports' },
] as const

/* ─── Component ─── */
export function DesignCanvas({ designId, onNavigateDashboard }: Props) {
  const router = useRouter()
  const state = useDesignCanvas(designId)
  const {
    design, areas, devices, cables, mdfIdfs, floorPlans,
    loading, error, activeAreaId, selectedDeviceId,
    setActiveAreaId, setSelectedDeviceId,
    addArea, updateArea, deleteArea, uploadFloorPlan,
    addDevice, updateDevice, deleteDevice,
    addCable, deleteCable, addInfrastructure, updateInfrastructure, deleteInfrastructure,
  } = state

  /* ── UI state ── */
  const [activeTool, setActiveTool] = useState<CanvasTool>('select')
  const [activeTab, setActiveTab] = useState<string>('maps')
  const [activeCategory, setActiveCategory] = useState<IconTabId>('camera')
  const [showGrid, setShowGrid] = useState(true)
  const [showFov, setShowFov] = useState(true)
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showCatalog, setShowCatalog] = useState(false)
  const [fovMode, setFovMode] = useState<'simple' | 'ppf' | 'dori'>('simple')
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.6)
  const [scalePxPerFt, setScalePxPerFt] = useState(10)
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [walls, setWalls] = useState<Array<{ id: string; points: Array<{ x: number; y: number }>; wallType?: string; heightFt?: number; opacity?: number; color?: string }>>([])
  const [selectedMdfId, setSelectedMdfId] = useState<string | null>(null)
  const [showIrRange, setShowIrRange] = useState(true)
  const [hiddenPpfZones, setHiddenPpfZones] = useState<Set<string>>(new Set())
  const [showBlindSpot, setShowBlindSpot] = useState(false)
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null)

  /* ── Canvas ref for zoom-to-device ── */
  const canvasRef = useRef<{ zoomToDevice?: (devId: string) => void } | null>(null)
  const zoomToPointRef = useRef<((x: number, y: number) => void) | null>(null)

  const handleZoomToDevice = useCallback((devId: string) => {
    const dev = devices.find(d => d.id === devId)
    if (!dev || !zoomToPointRef.current) return
    zoomToPointRef.current(dev.position_x, dev.position_y)
  }, [devices])

  /* ── Layer toggle helper ── */
  const CATEGORY_MAP: Record<string, string[]> = {
    camera: ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'],
    door: ['access_control'],
    network: ['network'],
    av: ['av'],
    sensors: ['vape_environmental'],
    other: ['other'],
  }
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

  /* ── Derived data ── */
  const activeFloorPlan = useMemo(() =>
    floorPlans.find(fp => fp.area_id === activeAreaId) ?? null
  , [floorPlans, activeAreaId])

  const areaDevices = useMemo(() =>
    devices.filter(d => d.area_id === activeAreaId)
  , [devices, activeAreaId])

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

  /* ── FOV data computation ── */
  const fovData = useMemo(() => {
    const map = new Map<string, DeviceFovData>()
    for (const d of areaDevices) {
      const cat = d.category
      if (!['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'].includes(cat)) continue

      const props = (d.properties ?? {}) as Record<string, unknown>
      const fovAngle = Number(props.fov_angle) || 90
      const targetDist = Number(props.target_distance) || 30
      const focalLength = Number(props.focal_length) || 0
      const sensorW = Number(props.sensor_width) || 0
      const resW = Number(props.resolution_w) || 0

      let hFov = fovAngle
      if (focalLength > 0 && sensorW > 0) {
        hFov = 2 * Math.atan(sensorW / (2 * focalLength)) * (180 / Math.PI)
      }

      const deviceColor = d.color_hex || C.accent
      const hasFullSpecs = focalLength > 0 && sensorW > 0 && resW > 0

      let tiers: { distanceFt: number; color: string; opacity: number }[]

      if (hasFullSpecs) {
        // Use proper DORI-based tier distances from the FOV calculator
        const doriTiers = getFovConeTiers({
          resolutionW: resW,
          resolutionH: Number(props.resolution_h) || Math.round(resW * 9 / 16),
          sensorW,
          sensorH: Number(props.sensor_height) || sensorW * 0.75,
          focalLength,
          mountHeight: Number(props.install_height) || 9,
          targetDistance: targetDist,
        })
        // doriTiers: detection(outermost) → identification(innermost)
        // Cap outer tier to user's targetDist so cone doesn't exceed the set range
        tiers = doriTiers.map((t, i) => ({
          distanceFt: Math.min(t.distanceFt, targetDist),
          color: t.color,
          // Graduated opacity: outermost=faintest, innermost=densest
          opacity: [0.06, 0.10, 0.14, 0.20][i] ?? 0.10,
        }))
      } else {
        // Fallback: 4 proportional tiers with graduated opacity
        tiers = [
          { distanceFt: targetDist, color: deviceColor, opacity: 0.06 },
          { distanceFt: targetDist * 0.7, color: deviceColor, opacity: 0.10 },
          { distanceFt: targetDist * 0.45, color: deviceColor, opacity: 0.14 },
          { distanceFt: targetDist * 0.2, color: deviceColor, opacity: 0.20 },
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

      map.set(d.id, {
        hFov, rotation: d.rotation || 0, tiers,
        sensorAngles,
        resolutionW: resW || undefined,
        sensorW: sensorW || undefined,
        focalLength: focalLength || undefined,
        colorHex: d.color_hex || undefined,
        blindSpotFt: blindSpotFt > 0 ? blindSpotFt : undefined,
      })
    }
    return map
  }, [areaDevices])

  /* ── Event handlers ── */
  const handleSelectDevice = useCallback((id: string | null) => {
    setSelectedDeviceId(id)
    if (id) setActiveTool('select')
  }, [setSelectedDeviceId])

  const handleDeviceMoved = useCallback((id: string, x: number, y: number) => {
    updateDevice(id, { position_x: x, position_y: y })
  }, [updateDevice])

  const handleDeviceRotated = useCallback((id: string, angle: number) => {
    updateDevice(id, { rotation: angle })
  }, [updateDevice])

  const handleFovDragged = useCallback((id: string, distFt: number) => {
    const dev = devices.find(d => d.id === id)
    if (!dev) return
    const merged = { ...((dev.properties ?? {}) as Record<string, unknown>), target_distance: distFt }
    updateDevice(id, { properties: merged })
  }, [devices, updateDevice])

  const handleFovAngleChanged = useCallback((id: string, angle: number) => {
    const dev = devices.find(d => d.id === id)
    if (!dev) return
    const merged = { ...((dev.properties ?? {}) as Record<string, unknown>), fov_angle: angle }
    updateDevice(id, { properties: merged })
  }, [devices, updateDevice])

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

  // Auto-label prefix by category
  const LABEL_PREFIX: Record<string, string> = {
    cctv: 'CAM', dome: 'CAM', bullet: 'CAM', turret: 'CAM', ptz: 'PTZ',
    fisheye: 'FE', multisensor_quad: 'MS', multisensor_dual: 'MS',
    access_control: 'ACS', door: 'DR', door_controller: 'CTRL',
    card_reader: 'RDR', electric_strike: 'ES', maglock: 'ML',
    network: 'NET', switch: 'SW', access_switch: 'SW', rack: 'MDF',
    nvr: 'NVR', router: 'RTR', firewall: 'FW', wireless_ap: 'AP',
    bridge: 'PTP', server: 'SVR', monitor: 'MON', patch_panel: 'PP',
    av: 'AV', speaker: 'SPK', intercom: 'INT',
    vape_environmental: 'ENV', other: 'DEV',
  }

  const getNextLabel = useCallback((category: string) => {
    const prefix = LABEL_PREFIX[category] || 'DEV'
    const sameCategory = devices.filter(d => (LABEL_PREFIX[d.category] || 'DEV') === prefix)
    const seq = String(sameCategory.length + 1).padStart(3, '0')
    return `${prefix}-${seq}`
  }, [devices])

  const handleDeviceSelected = useCallback(async (item: DeviceSearchResult) => {
    setShowCatalog(false)

    // Derive specific camera type from subcategory for correct icon matching
    // e.g., subcategory="dome" → category="dome" instead of generic "cctv"
    let effectiveCategory = item.category
    if (item.category === 'cctv' && item.subcategory) {
      const sub = item.subcategory.toLowerCase()
      if (sub.includes('dome')) effectiveCategory = 'dome'
      else if (sub.includes('bullet')) effectiveCategory = 'bullet'
      else if (sub.includes('turret')) effectiveCategory = 'turret'
      else if (sub.includes('ptz')) effectiveCategory = 'ptz'
      else if (sub.includes('fisheye')) effectiveCategory = 'fisheye'
      else if (sub.includes('multisensor') || sub.includes('multi-sensor') || sub.includes('multi_sensor')) {
        effectiveCategory = sub.includes('dual') ? 'multisensor_dual' : 'multisensor_quad'
      }
      else if (sub.includes('box') || sub.includes('covert')) effectiveCategory = 'box'
    }

    const autoLabel = getNextLabel(effectiveCategory)
    const dev = await addDevice({
      design_id: designId, area_id: activeAreaId, category: effectiveCategory,
      label: `${autoLabel} — ${item.vendor} ${item.model}`,
      position_x: 400, position_y: 300,
      rotation: 0, properties: item.specs ?? {},
      device_library_item_id: item.id,
    })
    if (dev) {
      setSelectedDeviceId(dev.id)
      setActiveTool('select')
    }
  }, [addDevice, designId, activeAreaId, setSelectedDeviceId, getNextLabel])

  const handleUpdateDevice = useCallback((id: string, updates: Record<string, unknown>) => {
    updateDevice(id, updates)
  }, [updateDevice])

  const handleFloorPlanUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeAreaId) return
    await uploadFloorPlan(activeAreaId, file)
  }, [activeAreaId, uploadFloorPlan])

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
    <div style={{
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
        <label style={{ ...btnStyle(false), padding: '4px 10px', gap: 4 }} title="Upload Floor Plan">
          <Upload size={13} />
          <span style={{ fontSize: 10 }}>Floor Plan</span>
          <input type="file" accept="image/*" hidden onChange={handleFloorPlanUpload} />
        </label>

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

        {/* Tool strip */}
        {[
          { id: 'select' as CanvasTool, icon: <MousePointer size={13} />, label: 'Select' },
          { id: 'pan' as CanvasTool, icon: <Hand size={13} />, label: 'Pan' },
          { id: 'measure' as CanvasTool, icon: <Ruler size={13} />, label: 'Measure' },
          { id: 'scale' as CanvasTool, icon: <Crosshair size={13} />, label: 'Scale' },
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
        <button style={btnStyle(false)} title="Zoom In"><ZoomIn size={13} /></button>
        <button style={btnStyle(false)} title="Zoom Out"><ZoomOut size={13} /></button>
        <button style={btnStyle(false)} title="Fit to View"><Maximize2 size={13} /></button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT: Icon Sidebar + Left Panel + Canvas + Right Panel
         ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

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
        {showLeftPanel && (
          <LeftPanel
            devices={areaDevices}
            selectedId={selectedDeviceId}
            onSelect={handleSelectDevice}
            onAddDevice={() => setShowCatalog(true)}
            onDeleteDevice={handleDeviceDelete}
            onZoomToDevice={handleZoomToDevice}
          />
        )}

        {/* ── CANVAS ── */}
        <CanvasArea
          designId={designId}
          areaId={activeAreaId}
          floorPlan={activeFloorPlan}
          devices={areaDevices}
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
          onDeviceDelete={handleDeviceDelete}
          onToolChange={setActiveTool}
          onScaleCalibrated={setScalePxPerFt}
          onFovHandleDragged={handleFovDragged}
          onFovAngleChanged={handleFovAngleChanged}
          floorPlanOpacity={floorPlanOpacity}
          fovDisplayMode={fovMode}
          onCanvasClick={() => {}}
          onCableCreated={async (cable) => {
            // Route MDF IDs to mdf_idf_id instead of from/to_device_id (FK constraint)
            const mdfIds = new Set(mdfIdfs.map(m => m.id))
            const payload: Record<string, unknown> = { ...cable, design_id: designId, area_id: activeAreaId }
            if (mdfIds.has(cable.from_device_id)) {
              payload.mdf_idf_id = cable.from_device_id
              delete payload.from_device_id
            }
            if (cable.to_device_id && mdfIds.has(cable.to_device_id)) {
              payload.mdf_idf_id = cable.to_device_id
              delete payload.to_device_id
            }
            await addCable(payload)
          }}
          mdfIdfs={mdfIdfs.filter(n => n.area_id === activeAreaId)}
          onMdfIdfPlaced={async (x, y) => {
            await addInfrastructure({ design_id: designId, area_id: activeAreaId, name: 'MDF', position_x: x, position_y: y })
          }}
          onMdfIdfDeleted={async (id) => {
            await deleteInfrastructure(id)
          }}
          onDragCommit={() => {}}
          hiddenCategories={hiddenCategories}
          zoomToPointRef={zoomToPointRef}
          walls={walls}
          onWallCreated={(pts) => {
            setWalls(prev => [...prev, { id: crypto.randomUUID(), points: pts }])
            toast.success('Wall created')
          }}
          onWallDeleted={(id) => { setWalls(prev => prev.filter(w => w.id !== id)); if (selectedWallId === id) setSelectedWallId(null) }}
          onMdfSelected={(id) => { setSelectedMdfId(id); setSelectedDeviceId(null) }}
          showIrRange={showIrRange}
          hiddenPpfZones={hiddenPpfZones}
          showBlindSpot={showBlindSpot}
          onWallSelected={(id) => { setSelectedWallId(id); setSelectedDeviceId(null); setSelectedMdfId(null) }}
        />

        {/* ── RIGHT PANEL (300px, overlay) ── */}
        {selectedDevice && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
            boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
          }}>
            <RightPanel
              device={selectedDevice}
              onClose={() => setSelectedDeviceId(null)}
              onUpdateDevice={handleUpdateDevice}
              onDuplicate={handleDeviceCopy}
              onDelete={handleDeviceDelete}
              scalePxPerFt={scalePxPerFt}
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
            />
          </div>
        )}

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
                onUpdateWall={(id, updates) => {
                  setWalls(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w))
                }}
                onDelete={(id) => {
                  setWalls(prev => prev.filter(w => w.id !== id))
                  setSelectedWallId(null)
                }}
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
        {/* PPF Legend */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginRight: 16 }}>
          {PPF_CHART.slice(1, 5).map(tier => (
            <div key={tier.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: tier.color, opacity: 0.8 }} />
              <span style={{ fontSize: 9 }}>{tier.label}</span>
            </div>
          ))}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: C.border, margin: '0 8px' }} />

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

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Scale bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 50, height: 4, background: C.accent, borderRadius: 1,
            position: 'relative',
          }}>
            <div style={{ position: 'absolute', left: 0, top: -2, width: 1, height: 8, background: C.accent }} />
            <div style={{ position: 'absolute', right: 0, top: -2, width: 1, height: 8, background: C.accent }} />
          </div>
          <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: C.text }}>
            {(50 / scalePxPerFt).toFixed(0)} ft
          </span>
        </div>
      </div>

      {/* ═══════ DEVICE CATALOG MODAL ═══════ */}
      {showCatalog && (
        <DeviceCatalogModal
          category="cctv"
          onClose={() => setShowCatalog(false)}
          onSelect={handleDeviceSelected}
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
