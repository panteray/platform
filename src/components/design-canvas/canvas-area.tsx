'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { C, GRID_SIZE, ZOOM_MIN, ZOOM_MAX, type CanvasTool } from './constants'
import { DEVICE_SVG_STRINGS, CATEGORY_TO_ICON, ToolbarIcons } from './icons'
import type { DesignDevice, DesignCable, DesignFloorPlan, DesignZone } from '@/types/database'

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
}: CanvasAreaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [fabricReady, setFabricReady] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
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
  }, [activeTool, fabricReady, cableDraw, devices, scalePxPerFt, onCanvasClick, onCableCreated, onScaleCalibrated])

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

  // ---- Sync devices ----
  useEffect(() => {
    if (!fabricReady || !fabricRef.current) return
    const canvas = fabricRef.current
    deviceObjectMap.forEach((obj) => canvas.remove(obj)); deviceObjectMap.clear()
    canvas.getObjects().filter((o) => (o as unknown as Record<string, unknown>).__isLabel === true).forEach((o) => canvas.remove(o))

    async function addDevices() {
      const fabric = await import('fabric')
      for (const device of devices) {
        if (hiddenCategories?.has(device.category)) continue
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
          const labelText = new fabric.FabricText(device.label, { left: device.position_x, top: device.position_y + 22, fontSize: 10, fill: C.textMuted, fontFamily: 'IBM Plex Sans, sans-serif', originX: 'center', originY: 'top', selectable: false, evented: false })
          ;(labelText as unknown as Record<string, unknown>).__isLabel = true
          canvas.add(labelText)
        } catch { /* skip */ }
      }
      canvas.renderAll()
    }
    void addDevices()
  }, [devices, fabricReady, hiddenCategories])

  // ---- FOV Cone Rendering ----
  useEffect(() => {
    if (!fabricReady || !fabricRef.current) return
    const canvas = fabricRef.current
    fovObjectMap.forEach((objs) => objs.forEach((o) => canvas.remove(o))); fovObjectMap.clear()
    if (!showFovCones) { canvas.renderAll(); return }

    async function addFovCones() {
      const fabric = await import('fabric')
      for (const [deviceId, data] of fovData.entries()) {
        const device = devices.find((d) => d.id === deviceId)
        if (!device) continue
        const objects: FabricObject[] = []
        const halfAngle = (data.hFov / 2) * (Math.PI / 180)
        const rotRad = (data.rotation || 0) * (Math.PI / 180)

        for (const tier of data.tiers) {
          const r = tier.distanceFt * (scalePxPerFt || 10)
          const cx = device.position_x
          const cy = device.position_y
          const absStartX = cx + Math.cos(rotRad - halfAngle) * r
          const absStartY = cy + Math.sin(rotRad - halfAngle) * r
          const absEndX = cx + Math.cos(rotRad + halfAngle) * r
          const absEndY = cy + Math.sin(rotRad + halfAngle) * r
          const largeArc = data.hFov > 180 ? 1 : 0
          const pathStr = `M ${cx} ${cy} L ${absStartX} ${absStartY} A ${r} ${r} 0 ${largeArc} 1 ${absEndX} ${absEndY} Z`
          const path = new fabric.Path(pathStr, {
            fill: tier.color, opacity: tier.opacity, selectable: false, evented: false,
          })
          canvas.add(path); canvas.sendObjectToBack(path); objects.push(path)
        }
        fovObjectMap.set(deviceId, objects)
      }
      canvas.renderAll()
    }
    void addFovCones()
  }, [fovData, devices, showFovCones, scalePxPerFt, fabricReady])

  // ---- Cable Rendering ----
  useEffect(() => {
    if (!fabricReady || !fabricRef.current) return
    const canvas = fabricRef.current
    cableObjectMap.forEach((obj) => canvas.remove(obj)); cableObjectMap.clear()

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

  // ---- Tool items for floating toolbar ----
  const toolItems: ({ icon: React.JSX.Element; label: string; id: string } | null)[] = [
    { icon: ToolbarIcons.select, label: 'Select', id: 'select' },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v6M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 16" /></svg>, label: 'Pan', id: 'pan' },
    { icon: ToolbarIcons.measure, label: 'Measure', id: 'measure' },
    { icon: ToolbarIcons.cable, label: 'Cable', id: 'cable' },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" /></svg>, label: 'Zone', id: 'zone' },
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
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 0', minWidth: 120, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          {[
            { label: 'Copy', action: () => onDeviceCopy?.(contextMenu.deviceId!) },
            { label: 'Delete', action: () => onDeviceDelete?.(contextMenu.deviceId!) },
          ].map((item) => (
            <div key={item.label} onClick={() => { item.action(); setContextMenu({ visible: false, x: 0, y: 0, deviceId: null }) }}
              style={{ padding: '6px 14px', fontSize: 12, color: item.label === 'Delete' ? C.red : C.text, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              {item.label}
            </div>
          ))}
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

      {/* Bottom bar: PPF Legend + Scale */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: 'linear-gradient(transparent, rgba(15,17,23,0.95))', zIndex: 10 }}>
        <div style={{ fontSize: 10, color: C.textDim, fontFamily: "'IBM Plex Mono'" }}>{Math.round(zoomLevel * 100)}%</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, fontFamily: "'IBM Plex Mono'" }}>
          {[
            { color: C.green, label: '100+' }, { color: C.yellow, label: '50-99' },
            { color: C.orange, label: '10-49' }, { color: C.red, label: '<10' },
          ].map((ppf) => (
            <div key={ppf.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: ppf.color, opacity: 0.7 }} />
              <span style={{ color: C.textDim }}>{ppf.label}</span>
            </div>
          ))}
          <span style={{ color: C.textMuted, marginLeft: 2 }}>PPF</span>
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
