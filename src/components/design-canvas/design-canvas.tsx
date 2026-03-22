'use client'
/**
 * DesignCanvas — Main orchestrator (Hanwha DesignPro / IPVM-style layout).
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ TOOLBAR: ← Back │ Area tabs │ Tools │ FOV mode │ Export │ Save │
 *   ├──────────┬──────────────────────────────────┬──────────────────┤
 *   │  LEFT    │        CANVAS                    │   RIGHT PANEL    │
 *   │  PANEL   │   Floor plan + devices + cones   │   Properties     │
 *   │  Device  │   FOV handles (IPVM-style)       │   Scene config   │
 *   │  list    │                                  │   Sliders+inputs │
 *   ├──────────┴──────────────────────────────────┴──────────────────┤
 *   │ BOTTOM BAR: Device counts │ BW │ Storage │ PoE                │
 *   └─────────────────────────────────────────────────────────────────┘
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Eye, EyeOff, Upload, Grid3X3, Undo2, Redo2,
  Download, MousePointer, Hand, Ruler, Trash2, Cable, Server,
  ChevronDown, X, Layers,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { C, type CanvasTool } from './constants'
import { CanvasArea, type DeviceFovData } from './canvas-area'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { DeviceCatalogModal } from './device-catalog-modal'
import { useDesignCanvas } from '@/hooks/useDesignCanvas'
import type { FovDoriInput } from '@/lib/calculators'
import type { DesignDevice, DeviceSearchResult } from '@/types/database'

/* ─── Props ─── */
interface Props { designId: string; onNavigateDashboard?: () => void }

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
    addCable, addInfrastructure, updateInfrastructure, deleteInfrastructure,
  } = state

  /* ── UI state ── */
  const [activeTool, setActiveTool] = useState<CanvasTool>('select')
  const [showGrid, setShowGrid] = useState(true)
  const [showFov, setShowFov] = useState(true)
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showCatalog, setShowCatalog] = useState(false)
  const [fovMode, setFovMode] = useState<'simple' | 'ppf' | 'dori'>('simple')
  const [floorPlanOpacity, setFloorPlanOpacity] = useState(0.6)
  const [scalePxPerFt, setScalePxPerFt] = useState(10)

  /* ── Undo/Redo (simplified) ── */
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
      const installH = Number(props.install_height) || 9

      let hFov = fovAngle
      if (focalLength > 0 && sensorW > 0) {
        hFov = 2 * Math.atan(sensorW / (2 * focalLength)) * (180 / Math.PI)
      }

      // Build tiers based on available data
      const deviceColor = d.color_hex || C.accent
      const tiers = (focalLength > 0 && sensorW > 0 && resW > 0)
        ? [
            { distanceFt: targetDist, color: deviceColor, opacity: 0.15 },
            { distanceFt: targetDist * 0.6, color: '#eab308', opacity: 0.12 },
            { distanceFt: targetDist * 0.3, color: '#22c55e', opacity: 0.15 },
          ]
        : [{ distanceFt: targetDist, color: deviceColor, opacity: 0.15 }]

      map.set(d.id, {
        hFov, rotation: d.rotation || 0, tiers,
        resolutionW: resW || undefined,
        sensorW: sensorW || undefined,
        focalLength: focalLength || undefined,
        colorHex: d.color_hex || undefined,
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

  const handleDeviceSelected = useCallback(async (item: DeviceSearchResult) => {
    setShowCatalog(false)
    const dev = await addDevice({
      design_id: designId, area_id: activeAreaId, category: item.category,
      label: `${item.vendor} ${item.model}`,
      position_x: 400, position_y: 300,
      rotation: 0, properties: item.specs ?? {},
      device_library_item_id: item.id,
    })
    if (dev) {
      setSelectedDeviceId(dev.id)
      setActiveTool('select')
    }
  }, [addDevice, designId, activeAreaId, setSelectedDeviceId])

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.bg, color: C.textMuted, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      Loading design…
    </div>
  )
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.bg, color: C.red, fontFamily: "'IBM Plex Sans', sans-serif" }}>
      Error: {error}
    </div>
  )

  /* ── Tool definitions ── */
  const tools: Array<{ id: CanvasTool; icon: React.ReactNode; label: string }> = [
    { id: 'select', icon: <MousePointer size={14} />, label: 'Select' },
    { id: 'pan', icon: <Hand size={14} />, label: 'Pan' },
    { id: 'measure', icon: <Ruler size={14} />, label: 'Measure' },
    { id: 'scale', icon: <Ruler size={14} />, label: 'Scale' },
    { id: 'cable', icon: <Cable size={14} />, label: 'Cable' },
    { id: 'mdf_idf', icon: <Server size={14} />, label: 'MDF/IDF' },
  ]

  const toolBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px',
    background: active ? C.accentSubtle : 'transparent',
    border: active ? `1px solid ${C.accent}40` : '1px solid transparent',
    borderRadius: 5, color: active ? C.accent : C.textMuted,
    fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.12s',
  })

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: C.bg, color: C.text, fontFamily: "'IBM Plex Sans', sans-serif",
    }}>
      {/* ═══════ TOOLBAR ═══════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', background: C.bgSurface,
        borderBottom: `1px solid ${C.border}`, zIndex: 50, flexShrink: 0,
      }}>
        {/* Back */}
        <button onClick={() => onNavigateDashboard ? onNavigateDashboard() : router.back()}
          style={{ ...toolBtn(false), marginRight: 4 }}>
          <ArrowLeft size={14} />
        </button>

        {/* Project name */}
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, marginRight: 8 }}>
          {design?.name || 'Design'}
        </span>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }} />

        {/* Area tabs */}
        {areas.map(area => (
          <button key={area.id}
            onClick={() => setActiveAreaId(area.id)}
            style={{
              ...toolBtn(area.id === activeAreaId),
              fontSize: 11,
            }}>
            {area.name}
          </button>
        ))}

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }} />

        {/* Tools */}
        {tools.map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)}
            style={toolBtn(activeTool === t.id)} title={t.label}>
            {t.icon}
            <span style={{ fontSize: 10 }}>{t.label}</span>
          </button>
        ))}

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: C.border, margin: '0 4px' }} />

        {/* Toggle buttons */}
        <button onClick={() => setShowGrid(!showGrid)} style={toolBtn(showGrid)} title="Grid">
          <Grid3X3 size={14} />
        </button>
        <button onClick={() => setShowFov(!showFov)} style={toolBtn(showFov)} title="FOV Cones">
          {showFov ? <Eye size={14} /> : <EyeOff size={14} />}
          <span style={{ fontSize: 10 }}>FOV</span>
        </button>

        {/* FOV mode selector */}
        {showFov && (
          <select value={fovMode}
            onChange={e => setFovMode(e.target.value as 'simple' | 'ppf' | 'dori')}
            style={{
              background: C.bgActive, border: `1px solid ${C.border}`,
              borderRadius: 4, color: C.text, fontSize: 10, padding: '3px 6px',
              fontFamily: 'inherit', cursor: 'pointer',
            }}>
            <option value="simple">Simple</option>
            <option value="ppf">PPF</option>
            <option value="dori">DORI</option>
          </select>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right-side actions */}
        <label style={toolBtn(false)} title="Upload Floor Plan">
          <Upload size={14} />
          <span style={{ fontSize: 10 }}>Floor Plan</span>
          <input type="file" accept="image/*" hidden onChange={handleFloorPlanUpload} />
        </label>

        <button onClick={() => setShowCatalog(true)} style={{ ...toolBtn(false), background: C.accent, color: '#fff', border: `1px solid ${C.accent}` }}>
          <Plus size={14} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>Add Device</span>
        </button>
      </div>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ── LEFT PANEL ── */}
        {showLeftPanel && (
          <LeftPanel
            devices={areaDevices}
            selectedId={selectedDeviceId}
            onSelect={handleSelectDevice}
            onAddDevice={() => setShowCatalog(true)}
            onDeleteDevice={handleDeviceDelete}
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
          onSelectDevice={handleSelectDevice}
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
          onCanvasClick={(x, y) => {}}
          onCableCreated={async (cable) => { await addCable({ ...cable, design_id: designId, area_id: activeAreaId }) }}
          mdfIdfs={mdfIdfs.filter(n => n.area_id === activeAreaId)}
          onMdfIdfPlaced={async (x, y) => {
            await addInfrastructure({ design_id: designId, area_id: activeAreaId, name: 'MDF', position_x: x, position_y: y })
          }}
          onDragCommit={() => {}}
        />

        {/* ── RIGHT PANEL (overlay) ── */}
        {selectedDevice && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
            boxShadow: '-4px 0 16px rgba(0,0,0,0.4)',
          }}>
            <RightPanel
              device={selectedDevice}
              onClose={() => setSelectedDeviceId(null)}
              onUpdateDevice={handleUpdateDevice}
              onDuplicate={handleDeviceCopy}
              onDelete={handleDeviceDelete}
              scalePxPerFt={scalePxPerFt}
            />
          </div>
        )}
      </div>

      {/* ═══════ BOTTOM BAR ═══════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '6px 16px',
        background: C.bgSurface, borderTop: `1px solid ${C.border}`,
        fontSize: 11, color: C.textMuted, flexShrink: 0,
      }}>
        <span>📷 {areaDevices.filter(d => ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye'].includes(d.category)).length} cameras</span>
        <span>🚪 {areaDevices.filter(d => d.category === 'access_control').length} doors</span>
        <span>🔌 {areaDevices.filter(d => d.category === 'network').length} network</span>
        <span>Total: {areaDevices.length} devices</span>
        <div style={{ flex: 1 }} />
        <span>Scale: {scalePxPerFt.toFixed(1)} px/ft</span>
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
