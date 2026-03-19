'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { C, GRID_SIZE, ZOOM_MIN, ZOOM_MAX, type CanvasTool } from './constants'
import { Minimap, type MinimapDevice, type MinimapZone, type MinimapInfra, type MinimapViewport } from './minimap'
import { DEVICE_SVG_STRINGS, CATEGORY_TO_ICON, ToolbarIcons } from './icons'
import { calculatePpfAtDistance, classifyDori } from '@/lib/calculators'
import type { DoriClassification } from '@/lib/calculators'
import type { DesignDevice, DesignCable, DesignFloorPlan, DesignZone, DesignMdfIdf } from '@/types/database'

type FabricCanvas = import('fabric').Canvas
type FabricObject = import('fabric').FabricObject

// ---- FOV Tier Data ----
interface FovTier {
  distanceFt: number
  color: string
  opacity: number
}

export interface DeviceFovData {
  hFov: number
  rotation: number
  tiers: FovTier[]
  sensorAngles?: number[]
  // Camera specs for PPF-at-cursor computation
  resolutionW?: number
  sensorW?: number
  focalLength?: number
}

// ---- Cable Draw State Machine ----
type CableDrawPhase = 'idle' | 'pick_source' | 'routing' | 'complete'
interface CableDrawState {
  phase: CableDrawPhase
  sourceDeviceId: string | null
  waypoints: Array<{ x: number; y: number }>
}

// ---- Scale Calibration ----
interface ScaleCalState {
  points: Array<{ x: number; y: number }>
}

// ---- Context Menu ----
interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  deviceId: string | null
}

// ---- Measure State ----
interface MeasureState {
  points: Array<{ x: number; y: number }>
}

// ---- Zone Draw State ----
interface ZoneDrawState {
  phase: 'idle' | 'drawing'
  startX: number
  startY: number
}

interface CanvasAreaProps {
  designId: string
  areaId: string | null
  floorPlan: DesignFloorPlan | null
  devices: DesignDevice[]
  cables: DesignCable[]
  showGrid: boolean
  activeTool: CanvasTool
  selectedDeviceId: string | null
  showFovCones: boolean
  fovData: Map<string, DeviceFovData>
  scalePxPerFt: number
  onZoomChange?: (zoom: number) => void
  onSelectDevice: (id: string | null) => void
  onDeviceMoved?: (id: string, x: number, y: number) => void
  onDeviceRotated?: (id: string, angle: number) => void
  onCanvasClick?: (x: number, y: number) => void
  onDeviceCopy?: (id: string) => void
  onDeviceDelete?: (id: string) => void
  onCableCreated?: (cable: { from_device_id: string; to_device_id: string | null; waypoints: Array<{ x: number; y: number }>; length_ft: number }) => void
  onToolChange?: (tool: CanvasTool) => void
  onScaleCalibrated?: (pxPerFt: number) => void
  onFloorPlanError?: (msg: string) => void
  zones?: DesignZone[]
  selectedZoneId?: string | null
  onZoneCreated?: (zone: { name: string; color: string; x: number; y: number; width: number; height: number }) => void
  onZoneMoved?: (id: string, x: number, y: number) => void
  onZoneResized?: (id: string, width: number, height: number) => void
  onSelectZone?: (id: string | null) => void
  pendingDeviceName?: string
  onDeviceDrop?: (x: number, y: number, deviceData: string) => void
  snapToGrid?: boolean
  hiddenCategories?: Set<string>
  onUndo?: () => void
  onRedo?: () => void
  floorPlanOpacity?: number
  onFovHandleDragged?: (deviceId: string, targetDistanceFt: number) => void
  fovDisplayMode?: 'ppf' | 'dori'
  highlightedPpfTier?: string | null
  onPpfTierClick?: (tier: string | null) => void
  mdfIdfs?: DesignMdfIdf[]
  onMdfIdfPlaced?: (x: number, y: number) => void
  onMdfIdfMoved?: (id: string, x: number, y: number) => void
  snapshotRef?: React.MutableRefObject<(() => string | null) | null>
  showMinimap?: boolean
  satelliteConfig?: { lat: number; lng: number; zoom: number; opacity?: number } | null
}

const deviceObjectMap = new Map<string, FabricObject>()
const fovObjectMap = new Map<string, FabricObject[]>()
const cableObjectMap = new Map<string, FabricObject>()
const zoneObjectMap = new Map<string, FabricObject[]>()

export function CanvasArea({
  designId, areaId, floorPlan, devices, cables, showGrid, activeTool, selectedDeviceId,
  showFovCones, fovData, scalePxPerFt,
  onZoomChange, onSelectDevice, onDeviceMoved, onDeviceRotated, onCanvasClick,
  onDeviceCopy, onDeviceDelete, onCableCreated, onToolChange, onScaleCalibrated, onFloorPlanError,
  zones = [], selectedZoneId, onZoneCreated, onZoneMoved, onZoneResized, onSelectZone,
  pendingDeviceName,
  onDeviceDrop, snapToGrid, hiddenCategories, onUndo, onRedo, floorPlanOpacity,
  onFovHandleDragged, fovDisplayMode = 'ppf', highlightedPpfTier, onPpfTierClick,
  mdfIdfs = [], onMdfIdfPlaced, onMdfIdfMoved,
  snapshotRef,
  showMinimap = false,
  satelliteConfig,
}: CanvasAreaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [fabricReady, setFabricReady] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [vpState, setVpState] = useState<MinimapViewport>({ worldX: 0, worldY: 0, worldW: 4000, worldH: 3000 })
  const [cableDraw, setCableDraw] = useState<CableDrawState>({ phase: 'idle', sourceDeviceId: null, waypoints: [] })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, deviceId: null })
  const [measureState, setMeasureState] = useState<MeasureState>({ points: [] })
  const [scaleCal, setScaleCal] = useState<ScaleCalState>({ points: [] })
  const measureObjectsRef = useRef<FabricObject[]>([])
  const cablePreviewRef = useRef<FabricObject | null>(null)
  const scaleObjectsRef = useRef<FabricObject[]>([])
  const [scaleInput, setScaleInput] = useState<{ visible: boolean; distPx: number }>({ visible: false, distPx: 0 })
  const [zoneDraw, setZoneDraw] = useState<{ isDrawing: boolean; startX: number; startY: number }>({ isDrawing: false, startX: 0, startY: 0 })
  const zonePreviewRef = useRef<FabricObject | null>(null)
  const activeToolRef = useRef(activeTool)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  const snapRef = useRef(snapToGrid)
  useEffect(() => { snapRef.current = snapToGrid }, [snapToGrid])
  const [ppfTooltip, setPpfTooltip] = useState<{ visible: boolean; x: number; y: number; ppf: number; dori: string; distFt: number } | null>(null)
  const fovHandleMap = useRef(new Map<string, FabricObject>())
  const mdfIdfObjectMap = useRef(new Map<string, FabricObject[]>())

  // Sync viewport state for minimap
  const syncViewport = useCallback(() => {
    const fc = fabricRef.current
    if (!fc) return
    const vpt = fc.viewportTransform
    const z = fc.getZoom()
    const w = fc.getWidth()
    const h = fc.getHeight()
    if (vpt) {
      setVpState({
        worldX: -vpt[4] / z,
        worldY: -vpt[5] / z,
        worldW: w / z,
        worldH: h / z,
      })
    }
  }, [])

  // ---- Initialize Fabric.js ----
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return
    let cancelled = false

    async function initFabric() {
      const fabricModule = await import('fabric')
      if (cancelled || !canvasRef.current) return
      const container = containerRef.current
      const width = container?.clientWidth ?? 800
      const height = container?.clientHeight ?? 600

      const canvas = new fabricModule.Canvas(canvasRef.current, {
        width, height, backgroundColor: C.bg, selection: true,
        preserveObjectStacking: true, fireRightClick: true, stopContextMenu: true,
      })
      fabricRef.current = canvas
      setFabricReady(true)

      // Zoom
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY
        let zoom = canvas.getZoom()
        zoom *= 0.999 ** delta
        zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
        const point = canvas.getScenePoint(opt.e)
        canvas.zoomToPoint(point, zoom)
        setZoomLevel(zoom)
        onZoomChange?.(zoom)
        opt.e.preventDefault()
        opt.e.stopPropagation()
      })

      // Pan
      let isPanning = false
      let lastPanX = 0
      let lastPanY = 0
      let spaceHeld = false
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') { spaceHeld = true; if (container) container.style.cursor = 'grab' }
        if (e.key === 'Escape') {
          setContextMenu({ visible: false, x: 0, y: 0, deviceId: null })
          setCableDraw({ phase: 'idle', sourceDeviceId: null, waypoints: [] })
          setMeasureState({ points: [] })
          setScaleCal({ points: [] })
          if (cablePreviewRef.current && fabricRef.current) {
            fabricRef.current.remove(cablePreviewRef.current)
            cablePreviewRef.current = null
            fabricRef.current.renderAll()
          }
          // Clear scale calibration visuals
          if (fabricRef.current && scaleObjectsRef.current.length > 0) {
            for (const obj of scaleObjectsRef.current) fabricRef.current.remove(obj)
            scaleObjectsRef.current = []
            fabricRef.current.renderAll()
          }
        }
      }
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') { spaceHeld = false; if (container) container.style.cursor = 'default' }
      }
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('keyup', handleKeyUp)

      canvas.on('mouse:down', (opt) => {
        const evt = opt.e as MouseEvent
        setContextMenu({ visible: false, x: 0, y: 0, deviceId: null })
        if (evt.button === 1 || spaceHeld || activeToolRef.current === 'pan') {
          isPanning = true; lastPanX = evt.clientX; lastPanY = evt.clientY
          canvas.selection = false
          if (container) container.style.cursor = 'grabbing'
          return
        }
        if (evt.button === 2 && opt.target) {
          const did = (opt.target as unknown as Record<string, unknown>).deviceId as string
          if (did) setContextMenu({ visible: true, x: evt.clientX, y: evt.clientY, deviceId: did })
          return
        }
        if (evt.button === 0 && !opt.target) onSelectDevice(null)
      })
      canvas.on('mouse:move', (opt) => {
        if (!isPanning) return
        const evt = opt.e as MouseEvent
        const vpt = canvas.viewportTransform
        if (vpt) { vpt[4] += evt.clientX - lastPanX; vpt[5] += evt.clientY - lastPanY }
        lastPanX = evt.clientX; lastPanY = evt.clientY
        canvas.requestRenderAll()
      })
      canvas.on('mouse:up', () => {
        if (isPanning) {
          isPanning = false; canvas.selection = true
          if (container) container.style.cursor = activeToolRef.current === 'pan' ? 'grab' : spaceHeld ? 'grab' : 'default'
        }
      })

      // Selection bridging
      canvas.on('selection:created', (e) => { const did = (e.selected?.[0] as unknown as Record<string, unknown>)?.deviceId as string; if (did) onSelectDevice(did) })
      canvas.on('selection:updated', (e) => { const did = (e.selected?.[0] as unknown as Record<string, unknown>)?.deviceId as string; if (did) onSelectDevice(did) })
      canvas.on('selection:cleared', () => onSelectDevice(null))

      // Object modified
      canvas.on('object:modified', (e) => {
        const obj = e.target; if (!obj) return
        const did = (obj as unknown as Record<string, unknown>).deviceId as string; if (!did) return
        if (obj.left !== undefined && obj.top !== undefined) {
          let x = Math.round(obj.left), y = Math.round(obj.top)
          if (snapRef.current) {
            x = Math.round(x / GRID_SIZE) * GRID_SIZE
            y = Math.round(y / GRID_SIZE) * GRID_SIZE
            obj.set({ left: x, top: y })
            canvas.renderAll()
          }
          onDeviceMoved?.(did, x, y)
        }
        if (obj.angle !== undefined) onDeviceRotated?.(did, Math.round(obj.angle))
      })

      ;(canvas as unknown as Record<string, unknown>).__cleanupListeners = () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('keyup', handleKeyUp)
      }
    }
    void initFabric()
    return () => {
      cancelled = true
      if (fabricRef.current) {
        const cleanup = (fabricRef.current as unknown as Record<string, unknown>).__cleanupListeners
        if (typeof cleanup === 'function') cleanup()
        fabricRef.current.dispose(); fabricRef.current = null; setFabricReady(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Expose canvas snapshot function to parent via ref
  useEffect(() => {
    if (!snapshotRef) return
    snapshotRef.current = () => {
      const fc = fabricRef.current
      if (!fc) return null
      try {
        return fc.toDataURL({ format: 'png', multiplier: 2 })
      } catch { return null }
    }
    return () => { if (snapshotRef) snapshotRef.current = null }
  }, [fabricReady, snapshotRef])

  // Viewport sync for minimap (throttled)
  useEffect(() => {
    if (!fabricReady || !showMinimap) return
    const fc = fabricRef.current
    if (!fc) return
    let raf = 0
    const handler = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        syncViewport()
      })
    }
    fc.on('after:render', handler)
    syncViewport() // initial
    return () => { fc.off('after:render', handler); if (raf) cancelAnimationFrame(raf) }
  }, [fabricReady, showMinimap, syncViewport])

  // Resize
  useEffect(() => {
    if (!fabricRef.current || !containerRef.current) return
    const observer = new ResizeObserver(() => {
      const c = fabricRef.current; const ct = containerRef.current
      if (!c || !ct) return
      c.setDimensions({ width: ct.clientWidth, height: ct.clientHeight })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [fabricReady])

  // ---- Extended keyboard shortcuts ----
  useEffect(() => {
    function handleKeyboard(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDeviceId) {
        e.preventDefault(); onDeviceDelete?.(selectedDeviceId)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); onUndo?.()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault(); onRedo?.()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault(); onRedo?.()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'd') && selectedDeviceId) {
        e.preventDefault(); onDeviceCopy?.(selectedDeviceId)
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedDeviceId) {
        e.preventDefault()
        const nudge = e.shiftKey ? 10 : 1
        const obj = deviceObjectMap.get(selectedDeviceId)
        if (obj && fabricRef.current) {
          const dx = e.key === 'ArrowRight' ? nudge : e.key === 'ArrowLeft' ? -nudge : 0
          const dy = e.key === 'ArrowDown' ? nudge : e.key === 'ArrowUp' ? -nudge : 0
          obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy })
          fabricRef.current.renderAll()
          onDeviceMoved?.(selectedDeviceId, Math.round(obj.left ?? 0), Math.round(obj.top ?? 0))
        }
      }
    }
    document.addEventListener('keydown', handleKeyboard)
    return () => document.removeEventListener('keydown', handleKeyboard)
  }, [selectedDeviceId, onDeviceDelete, onDeviceCopy, onUndo, onRedo, onDeviceMoved])

  // ---- Canvas click: Place / Cable / Measure / Scale ----
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    const handler = (opt: { e: Event; target?: FabricObject | null }) => {
      const evt = opt.e as MouseEvent
      if (evt.button !== 0) return
      const point = canvas.getScenePoint(evt)
      const x = Math.round(point.x)
      const y = Math.round(point.y)

      // Place mode
      if (activeTool === 'place' && !opt.target) { onCanvasClick?.(x, y); return }

      // Cable draw
      if (activeTool === 'cable') {
        if (cableDraw.phase === 'pick_source' || cableDraw.phase === 'idle') {
          // Find device near click
          for (const d of devices) {
            const dx = x - d.position_x; const dy = y - d.position_y
            if (Math.sqrt(dx * dx + dy * dy) < 20) {
              setCableDraw({ phase: 'routing', sourceDeviceId: d.id, waypoints: [{ x: d.position_x, y: d.position_y }] })
              return
            }
          }
        } else if (cableDraw.phase === 'routing') {
          // Check if clicking destination device
          for (const d of devices) {
            if (d.id === cableDraw.sourceDeviceId) continue
            const dx = x - d.position_x; const dy = y - d.position_y
            if (Math.sqrt(dx * dx + dy * dy) < 20) {
              const finalWp = [...cableDraw.waypoints, { x: d.position_x, y: d.position_y }]
              let totalLen = 0
              for (let i = 1; i < finalWp.length; i++) {
                const ddx = finalWp[i].x - finalWp[i - 1].x
                const ddy = finalWp[i].y - finalWp[i - 1].y
                totalLen += Math.sqrt(ddx * ddx + ddy * ddy) / (scalePxPerFt || 1)
              }
              onCableCreated?.({ from_device_id: cableDraw.sourceDeviceId!, to_device_id: d.id, waypoints: finalWp, length_ft: Math.round(totalLen) })
              setCableDraw({ phase: 'pick_source', sourceDeviceId: null, waypoints: [] })
              return
            }
          }
          // Add waypoint
          setCableDraw((prev) => ({ ...prev, waypoints: [...prev.waypoints, { x, y }] }))
        }
        return
      }

      // Measure tool
      if (activeTool === 'measure') {
        setMeasureState((prev) => {
          const pts = [...prev.points, { x, y }]
          if (pts.length >= 2) {
            drawMeasurement(pts[0], pts[1])
            return { points: [] }
          }
          return { points: pts }
        })
        return
      }

      // Zone draw start
      if (activeTool === 'zone' && !opt.target) {
        setZoneDraw({ isDrawing: true, startX: x, startY: y })
        return
      }

      // MDF/IDF placement
      if (activeTool === 'mdf_idf' && !opt.target) {
        onMdfIdfPlaced?.(x, y)
        return
      }

      // Scale calibration
      if (activeTool === 'scale') {
        setScaleCal((prev) => {
          const pts = [...prev.points, { x, y }]
          // Draw dot at each click point
          import('fabric').then((fm) => {
            if (!fabricRef.current) return
            const dot = new fm.Circle({ left: x, top: y, radius: 4, fill: C.red, originX: 'center', originY: 'center', selectable: false, evented: false })
            fabricRef.current.add(dot)
            scaleObjectsRef.current.push(dot)
            if (pts.length >= 2) {
              // Draw line between the two points
              const line = new fm.Line([pts[0].x, pts[0].y, pts[1].x, pts[1].y], {
                stroke: C.red, strokeWidth: 1.5, strokeDashArray: [4, 2], selectable: false, evented: false,
              })
              fabricRef.current.add(line)
              scaleObjectsRef.current.push(line)
            }
            fabricRef.current.renderAll()
          })
          if (pts.length >= 2) {
            const dx = pts[1].x - pts[0].x; const dy = pts[1].y - pts[0].y
            const distPx = Math.sqrt(dx * dx + dy * dy)
            setScaleInput({ visible: true, distPx })
            return { points: [] }
          }
          return { points: pts }
        })
        return
      }
    }
    canvas.on('mouse:down', handler)
    return () => { canvas.off('mouse:down', handler) }
  }, [activeTool, fabricReady, cableDraw, devices, scalePxPerFt, onCanvasClick, onCableCreated, onScaleCalibrated, onMdfIdfPlaced])

  // ---- Cable preview line during routing ----
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    if (activeTool !== 'cable' || cableDraw.phase !== 'routing' || cableDraw.waypoints.length === 0) {
      // Clean up preview if exists
      if (cablePreviewRef.current && fabricRef.current) {
        fabricRef.current.remove(cablePreviewRef.current)
        cablePreviewRef.current = null
        fabricRef.current.renderAll()
      }
      return
    }
    const canvas = fabricRef.current
    const handler = (opt: { e: Event }) => {
      const evt = opt.e as MouseEvent
      const point = canvas.getScenePoint(evt)
      const wps = cableDraw.waypoints
      // Remove old preview
      if (cablePreviewRef.current) canvas.remove(cablePreviewRef.current)
      import('fabric').then((fm) => {
        const allPts = [...wps, { x: point.x, y: point.y }].map((p) => new fm.Point(p.x, p.y))
        const preview = new fm.Polyline(allPts, {
          fill: 'transparent', stroke: C.accent, strokeWidth: 1.5,
          strokeDashArray: [4, 4], selectable: false, evented: false, opacity: 0.5,
        })
        cablePreviewRef.current = preview
        canvas.add(preview)
        canvas.renderAll()
      })
    }
    canvas.on('mouse:move', handler)
    return () => {
      canvas.off('mouse:move', handler)
      if (cablePreviewRef.current && fabricRef.current) {
        fabricRef.current.remove(cablePreviewRef.current)
        cablePreviewRef.current = null
      }
    }
  }, [activeTool, cableDraw, fabricReady])

  // ---- Draw measurement line ----
  const drawMeasurement = useCallback(async (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    if (!fabricRef.current) return
    const fabric = await import('fabric')
    const canvas = fabricRef.current
    // Clear previous measurement
    for (const obj of measureObjectsRef.current) canvas.remove(obj)
    measureObjectsRef.current = []
    const dx = p2.x - p1.x; const dy = p2.y - p1.y
    const distPx = Math.sqrt(dx * dx + dy * dy)
    const distFt = scalePxPerFt > 0 ? distPx / scalePxPerFt : distPx

    const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
      stroke: C.green, strokeWidth: 1.5, strokeDashArray: [4, 2], selectable: false, evented: false,
    })
    const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2
    const label = new fabric.FabricText(`${distFt.toFixed(1)} ft`, {
      left: midX, top: midY - 12, fontSize: 11, fill: C.green,
      fontFamily: 'IBM Plex Mono', selectable: false, evented: false, originX: 'center',
    })
    canvas.add(line, label)
    measureObjectsRef.current.push(line, label)
    canvas.renderAll()
  }, [scalePxPerFt])

  // Cursor
  useEffect(() => {
    if (!containerRef.current) return
    const cursors: Record<string, string> = { place: 'crosshair', cable: 'crosshair', measure: 'crosshair', scale: 'crosshair', zone: 'crosshair', select: 'default', pan: 'grab' }
    containerRef.current.style.cursor = cursors[activeTool] || 'default'
  }, [activeTool])

  // ---- Sync devices (diff-based — only add/remove/update what changed) ----
  const prevDeviceSnapRef = useRef<string>('')
  useEffect(() => {
    if (!fabricReady || !fabricRef.current) return
    const canvas = fabricRef.current

    // Build a snapshot string of current device state for comparison
    const visibleDevices = devices.filter((d) => !hiddenCategories?.has(d.category))
    const snapshot = visibleDevices.map((d) =>
      `${d.id}|${d.position_x}|${d.position_y}|${d.rotation || 0}|${d.color_hex || ''}|${d.label}|${d.status || 'new'}|${d.category}`
    ).join(';')

    // Skip if nothing changed
    if (snapshot === prevDeviceSnapRef.current) return
    prevDeviceSnapRef.current = snapshot

    const currentIds = new Set(visibleDevices.map((d) => d.id))
    const existingIds = new Set(deviceObjectMap.keys())

    // Remove devices no longer present (or now hidden)
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const obj = deviceObjectMap.get(id)
        if (obj) canvas.remove(obj)
        deviceObjectMap.delete(id)
      }
    }
    // Remove all labels (they don't have stable IDs — simpler to recreate)
    canvas.getObjects().filter((o) => (o as unknown as Record<string, unknown>).__isLabel === true).forEach((o) => canvas.remove(o))

    // Update existing device positions/rotation (no SVG reload needed)
    for (const device of visibleDevices) {
      const existing = deviceObjectMap.get(device.id)
      if (existing) {
        existing.set({ left: device.position_x, top: device.position_y, angle: device.rotation || 0 })
      }
    }

    // Add new devices
    const newDevices = visibleDevices.filter((d) => !existingIds.has(d.id))
    async function addNewDevices() {
      const fabric = await import('fabric')
      for (const device of newDevices) {
        const iconKey = CATEGORY_TO_ICON[device.category] || 'dome_camera'
        const svgString = DEVICE_SVG_STRINGS[iconKey]
        if (!svgString) continue
        const coloredSvg = svgString.replace(/#000/g, device.color_hex || C.accent)
        try {
          const result = await fabric.loadSVGFromString(coloredSvg)
          const group = fabric.util.groupSVGElements(result.objects.filter(Boolean) as FabricObject[], result.options)
          group.set({ left: device.position_x, top: device.position_y, angle: device.rotation || 0, scaleX: 0.5, scaleY: 0.5, originX: 'center', originY: 'center', hasControls: true, hasBorders: true, lockScalingX: true, lockScalingY: true })
          ;(group as unknown as Record<string, unknown>).deviceId = device.id
          canvas.add(group); deviceObjectMap.set(device.id, group)
        } catch { /* skip */ }
      }
      // Re-add all labels for visible devices (lightweight text objects)
      const fabric2 = fabric
      for (const device of visibleDevices) {
        const statusColors: Record<string, string> = { new: C.green, existing_keep: C.accent, existing_remove: C.red, relocate: C.yellow }
        const statusColor = statusColors[device.status || 'new'] || C.green
        if (device.status && device.status !== 'new') {
          const ring = new fabric2.Circle({
            left: device.position_x, top: device.position_y,
            radius: 16, fill: 'transparent', stroke: statusColor, strokeWidth: 1.5,
            strokeDashArray: device.status === 'existing_remove' ? [3, 2] : undefined,
            originX: 'center', originY: 'center', selectable: false, evented: false, opacity: 0.7,
          })
          ;(ring as unknown as Record<string, unknown>).__isLabel = true
          canvas.add(ring)
        }
        const labelText = new fabric2.FabricText(device.label, { left: device.position_x, top: device.position_y + 22, fontSize: 10, fill: C.textMuted, fontFamily: 'IBM Plex Sans, sans-serif', originX: 'center', originY: 'top', selectable: false, evented: false })
        ;(labelText as unknown as Record<string, unknown>).__isLabel = true
        canvas.add(labelText)
      }
      canvas.renderAll()
    }
    // Only run async SVG loading if there are actually new devices; otherwise just re-render for position updates + labels
    if (newDevices.length > 0) {
      void addNewDevices()
    } else {
      // Labels were already re-added synchronously above... need fabric import for them
      async function readdLabels() {
        const fabric = await import('fabric')
        for (const device of visibleDevices) {
          const statusColors: Record<string, string> = { new: C.green, existing_keep: C.accent, existing_remove: C.red, relocate: C.yellow }
          const statusColor = statusColors[device.status || 'new'] || C.green
          if (device.status && device.status !== 'new') {
            const ring = new fabric.Circle({
              left: device.position_x, top: device.position_y,
              radius: 16, fill: 'transparent', stroke: statusColor, strokeWidth: 1.5,
              strokeDashArray: device.status === 'existing_remove' ? [3, 2] : undefined,
              originX: 'center', originY: 'center', selectable: false, evented: false, opacity: 0.7,
            })
            ;(ring as unknown as Record<string, unknown>).__isLabel = true
            canvas.add(ring)
          }
          const labelText = new fabric.FabricText(device.label, { left: device.position_x, top: device.position_y + 22, fontSize: 10, fill: C.textMuted, fontFamily: 'IBM Plex Sans, sans-serif', originX: 'center', originY: 'top', selectable: false, evented: false })
          ;(labelText as unknown as Record<string, unknown>).__isLabel = true
          canvas.add(labelText)
        }
        canvas.renderAll()
      }
      void readdLabels()
    }
  }, [devices, fabricReady, hiddenCategories])

  // ---- DORI tier labels for display ----
  const TIER_LABELS: Record<string, string> = { '#22c55e': 'ID', '#eab308': 'REC', '#f97316': 'OBS', '#ef4444': 'DET' }

  // ---- FOV Cone Rendering + Drag Handles + DORI Labels ----
  useEffect(() => {
    if (!fabricReady || !fabricRef.current) return
    const canvas = fabricRef.current
    fovObjectMap.forEach((objs) => objs.forEach((o) => canvas.remove(o))); fovObjectMap.clear()
    fovHandleMap.current.forEach((o) => canvas.remove(o)); fovHandleMap.current.clear()
    if (!showFovCones) { canvas.renderAll(); return }

    async function addFovCones() {
      const fabric = await import('fabric')
      for (const [deviceId, data] of fovData.entries()) {
        const device = devices.find((d) => d.id === deviceId)
        if (!device) continue
        const objects: FabricObject[] = []
        const halfAngle = (data.hFov / 2) * (Math.PI / 180)
        const baseRotDeg = data.rotation || 0

        // Multi-sensor: render one cone set per imager angle; single sensor: one cone set
        const imagerAngles = data.sensorAngles && data.sensorAngles.length > 0
          ? data.sensorAngles.map(a => a + baseRotDeg)
          : [baseRotDeg]

        let outerR = 0
        for (const imagerDeg of imagerAngles) {
          const rotRad = imagerDeg * (Math.PI / 180)

          for (const tier of data.tiers) {
            const r = tier.distanceFt * (scalePxPerFt || 10)
            if (r > outerR) outerR = r
            const cx = device.position_x
            const cy = device.position_y
            const absStartX = cx + Math.cos(rotRad - halfAngle) * r
            const absStartY = cy + Math.sin(rotRad - halfAngle) * r
            const absEndX = cx + Math.cos(rotRad + halfAngle) * r
            const absEndY = cy + Math.sin(rotRad + halfAngle) * r
            const largeArc = data.hFov > 180 ? 1 : 0
            const pathStr = `M ${cx} ${cy} L ${absStartX} ${absStartY} A ${r} ${r} 0 ${largeArc} 1 ${absEndX} ${absEndY} Z`

            // Compute opacity — boost matching tier, dim others when highlighted
            let opacity = tier.opacity
            if (highlightedPpfTier) {
              opacity = tier.color === highlightedPpfTier ? Math.min(tier.opacity * 3, 0.5) : tier.opacity * 0.2
            }

            const path = new fabric.Path(pathStr, {
              fill: tier.color, opacity, selectable: false, evented: false,
            })
            canvas.add(path); canvas.sendObjectToBack(path); objects.push(path)

            // DORI mode: add tier label at arc midpoint along imager center line
            if (fovDisplayMode === 'dori' && r > 20) {
              const labelR = r * 0.92
              const lx = cx + Math.cos(rotRad) * labelR
              const ly = cy + Math.sin(rotRad) * labelR
              const label = TIER_LABELS[tier.color] || ''
              if (label) {
                const text = new fabric.FabricText(label, {
                  left: lx, top: ly, fontSize: 9, fontWeight: '700',
                  fill: tier.color, fontFamily: "'IBM Plex Mono', monospace",
                  originX: 'center', originY: 'center', selectable: false, evented: false,
                  opacity: highlightedPpfTier && tier.color !== highlightedPpfTier ? 0.2 : 0.9,
                })
                ;(text as unknown as Record<string, unknown>).__isDoriLabel = true
                canvas.add(text); objects.push(text)
              }
            }
          }
        }
        fovObjectMap.set(deviceId, objects)

        // Drag handle at outermost cone edge along primary imager direction
        const primaryRotRad = imagerAngles[0] * (Math.PI / 180)
        if (outerR > 0 && onFovHandleDragged) {
          const hx = device.position_x + Math.cos(primaryRotRad) * outerR
          const hy = device.position_y + Math.sin(primaryRotRad) * outerR
          const handle = new fabric.Circle({
            left: hx, top: hy, radius: 5, fill: 'rgba(59,130,246,0.9)', stroke: '#fff', strokeWidth: 1.5,
            originX: 'center', originY: 'center', selectable: true, evented: true,
            hasControls: false, hasBorders: false, hoverCursor: 'grab', moveCursor: 'grabbing',
          })
          ;(handle as unknown as Record<string, unknown>).__fovHandle = true
          ;(handle as unknown as Record<string, unknown>).__fovDeviceId = deviceId
          ;(handle as unknown as Record<string, unknown>).__fovDeviceCx = device.position_x
          ;(handle as unknown as Record<string, unknown>).__fovDeviceCy = device.position_y
          canvas.add(handle)
          fovHandleMap.current.set(deviceId, handle)
        }
      }
      canvas.renderAll()
    }
    void addFovCones()
  }, [fovData, devices, showFovCones, scalePxPerFt, fabricReady, onFovHandleDragged, fovDisplayMode, highlightedPpfTier])

  // ---- FOV Handle Drag → update target distance ----
  useEffect(() => {
    if (!fabricRef.current || !fabricReady || !onFovHandleDragged) return
    const canvas = fabricRef.current
    const handler = (e: { target?: FabricObject }) => {
      const obj = e.target; if (!obj) return
      const rec = obj as unknown as Record<string, unknown>
      if (!rec.__fovHandle) return
      const deviceId = rec.__fovDeviceId as string
      const cx = rec.__fovDeviceCx as number
      const cy = rec.__fovDeviceCy as number
      const dx = (obj.left ?? 0) - cx
      const dy = (obj.top ?? 0) - cy
      const distPx = Math.sqrt(dx * dx + dy * dy)
      const distFt = distPx / (scalePxPerFt || 10)
      if (distFt > 1) onFovHandleDragged(deviceId, Math.round(distFt))
    }
    canvas.on('object:modified', handler)
    return () => { canvas.off('object:modified', handler) }
  }, [fabricReady, onFovHandleDragged, scalePxPerFt])

  // ---- PPF at Cursor Tooltip ----
  useEffect(() => {
    if (!fabricRef.current || !fabricReady || !showFovCones) {
      setPpfTooltip(null)
      return
    }
    const canvas = fabricRef.current
    const handler = (opt: { e: Event }) => {
      const evt = opt.e as MouseEvent
      const point = canvas.getScenePoint(evt)
      const px = point.x, py = point.y

      // Check if cursor is inside any FOV cone (including multi-sensor imagers)
      for (const [deviceId, data] of fovData.entries()) {
        const device = devices.find((d) => d.id === deviceId)
        if (!device || !data.resolutionW || !data.sensorW || !data.focalLength) continue

        const dx = px - device.position_x
        const dy = py - device.position_y
        const distPx = Math.sqrt(dx * dx + dy * dy)
        if (distPx < 3) continue // too close to center

        const cursorAngle = Math.atan2(dy, dx) // radians
        const halfAngle = (data.hFov / 2) * (Math.PI / 180)
        const maxTierDist = Math.max(...data.tiers.map(t => t.distanceFt))
        const distFt = distPx / (scalePxPerFt || 10)
        if (distFt > maxTierDist) continue

        // Check all imager angles (multi-sensor has multiple, single sensor has one)
        const baseRotDeg = data.rotation || 0
        const imagerAngles = data.sensorAngles && data.sensorAngles.length > 0
          ? data.sensorAngles.map(a => a + baseRotDeg)
          : [baseRotDeg]

        let insideCone = false
        for (const imagerDeg of imagerAngles) {
          const rotRad = imagerDeg * (Math.PI / 180)
          let angleDiff = cursorAngle - rotRad
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI
          if (Math.abs(angleDiff) <= halfAngle) { insideCone = true; break }
        }
        if (!insideCone) continue

        // Cursor is inside this cone — compute PPF
        const ppf = calculatePpfAtDistance(data.resolutionW, data.sensorW, data.focalLength, distFt)
        const dori = classifyDori(ppf)
        const doriLabel: Record<DoriClassification, string> = { identification: 'Identification', recognition: 'Recognition', observation: 'Observation', detection: 'Detection', none: 'Monitor Only' }

        setPpfTooltip({
          visible: true,
          x: evt.clientX + 14,
          y: evt.clientY - 8,
          ppf: Math.round(ppf),
          dori: doriLabel[dori],
          distFt: Math.round(distFt * 10) / 10,
        })
        return
      }
      // Not inside any cone
      setPpfTooltip(null)
    }
    canvas.on('mouse:move', handler)
    return () => { canvas.off('mouse:move', handler); setPpfTooltip(null) }
  }, [fabricReady, showFovCones, fovData, devices, scalePxPerFt])

  // ---- Cable Rendering ----
  useEffect(() => {
    if (!fabricReady || !fabricRef.current) return
    const canvas = fabricRef.current
    cableObjectMap.forEach((obj) => canvas.remove(obj)); cableObjectMap.clear()
    canvas.getObjects().filter((o) => (o as unknown as Record<string, unknown>).__isCableLabel === true).forEach((o) => canvas.remove(o))

    async function addCables() {
      const fabric = await import('fabric')
      for (const cable of cables) {
        const wps = (cable.waypoints || []) as Array<{ x: number; y: number }>
        if (wps.length < 2) continue
        const points = wps.map((wp) => new fabric.Point(wp.x, wp.y))
        const polyline = new fabric.Polyline(points, {
          fill: 'transparent', stroke: cable.color_hex || C.accent,
          strokeWidth: 2, strokeDashArray: [6, 3], selectable: true, evented: true, opacity: 0.6,
        })
        ;(polyline as unknown as Record<string, unknown>).cableId = cable.id
        canvas.add(polyline); canvas.sendObjectToBack(polyline); cableObjectMap.set(cable.id, polyline)

        // Cable label (type + length) at midpoint
        if (wps.length >= 2) {
          const midIdx = Math.floor(wps.length / 2)
          const midPt = wps[midIdx]
          const cableType = (cable.cable_type || 'Cat6').toUpperCase()
          const lengthStr = cable.total_length_ft ? `${cable.total_length_ft}ft` : cable.length_ft ? `${cable.length_ft}ft` : ''
          const cableLabel = new fabric.FabricText(`${cableType}${lengthStr ? ' · ' + lengthStr : ''}`, {
            left: midPt.x, top: midPt.y - 10, fontSize: 8, fill: cable.color_hex || C.accent,
            fontFamily: "'IBM Plex Mono', monospace", fontWeight: '600',
            originX: 'center', selectable: false, evented: false, opacity: 0.7,
          })
          ;(cableLabel as unknown as Record<string, unknown>).__isCableLabel = true
          canvas.add(cableLabel)
        }
      }
      canvas.renderAll()
    }
    void addCables()
  }, [cables, fabricReady])

  // ---- Zone Rendering ----
  useEffect(() => {
    if (!fabricReady || !fabricRef.current) return
    const canvas = fabricRef.current
    zoneObjectMap.forEach((objs) => objs.forEach((o) => canvas.remove(o))); zoneObjectMap.clear()
    canvas.getObjects().filter((o) => (o as unknown as Record<string, unknown>).__isZoneLabel === true).forEach((o) => canvas.remove(o))

    async function addZones() {
      const fabric = await import('fabric')
      for (const zone of zones) {
        const objects: FabricObject[] = []
        const rect = new fabric.Rect({
          left: zone.x, top: zone.y, width: zone.width, height: zone.height,
          fill: `${zone.color}20`, stroke: zone.color, strokeWidth: 1.5,
          strokeDashArray: [6, 3], selectable: true, evented: true,
          hasControls: true, hasBorders: true,
          cornerColor: zone.color, cornerSize: 6, transparentCorners: false,
          lockRotation: true,
        })
        ;(rect as unknown as Record<string, unknown>).zoneId = zone.id
        canvas.add(rect); canvas.sendObjectToBack(rect); objects.push(rect)

        const label = new fabric.FabricText(zone.name, {
          left: zone.x + 4, top: zone.y + 2, fontSize: 10, fill: zone.color,
          fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: '600',
          selectable: false, evented: false, opacity: 0.8,
        })
        ;(label as unknown as Record<string, unknown>).__isZoneLabel = true
        canvas.add(label); objects.push(label)

        zoneObjectMap.set(zone.id, objects)
      }
      canvas.renderAll()
    }
    void addZones()
  }, [zones, fabricReady])

  // ---- Zone Draw (click-drag) ----
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    if (activeTool !== 'zone' || !zoneDraw.isDrawing) {
      if (zonePreviewRef.current && fabricRef.current) {
        fabricRef.current.remove(zonePreviewRef.current); zonePreviewRef.current = null; fabricRef.current.renderAll()
      }
      return
    }
    const canvas = fabricRef.current
    const moveHandler = (opt: { e: Event }) => {
      const evt = opt.e as MouseEvent
      const point = canvas.getScenePoint(evt)
      const rx = Math.min(zoneDraw.startX, point.x)
      const ry = Math.min(zoneDraw.startY, point.y)
      const rw = Math.abs(point.x - zoneDraw.startX)
      const rh = Math.abs(point.y - zoneDraw.startY)
      if (zonePreviewRef.current) canvas.remove(zonePreviewRef.current)
      import('fabric').then((fm) => {
        if (!fabricRef.current) return
        const rect = new fm.Rect({
          left: rx, top: ry, width: rw, height: rh,
          fill: 'rgba(59,130,246,0.15)', stroke: C.accent, strokeWidth: 1.5,
          strokeDashArray: [4, 2], selectable: false, evented: false,
        })
        zonePreviewRef.current = rect
        fabricRef.current.add(rect); fabricRef.current.renderAll()
      })
    }
    const upHandler = (opt: { e: Event }) => {
      const evt = opt.e as MouseEvent
      const point = canvas.getScenePoint(evt)
      const rx = Math.min(zoneDraw.startX, point.x)
      const ry = Math.min(zoneDraw.startY, point.y)
      const rw = Math.abs(point.x - zoneDraw.startX)
      const rh = Math.abs(point.y - zoneDraw.startY)
      if (zonePreviewRef.current && fabricRef.current) { fabricRef.current.remove(zonePreviewRef.current); zonePreviewRef.current = null }
      setZoneDraw({ isDrawing: false, startX: 0, startY: 0 })
      if (rw > 10 && rh > 10) {
        onZoneCreated?.({ name: `Zone ${zones.length + 1}`, color: '#3B82F6', x: Math.round(rx), y: Math.round(ry), width: Math.round(rw), height: Math.round(rh) })
      }
      canvas.renderAll()
    }
    canvas.on('mouse:move', moveHandler)
    canvas.on('mouse:up', upHandler)
    return () => {
      canvas.off('mouse:move', moveHandler); canvas.off('mouse:up', upHandler)
      if (zonePreviewRef.current && fabricRef.current) { fabricRef.current.remove(zonePreviewRef.current); zonePreviewRef.current = null }
    }
  }, [activeTool, zoneDraw, fabricReady, onZoneCreated, zones.length])

  // ---- Zone Selection ----
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    const handler = (e: { selected?: FabricObject[] }) => {
      const zid = (e.selected?.[0] as unknown as Record<string, unknown>)?.zoneId as string
      if (zid) onSelectZone?.(zid)
    }
    canvas.on('selection:created', handler)
    canvas.on('selection:updated', handler)
    return () => { canvas.off('selection:created', handler); canvas.off('selection:updated', handler) }
  }, [fabricReady, onSelectZone])

  // ---- Zone Move / Resize ----
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    const handler = (e: { target?: FabricObject }) => {
      const obj = e.target; if (!obj) return
      const zid = (obj as unknown as Record<string, unknown>).zoneId as string; if (!zid) return
      const newW = Math.round((obj.width ?? 0) * (obj.scaleX ?? 1))
      const newH = Math.round((obj.height ?? 0) * (obj.scaleY ?? 1))
      obj.set({ scaleX: 1, scaleY: 1, width: newW, height: newH })
      if (obj.left !== undefined && obj.top !== undefined) onZoneMoved?.(zid, Math.round(obj.left), Math.round(obj.top))
      onZoneResized?.(zid, newW, newH)
    }
    canvas.on('object:modified', handler)
    return () => { canvas.off('object:modified', handler) }
  }, [fabricReady, onZoneMoved, onZoneResized])

  // ---- Reset zone draw when tool changes ----
  useEffect(() => {
    if (activeTool !== 'zone') setZoneDraw({ isDrawing: false, startX: 0, startY: 0 })
  }, [activeTool])

  // ---- MDF/IDF Node Rendering ----
  useEffect(() => {
    if (!fabricReady || !fabricRef.current) return
    const canvas = fabricRef.current
    mdfIdfObjectMap.current.forEach((objs) => objs.forEach((o) => canvas.remove(o)))
    mdfIdfObjectMap.current.clear()

    async function addMdfIdfs() {
      const fabric = await import('fabric')
      for (const node of mdfIdfs) {
        const objects: FabricObject[] = []
        // Diamond shape for network closet
        const size = 18
        const cx = node.position_x, cy = node.position_y
        const diamond = new fabric.Polygon([
          { x: cx, y: cy - size },
          { x: cx + size, y: cy },
          { x: cx, y: cy + size },
          { x: cx - size, y: cy },
        ], {
          fill: `${node.color_hex || '#f97316'}30`,
          stroke: node.color_hex || '#f97316',
          strokeWidth: 2,
          selectable: true, evented: true,
          hasControls: false, hasBorders: true,
          originX: 'center', originY: 'center',
          left: cx, top: cy,
        })
        ;(diamond as unknown as Record<string, unknown>).__mdfIdfId = node.id
        canvas.add(diamond); objects.push(diamond)

        // Label
        const label = new fabric.FabricText(node.name || 'MDF', {
          left: cx, top: cy + size + 6, fontSize: 9, fontWeight: '700',
          fill: node.color_hex || '#f97316',
          fontFamily: "'IBM Plex Mono', monospace",
          originX: 'center', originY: 'top',
          selectable: false, evented: false,
        })
        ;(label as unknown as Record<string, unknown>).__isMdfIdfLabel = true
        canvas.add(label); objects.push(label)

        // Distance lines to each device
        for (const device of devices) {
          const dx = device.position_x - cx
          const dy = device.position_y - cy
          const distPx = Math.sqrt(dx * dx + dy * dy)
          const distFt = scalePxPerFt > 0 ? distPx / scalePxPerFt : 0
          // Only render distance line if within reasonable range (< 200ft)
          if (distFt > 0 && distFt < 200) {
            const line = new fabric.Line([cx, cy, device.position_x, device.position_y], {
              stroke: node.color_hex || '#f97316', strokeWidth: 0.5,
              strokeDashArray: [2, 4], selectable: false, evented: false, opacity: 0.25,
            })
            ;(line as unknown as Record<string, unknown>).__isMdfIdfLabel = true
            canvas.add(line); canvas.sendObjectToBack(line); objects.push(line)

            // Distance label at midpoint
            const mx = (cx + device.position_x) / 2
            const my = (cy + device.position_y) / 2
            const distLabel = new fabric.FabricText(`${Math.round(distFt)}ft`, {
              left: mx, top: my - 6, fontSize: 7,
              fill: node.color_hex || '#f97316',
              fontFamily: "'IBM Plex Mono', monospace",
              originX: 'center', selectable: false, evented: false, opacity: 0.5,
            })
            ;(distLabel as unknown as Record<string, unknown>).__isMdfIdfLabel = true
            canvas.add(distLabel); objects.push(distLabel)
          }
        }

        mdfIdfObjectMap.current.set(node.id, objects)
      }
      canvas.renderAll()
    }
    void addMdfIdfs()
  }, [mdfIdfs, devices, fabricReady, scalePxPerFt])

  // ---- MDF/IDF Node Move ----
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    const handler = (e: { target?: FabricObject }) => {
      const obj = e.target; if (!obj) return
      const nodeId = (obj as unknown as Record<string, unknown>).__mdfIdfId as string
      if (!nodeId) return
      const x = Math.round(obj.left ?? 0)
      const y = Math.round(obj.top ?? 0)
      onMdfIdfMoved?.(nodeId, x, y)
    }
    canvas.on('object:modified', handler)
    return () => { canvas.off('object:modified', handler) }
  }, [fabricReady, onMdfIdfMoved])

  // Selected zone highlight
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    if (selectedZoneId) {
      const objs = zoneObjectMap.get(selectedZoneId)
      const rect = objs?.[0]
      if (rect) { fabricRef.current.setActiveObject(rect); fabricRef.current.renderAll() }
    }
  }, [selectedZoneId, fabricReady])

  // Selected device highlight
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    if (selectedDeviceId) {
      const obj = deviceObjectMap.get(selectedDeviceId)
      if (obj) { fabricRef.current.setActiveObject(obj); fabricRef.current.renderAll() }
    }
  }, [selectedDeviceId, fabricReady])

  // Floor plan background
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    if (!floorPlan?.file_url) { canvas.backgroundImage = undefined; canvas.requestRenderAll(); return }

    let currentUrl = floorPlan.file_url
    const ext = currentUrl.split('.').pop()?.split('?')[0]?.toLowerCase() ?? ''
    const opacity = floorPlanOpacity ?? floorPlan.opacity ?? 0.5

    // Signed URL refresh: if initial fetch fails 400/403, get fresh URL from API
    async function refreshUrl(): Promise<string | null> {
      try {
        const res = await fetch(`/api/org/designs/${designId}/floor-plans`)
        if (!res.ok) return null
        const json = await res.json()
        const plans = (json.floorPlans ?? []) as Array<{ id: string; file_url?: string }>
        const match = plans.find((p) => p.id === floorPlan?.id)
        return match?.file_url ?? null
      } catch { return null }
    }

    async function loadFloorPlanSVG() {
      try {
        let response = await fetch(currentUrl, { mode: 'cors' })
        if ((response.status === 400 || response.status === 403) && floorPlan?.id) {
          const freshUrl = await refreshUrl()
          if (freshUrl) { currentUrl = freshUrl; response = await fetch(currentUrl, { mode: 'cors' }) }
        }
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)
        const svgText = await response.text()
        const fm = await import('fabric')
        const result = await fm.loadSVGFromString(svgText)
        const objs = result.objects.filter(Boolean) as FabricObject[]
        if (objs.length === 0) throw new Error('SVG parse returned no objects')
        const group = fm.util.groupSVGElements(objs, result.options)
        group.set({ opacity, selectable: false, evented: false, originX: 'left', originY: 'top' })
        // Auto-size to fit canvas viewport
        const cw = canvas.width ?? 800, ch = canvas.height ?? 600
        const gw = (group.width ?? cw) * (group.scaleX ?? 1), gh = (group.height ?? ch) * (group.scaleY ?? 1)
        if (gw > 0 && gh > 0) {
          const s = Math.min((cw * 0.9) / gw, (ch * 0.9) / gh, 1)
          group.set({ scaleX: s, scaleY: s })
        }
        canvas.backgroundImage = group as unknown as import('fabric').FabricImage
        canvas.requestRenderAll()
      } catch (err) {
        console.error('SVG floor plan load failed:', err)
        // Fallback: try as regular image (browser can render simple SVGs via <img>)
        await loadFloorPlanImage()
      }
    }

    async function loadFloorPlanPDF() {
      try {
        // Check signed URL freshness first
        const testRes = await fetch(currentUrl, { method: 'HEAD', mode: 'cors' }).catch(() => null)
        if (testRes && (testRes.status === 400 || testRes.status === 403) && floorPlan?.id) {
          const freshUrl = await refreshUrl()
          if (freshUrl) currentUrl = freshUrl
        }
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
        const loadingTask = pdfjsLib.getDocument({ url: currentUrl, disableAutoFetch: true, disableStream: true })
        const pdf = await loadingTask.promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 2 })
        const offscreen = document.createElement('canvas')
        offscreen.width = viewport.width
        offscreen.height = viewport.height
        const ctx = offscreen.getContext('2d')
        if (!ctx) throw new Error('No 2d context')
        await page.render({ canvasContext: ctx, viewport }).promise
        const dataUrl = offscreen.toDataURL('image/png')
        const fm = await import('fabric')
        const img = await fm.FabricImage.fromURL(dataUrl)
        img.set({ opacity, selectable: false, evented: false })
        const cw = canvas.width ?? 800, ch = canvas.height ?? 600
        const iw = (img.width ?? cw) * (img.scaleX ?? 1), ih = (img.height ?? ch) * (img.scaleY ?? 1)
        if (iw > 0 && ih > 0) { const s = Math.min((cw * 0.9) / iw, (ch * 0.9) / ih, 1); img.set({ scaleX: s, scaleY: s }) }
        canvas.backgroundImage = img
        canvas.requestRenderAll()
        pdf.destroy()
      } catch (err) {
        console.error('PDF floor plan load failed:', err)
        onFloorPlanError?.('Failed to render PDF. Try uploading as PNG or JPG instead.')
      }
    }

    async function loadFloorPlanImage() {
      try {
        const fm = await import('fabric')
        let img: import('fabric').FabricImage
        try {
          img = await fm.FabricImage.fromURL(currentUrl, { crossOrigin: 'anonymous' })
        } catch {
          // CORS failed — try refreshing signed URL first
          if (floorPlan?.id) {
            const freshUrl = await refreshUrl()
            if (freshUrl) currentUrl = freshUrl
          }
          try {
            img = await fm.FabricImage.fromURL(currentUrl, { crossOrigin: 'anonymous' })
          } catch {
            img = await fm.FabricImage.fromURL(currentUrl)
          }
        }
        img.set({ opacity, selectable: false, evented: false })
        const cw = canvas.width ?? 800, ch = canvas.height ?? 600
        const iw = (img.width ?? cw) * (img.scaleX ?? 1), ih = (img.height ?? ch) * (img.scaleY ?? 1)
        if (iw > 0 && ih > 0) { const s = Math.min((cw * 0.9) / iw, (ch * 0.9) / ih, 1); img.set({ scaleX: s, scaleY: s }) }
        canvas.backgroundImage = img
        canvas.requestRenderAll()
      } catch (err) {
        console.error('Image floor plan load failed:', err)
        onFloorPlanError?.('Failed to load floor plan image. Check the file and try again.')
      }
    }

    if (ext === 'svg') { void loadFloorPlanSVG() }
    else if (ext === 'pdf') { void loadFloorPlanPDF() }
    else { void loadFloorPlanImage() }
  }, [floorPlan, fabricReady, onFloorPlanError, designId, floorPlanOpacity])

  // Satellite tile background — when area has lat/lng and no floor plan
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    // Only load satellite if there's no floor plan and we have coordinates
    if (floorPlan?.file_url || !satelliteConfig?.lat || !satelliteConfig?.lng) return

    const { lat, lng, zoom } = satelliteConfig
    const satOpacity = satelliteConfig.opacity ?? 0.6
    const cw = canvas.width ?? 1280
    const ch = canvas.height ?? 1280
    // Request tile sized to canvas (clamped to 640 for Static Maps free tier, scale=2 gives 1280)
    const tileW = Math.min(640, cw)
    const tileH = Math.min(640, ch)

    async function loadSatellite() {
      try {
        const params = new URLSearchParams({
          lat: String(lat), lng: String(lng),
          zoom: String(zoom), width: String(tileW), height: String(tileH),
        })
        const res = await fetch(`/api/org/satellite-tile?${params.toString()}`)
        if (!res.ok) throw new Error(`Satellite tile error (${res.status})`)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const fm = await import('fabric')
        const img = await fm.FabricImage.fromURL(url)
        img.set({ opacity: satOpacity, selectable: false, evented: false, originX: 'left', originY: 'top' })
        // Scale to fill canvas viewport
        const iw = (img.width ?? cw) * (img.scaleX ?? 1)
        const ih = (img.height ?? ch) * (img.scaleY ?? 1)
        if (iw > 0 && ih > 0) {
          const s = Math.min((cw * 0.95) / iw, (ch * 0.95) / ih, 1)
          img.set({ scaleX: s, scaleY: s })
        }
        canvas.backgroundImage = img as unknown as import('fabric').FabricImage
        canvas.requestRenderAll()
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Satellite tile load failed:', err)
      }
    }

    void loadSatellite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satelliteConfig?.lat, satelliteConfig?.lng, satelliteConfig?.zoom, floorPlan, fabricReady])

  // Satellite opacity — update existing background image without refetch
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    const bg = canvas.backgroundImage
    if (bg && satelliteConfig?.opacity !== undefined) {
      bg.set({ opacity: satelliteConfig.opacity })
      canvas.requestRenderAll()
    }
  }, [satelliteConfig?.opacity, fabricReady])

  // Grid (single pattern rect — replaces per-dot rendering for performance)
  const drawGrid = useCallback(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    canvas.getObjects().filter((o) => (o as unknown as Record<string, unknown>).__isGrid === true).forEach((o) => canvas.remove(o))
    if (!showGrid) { canvas.requestRenderAll(); return }
    import('fabric').then((fm) => {
      const tile = document.createElement('canvas')
      tile.width = GRID_SIZE; tile.height = GRID_SIZE
      const ctx = tile.getContext('2d')
      if (ctx) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.arc(GRID_SIZE / 2, GRID_SIZE / 2, 1, 0, Math.PI * 2); ctx.fill() }
      const pattern = new fm.Pattern({ source: tile, repeat: 'repeat' })
      const gridRect = new fm.Rect({ left: -10000, top: -10000, width: 20000, height: 20000, fill: pattern as unknown as string, selectable: false, evented: false })
      ;(gridRect as unknown as Record<string, unknown>).__isGrid = true
      canvas.add(gridRect); canvas.sendObjectToBack(gridRect)
      canvas.requestRenderAll()
    })
  }, [showGrid, fabricReady])
  useEffect(() => { drawGrid() }, [drawGrid])

  // ---- Minimap data ----
  const CATEGORY_DOT_COLOR: Record<string, string> = {
    cctv: C.accent, dome: C.accent, bullet: C.accent, turret: C.accent, ptz: C.accent,
    fisheye: C.accent, multisensor_quad: C.accent, multisensor_dual: C.accent,
    access_control: C.green, door: C.green, door_controller: C.green, card_reader: C.green,
    network: '#a78bfa', switch: '#a78bfa', nvr: '#a78bfa', router: '#a78bfa', server: '#a78bfa',
    av: C.yellow, speaker: C.yellow, other: C.textMuted,
  }
  const minimapDevices: MinimapDevice[] = devices.map(d => ({
    id: d.id, x: d.position_x, y: d.position_y,
    color: CATEGORY_DOT_COLOR[d.category] ?? C.textDim,
  }))
  const minimapZones: MinimapZone[] = (zones ?? []).map(z => ({
    id: z.id, x: z.x, y: z.y, w: z.width, h: z.height, color: z.color,
  }))
  const minimapInfra: MinimapInfra[] = (mdfIdfs ?? []).map(n => ({
    id: n.id, x: n.position_x, y: n.position_y,
  }))
  const minimapBounds = (() => {
    const all = [...devices.map(d => ({ x: d.position_x, y: d.position_y })), ...(mdfIdfs ?? []).map(n => ({ x: n.position_x, y: n.position_y }))]
    for (const z of (zones ?? [])) { all.push({ x: z.x, y: z.y }, { x: z.x + z.width, y: z.y + z.height }) }
    if (all.length === 0) return { minX: 0, minY: 0, maxX: 4000, maxY: 3000 }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of all) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }
    const pad = 200
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
  })()
  const handleMinimapNavigate = useCallback((worldX: number, worldY: number) => {
    const fc = fabricRef.current
    if (!fc) return
    const z = fc.getZoom()
    const w = fc.getWidth()
    const h = fc.getHeight()
    const vpt = fc.viewportTransform
    if (!vpt) return
    vpt[4] = -(worldX * z) + w / 2
    vpt[5] = -(worldY * z) + h / 2
    fc.setViewportTransform(vpt)
    fc.requestRenderAll()
  }, [])

  // ---- Tool items for floating toolbar ----
  const toolItems: ({ icon: React.JSX.Element; label: string; id: string } | null)[] = [
    { icon: ToolbarIcons.select, label: 'Select', id: 'select' },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v6M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 16" /></svg>, label: 'Pan', id: 'pan' },
    { icon: ToolbarIcons.measure, label: 'Measure', id: 'measure' },
    { icon: ToolbarIcons.cable, label: 'Cable', id: 'cable' },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" /></svg>, label: 'Zone', id: 'zone' },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /><line x1="6" y1="6" x2="6" y2="18" /><line x1="18" y1="6" x2="18" y2="18" /><line x1="10" y1="10" x2="14" y2="10" /><line x1="10" y1="14" x2="14" y2="14" /></svg>, label: 'MDF/IDF', id: 'mdf_idf' },
    null,
    { icon: ToolbarIcons.zoomIn, label: 'Zoom In', id: 'zoomIn' },
    { icon: ToolbarIcons.zoomOut, label: 'Zoom Out', id: 'zoomOut' },
    { icon: ToolbarIcons.fitView, label: 'Fit', id: 'fitView' },
  ]

  const handleToolbarClick = useCallback((toolId: string) => {
    if (toolId === 'zoomIn') { if (fabricRef.current) { const z = Math.min(ZOOM_MAX, zoomLevel * 1.2); fabricRef.current.setZoom(z); setZoomLevel(z) } return }
    if (toolId === 'zoomOut') { if (fabricRef.current) { const z = Math.max(ZOOM_MIN, zoomLevel / 1.2); fabricRef.current.setZoom(z); setZoomLevel(z) } return }
    if (toolId === 'fitView') {
      const canvas = fabricRef.current
      if (canvas) {
        const objs = canvas.getObjects().filter((o) => !(o as unknown as Record<string, unknown>).__isGrid)
        if (objs.length === 0) { canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); setZoomLevel(1) }
        else {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          for (const obj of objs) {
            const l = obj.left ?? 0, t = obj.top ?? 0
            const w = (obj.width ?? 0) * (obj.scaleX ?? 1), h = (obj.height ?? 0) * (obj.scaleY ?? 1)
            minX = Math.min(minX, l - w / 2); minY = Math.min(minY, t - h / 2)
            maxX = Math.max(maxX, l + w / 2); maxY = Math.max(maxY, t + h / 2)
          }
          const pad = 60, bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2
          const cw = canvas.width ?? 800, ch = canvas.height ?? 600
          const z = Math.max(ZOOM_MIN, Math.min(cw / bw, ch / bh, ZOOM_MAX))
          const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
          canvas.setViewportTransform([z, 0, 0, z, cw / 2 - cx * z, ch / 2 - cy * z])
          setZoomLevel(z)
        }
        canvas.requestRenderAll()
      }
      return
    }
    onToolChange?.(toolId as CanvasTool)
    if (toolId === 'pan' && fabricRef.current) { fabricRef.current.selection = false }
    if (toolId !== 'pan' && fabricRef.current) { fabricRef.current.selection = true }
    if (toolId === 'cable') setCableDraw({ phase: 'pick_source', sourceDeviceId: null, waypoints: [] })
    if (toolId !== 'cable') setCableDraw({ phase: 'idle', sourceDeviceId: null, waypoints: [] })
    if (toolId !== 'measure') {
      setMeasureState({ points: [] })
      if (fabricRef.current) {
        for (const obj of measureObjectsRef.current) fabricRef.current.remove(obj)
        measureObjectsRef.current = []
        fabricRef.current.renderAll()
      }
    }
  }, [zoomLevel, onToolChange])

  // ---- Minimap data ----
  return (
    <div ref={containerRef}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      onDrop={(e) => {
        e.preventDefault()
        const data = e.dataTransfer.getData('application/panteray-device')
        if (!data || !fabricRef.current) return
        const point = fabricRef.current.getScenePoint(e.nativeEvent as unknown as MouseEvent)
        onDeviceDrop?.(Math.round(point.x), Math.round(point.y), data)
      }}
      style={{ flex: 1, position: 'relative', overflow: 'hidden', background: C.bg }}>
      <canvas ref={canvasRef} />

      {/* Placement hint */}
      {activeTool === 'place' && pendingDeviceName && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: C.bgPanel, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '4px 12px', fontSize: 11, color: C.accent, zIndex: 20, whiteSpace: 'nowrap' }}>
          Click to place <span style={{ fontWeight: 600 }}>{pendingDeviceName}</span>
        </div>
      )}
      {activeTool === 'place' && !pendingDeviceName && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: C.bgPanel, border: `1px solid ${C.textDim}`, borderRadius: 6, padding: '4px 12px', fontSize: 11, color: C.textDim, zIndex: 20 }}>
          Search and select a device from the left panel first
        </div>
      )}

      {/* Cable draw status */}
      {activeTool === 'cable' && cableDraw.phase !== 'idle' && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: C.bgPanel, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '4px 12px', fontSize: 11, color: C.accent, zIndex: 20 }}>
          {cableDraw.phase === 'pick_source' && 'Click a device to start cable'}
          {cableDraw.phase === 'routing' && 'Routing — click waypoints or click destination device (ESC cancel)'}
        </div>
      )}

      {/* Measure hint */}
      {activeTool === 'measure' && measureState.points.length === 1 && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: C.bgPanel, border: `1px solid ${C.green}`, borderRadius: 6, padding: '4px 12px', fontSize: 11, color: C.green, zIndex: 20 }}>
          Click second point to measure distance
        </div>
      )}

      {/* Zone draw hint */}
      {activeTool === 'zone' && !zoneDraw.isDrawing && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: C.bgPanel, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '4px 12px', fontSize: 11, color: C.accent, zIndex: 20 }}>
          Click and drag to draw a zone
        </div>
      )}

      {/* MDF/IDF placement hint */}
      {activeTool === 'mdf_idf' && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: C.bgPanel, border: `1px solid ${C.orange}`, borderRadius: 6, padding: '4px 12px', fontSize: 11, color: C.orange, zIndex: 20 }}>
          Click to place MDF/IDF closet
        </div>
      )}

      {/* Pan mode hint */}
      {activeTool === 'pan' && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: C.bgPanel, border: `1px solid ${C.green}`, borderRadius: 6, padding: '4px 12px', fontSize: 11, color: C.green, zIndex: 20 }}>
          Click and drag to pan — scroll to zoom
        </div>
      )}

      {/* Scale calibration hint */}
      {activeTool === 'scale' && !scaleInput.visible && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: C.bgPanel, border: `1px solid ${C.red}`, borderRadius: 6, padding: '4px 12px', fontSize: 11, color: C.red, zIndex: 20 }}>
          {scaleCal.points.length === 0 ? 'Click first point of known distance' : 'Click second point'}
        </div>
      )}

      {/* Scale input overlay */}
      {scaleInput.visible && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: C.bgPanel, border: `1px solid ${C.red}`, borderRadius: 8, padding: '16px 20px', zIndex: 30, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
          <div style={{ fontSize: 12, color: C.text, fontFamily: 'IBM Plex Sans, sans-serif' }}>Enter real-world distance (ft)</div>
          <input autoFocus type="number" min="0.1" step="0.1" placeholder="e.g. 10"
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '6px 10px', fontSize: 13, color: C.text, outline: 'none', fontFamily: "'IBM Plex Mono'" }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const ft = parseFloat((e.target as HTMLInputElement).value)
                if (ft > 0) onScaleCalibrated?.(scaleInput.distPx / ft)
                // Clear scale visuals
                if (fabricRef.current) {
                  for (const obj of scaleObjectsRef.current) fabricRef.current.remove(obj)
                  scaleObjectsRef.current = []
                  fabricRef.current.renderAll()
                }
                setScaleInput({ visible: false, distPx: 0 })
              }
              if (e.key === 'Escape') {
                if (fabricRef.current) {
                  for (const obj of scaleObjectsRef.current) fabricRef.current.remove(obj)
                  scaleObjectsRef.current = []
                  fabricRef.current.renderAll()
                }
                setScaleInput({ visible: false, distPx: 0 })
              }
            }}
          />
          <div style={{ fontSize: 10, color: C.textDim }}>Press Enter to confirm, Escape to cancel</div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu.visible && contextMenu.deviceId && (
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 0', minWidth: 140, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          {[
            { label: 'Rotate 90°', action: () => {
              const obj = deviceObjectMap.get(contextMenu.deviceId!)
              if (obj && fabricRef.current) {
                const newAngle = ((obj.angle ?? 0) + 90) % 360
                obj.set({ angle: newAngle }); fabricRef.current.renderAll()
                onDeviceRotated?.(contextMenu.deviceId!, newAngle)
              }
            }},
            { label: 'Bring to Front', action: () => {
              const obj = deviceObjectMap.get(contextMenu.deviceId!)
              if (obj && fabricRef.current) { fabricRef.current.bringObjectToFront(obj); fabricRef.current.renderAll() }
            }},
            { label: 'Send to Back', action: () => {
              const obj = deviceObjectMap.get(contextMenu.deviceId!)
              if (obj && fabricRef.current) { fabricRef.current.sendObjectToBack(obj); fabricRef.current.renderAll() }
            }},
            null,
            { label: 'Duplicate', action: () => onDeviceCopy?.(contextMenu.deviceId!) },
            { label: 'Delete', action: () => onDeviceDelete?.(contextMenu.deviceId!) },
          ].map((item, i) =>
            item === null ? (
              <div key={`sep-${i}`} style={{ height: 1, background: C.border, margin: '3px 8px' }} />
            ) : (
            <div key={item.label} onClick={() => { item.action(); setContextMenu({ visible: false, x: 0, y: 0, deviceId: null }) }}
              style={{ padding: '6px 14px', fontSize: 12, color: item.label === 'Delete' ? C.red : C.text, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              {item.label}
            </div>
            )
          )}
        </div>
      )}

      {/* PPF at Cursor Tooltip */}
      {ppfTooltip?.visible && (
        <div style={{
          position: 'fixed', left: ppfTooltip.x, top: ppfTooltip.y,
          background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6,
          padding: '5px 10px', zIndex: 1001, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, whiteSpace: 'nowrap' }}>
            <span style={{ fontWeight: 700, color: ppfTooltip.ppf >= 76 ? C.green : ppfTooltip.ppf >= 38 ? C.yellow : ppfTooltip.ppf >= 8 ? C.orange : C.red }}>
              {ppfTooltip.ppf} PPF
            </span>
            <span style={{ color: C.textMuted, fontSize: 9 }}>{ppfTooltip.dori}</span>
            <span style={{ color: C.textDim, fontSize: 9 }}>{ppfTooltip.distFt} ft</span>
          </div>
        </div>
      )}

      {/* Floating Toolbar (right side) */}
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 2, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.4)', zIndex: 10 }}>
        {toolItems.map((item, i) =>
          item === null ? (
            <div key={`sep-${i}`} style={{ height: 1, background: C.border, margin: '2px 4px' }} />
          ) : (
            <button key={item.id} title={item.label} onClick={() => handleToolbarClick(item.id)}
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: activeTool === item.id ? C.accentSubtle : 'transparent',
                border: activeTool === item.id ? '1px solid rgba(59,130,246,0.3)' : 'none',
                borderRadius: 6, color: activeTool === item.id ? C.accent : C.textMuted, cursor: 'pointer', transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { if (activeTool !== item.id) { e.currentTarget.style.background = C.bgHover; e.currentTarget.style.color = C.text } }}
              onMouseLeave={(e) => { if (activeTool !== item.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted } }}>
              {item.icon}
            </button>
          )
        )}
      </div>

      {/* Minimap */}
      {showMinimap && (
        <Minimap
          devices={minimapDevices}
          zones={minimapZones}
          infra={minimapInfra}
          viewport={vpState}
          bounds={minimapBounds}
          onNavigate={handleMinimapNavigate}
        />
      )}

      {/* Bottom bar: PPF/DORI Legend + Scale */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: 'linear-gradient(transparent, rgba(15,17,23,0.95))', zIndex: 10 }}>
        <div style={{ fontSize: 10, color: C.textDim, fontFamily: "'IBM Plex Mono'" }}>{Math.round(zoomLevel * 100)}%</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, fontFamily: "'IBM Plex Mono'" }}>
          {[
            { color: C.green, ppfLabel: '100+', doriLabel: 'ID' },
            { color: C.yellow, ppfLabel: '50-99', doriLabel: 'REC' },
            { color: C.orange, ppfLabel: '10-49', doriLabel: 'OBS' },
            { color: C.red, ppfLabel: '<10', doriLabel: 'DET' },
          ].map((tier) => {
            const isActive = highlightedPpfTier === tier.color
            return (
              <div key={tier.color}
                onClick={() => onPpfTierClick?.(isActive ? null : tier.color)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3, cursor: showFovCones ? 'pointer' : 'default',
                  padding: '2px 4px', borderRadius: 3,
                  background: isActive ? `${tier.color}25` : 'transparent',
                  border: isActive ? `1px solid ${tier.color}50` : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (showFovCones && !isActive) e.currentTarget.style.background = `${tier.color}15` }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: tier.color, opacity: isActive ? 1 : 0.7 }} />
                <span style={{ color: isActive ? tier.color : C.textDim }}>
                  {fovDisplayMode === 'dori' ? tier.doriLabel : tier.ppfLabel}
                </span>
              </div>
            )
          })}
          <span style={{ color: C.textMuted, marginLeft: 2 }}>{fovDisplayMode === 'dori' ? 'DORI' : 'PPF'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: C.textDim, fontFamily: "'IBM Plex Mono'" }}>
          <div style={{ width: 60, height: 2, background: C.textDim, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: -3, width: 1, height: 8, background: C.textDim }} />
            <div style={{ position: 'absolute', right: 0, top: -3, width: 1, height: 8, background: C.textDim }} />
          </div>
          <span>{scalePxPerFt > 0 ? `1\u2033 = ${(96 / scalePxPerFt).toFixed(1)} ft` : 'No scale'}</span>
        </div>
      </div>

      {areaId && (
        <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, color: C.textDim, fontFamily: 'monospace' }}>
          {designId.slice(0, 8)} / {areaId.slice(0, 8)}
        </div>
      )}
    </div>
  )
}
