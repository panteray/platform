'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { C, GRID_SIZE, ZOOM_MIN, ZOOM_MAX, type CanvasTool } from './constants'
import { DEVICE_SVG_STRINGS, CATEGORY_TO_ICON, ToolbarIcons } from './icons'
import { calculatePpfAtDistance, classifyDori } from '@/lib/calculators'
import { PersonPreview } from './person-preview'
import { SatelliteMap, type SatelliteMapHandle } from './satellite-map'
import type { DoriClassification } from '@/lib/calculators'
import type { DesignDevice, DesignCable, DesignFloorPlan, DesignMdfIdf } from '@/types/database'

type FabricCanvas = import('fabric').Canvas
type FabricObject = import('fabric').FabricObject

// ---- FOV Tier Data ----
interface FovTier { distanceFt: number; color: string; opacity: number }

export interface DeviceFovData {
  hFov: number; rotation: number; tiers: FovTier[]; sensorAngles?: number[]
  resolutionW?: number; sensorW?: number; focalLength?: number
  blindSpotFt?: number; colorHex?: string
}

// ---- State types ----
type CableDrawPhase = 'idle' | 'pick_source' | 'routing' | 'complete'
interface CableDrawState { phase: CableDrawPhase; sourceDeviceId: string | null; waypoints: Array<{ x: number; y: number }> }
interface ContextMenuState { visible: boolean; x: number; y: number; deviceId: string | null; mdfIdfId?: string | null }

interface CanvasAreaProps {
  designId: string; areaId: string | null; floorPlan: DesignFloorPlan | null
  devices: DesignDevice[]; cables: DesignCable[]; showGrid: boolean; activeTool: CanvasTool
  selectedDeviceId: string | null; showFovCones: boolean; fovData: Map<string, DeviceFovData>
  scalePxPerFt: number
  onZoomChange?: (zoom: number) => void; onSelectDevice: (id: string | null) => void
  onDeviceMoved?: (id: string, x: number, y: number) => void
  onDeviceRotated?: (id: string, angle: number) => void
  onSensorRotated?: (id: string, index: number, angle: number) => void
  onCanvasClick?: (x: number, y: number) => void
  onDeviceCopy?: (id: string) => void; onDeviceDelete?: (id: string) => void
  onCableCreated?: (cable: { from_device_id: string; to_device_id: string | null; waypoints: Array<{ x: number; y: number }>; length_ft: number }) => void
  onToolChange?: (tool: CanvasTool) => void
  onScaleCalibrated?: (pxPerFt: number) => void; onFloorPlanError?: (msg: string) => void
  walls?: Array<{ id: string; points: Array<{ x: number; y: number }> }>
  onWallCreated?: (points: Array<{ x: number; y: number }>) => void; onWallDeleted?: (id: string) => void
  pendingDeviceName?: string
  onDeviceDrop?: (x: number, y: number, deviceData: string) => void
  snapToGrid?: boolean; hiddenCategories?: Set<string>
  onUndo?: () => void; onRedo?: () => void; floorPlanOpacity?: number
  onFovHandleDragged?: (deviceId: string, targetDistanceFt: number) => void
  onFovAngleChanged?: (deviceId: string, fovAngle: number) => void
  fovDisplayMode?: 'simple' | 'ppf' | 'dori' | 'heatmap'
  highlightedPpfTier?: string | null; onPpfTierClick?: (tier: string | null) => void
  mdfIdfs?: DesignMdfIdf[]
  onMdfIdfPlaced?: (x: number, y: number) => void; onMdfIdfMoved?: (id: string, x: number, y: number) => void
  onMdfIdfDeleted?: (id: string) => void
  snapshotRef?: React.MutableRefObject<(() => string | null) | null>
  satelliteConfig?: { lat: number; lng: number; zoom: number; opacity?: number } | null
  onShow3dPreview?: (device: DesignDevice) => void
  onDragCommit?: (dragState: { deviceId: string; prevAngle: number; prevDist: number; sensorIdx: number } | null) => void
  viewportCenterRef?: React.MutableRefObject<(() => { x: number; y: number }) | null>
}

// ============================================================================
// CANVAS AREA — CLEAN REWRITE
// Proper fabric.js event model: fabric handles all object dragging natively.
// Pan: space+drag or middle-click. Never conflicts with object interaction.
// ============================================================================

export function CanvasArea({
  designId, areaId, floorPlan, devices, cables, showGrid, activeTool,
  selectedDeviceId, showFovCones, fovData, scalePxPerFt,
  onZoomChange, onSelectDevice, onDeviceMoved, onDeviceRotated, onSensorRotated,
  onCanvasClick, onDeviceCopy, onDeviceDelete, onCableCreated, onToolChange,
  onScaleCalibrated, onFloorPlanError, walls, onWallCreated, onWallDeleted,
  pendingDeviceName, onDeviceDrop, snapToGrid, hiddenCategories,
  onUndo, onRedo, floorPlanOpacity = 0.6,
  onFovHandleDragged, onFovAngleChanged,
  fovDisplayMode = 'simple', highlightedPpfTier, onPpfTierClick,
  mdfIdfs, onMdfIdfPlaced, onMdfIdfMoved, onMdfIdfDeleted,
  snapshotRef, satelliteConfig, onShow3dPreview, onDragCommit, viewportCenterRef,
}: CanvasAreaProps) {

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)
  const [fabricReady, setFabricReady] = useState(false)

  // Refs for stable access in event handlers
  const activeToolRef = useRef(activeTool)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  const selectedIdRef = useRef(selectedDeviceId)
  useEffect(() => { selectedIdRef.current = selectedDeviceId }, [selectedDeviceId])
  const devicesRef = useRef(devices)
  useEffect(() => { devicesRef.current = devices }, [devices])

  // Track pan state
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const spaceHeld = useRef(false)

  // Object tracking maps
  const deviceObjMap = useRef(new Map<string, FabricObject>())
  const fovObjMap = useRef(new Map<string, FabricObject[]>())
  const handleObjMap = useRef(new Map<string, FabricObject>())
  const gridObjRef = useRef<FabricObject | null>(null)
  const floorPlanObjRef = useRef<FabricObject | null>(null)
  const cableObjMap = useRef(new Map<string, FabricObject>())

  // Drag state for undo batching
  const dragStartRef = useRef<{ deviceId: string; prevAngle: number; prevDist: number; sensorIdx: number } | null>(null)
  const throttleRef = useRef(0)

  // Cable draw state
  const [cableDraw, setCableDraw] = useState<CableDrawState>({ phase: 'idle', sourceDeviceId: null, waypoints: [] })

  // Scale calibration
  const [scalePoints, setScalePoints] = useState<Array<{ x: number; y: number }>>([])
  const [scaleInput, setScaleInput] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 })

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, deviceId: null })

  // Measure tool
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([])

  // ========================================================================
  // 1. CANVAS INITIALIZATION
  // ========================================================================
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return
    let cancelled = false

    async function init() {
      const fm = await import('fabric')
      if (cancelled || !canvasElRef.current || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const canvas = new fm.Canvas(canvasElRef.current, {
        width: rect.width, height: rect.height,
        backgroundColor: C.bg,
        selection: false, // No rubber-band selection (we use click-to-select)
        preserveObjectStacking: true,
        stopContextMenu: true,
        fireRightClick: true,
      })

      fabricRef.current = canvas
      setFabricReady(true)

      // ---- Zoom (mouse wheel) ----
      canvas.on('mouse:wheel', (opt: any) => {
        const evt = opt.e as WheelEvent
        evt.preventDefault()
        const delta = evt.deltaY
        let zoom = canvas.getZoom()
        zoom *= 0.999 ** delta
        zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
        canvas.zoomToPoint(canvas.getScenePoint(evt), zoom)
        onZoomChange?.(zoom)
        canvas.requestRenderAll()
      })

      // ---- Pan (space+drag or middle-click) ----
      canvas.on('mouse:down', (opt: any) => {
        const evt = opt.e as MouseEvent
        setContextMenu(prev => ({ ...prev, visible: false }))

        // Middle-click or space held → start pan
        if (evt.button === 1 || spaceHeld.current || activeToolRef.current === 'pan') {
          isPanning.current = true
          panStart.current = { x: evt.clientX, y: evt.clientY }
          canvas.setCursor('grabbing')
          evt.preventDefault()
          return
        }

        // Right-click → context menu
        if (evt.button === 2) {
          const point = canvas.getScenePoint(evt)
          const target = canvas.findTarget(evt)
          const rec = target ? (target as unknown as Record<string, unknown>) : null
          if (rec?.__deviceId) {
            setContextMenu({ visible: true, x: evt.clientX, y: evt.clientY, deviceId: rec.__deviceId as string })
          }
          evt.preventDefault()
          return
        }

        // Left-click on empty space → tool actions
        const target = canvas.findTarget(evt)
        if (!target) {
          const point = canvas.getScenePoint(evt)
          const x = Math.round(point.x)
          const y = Math.round(point.y)

          if (activeToolRef.current === 'place') {
            onCanvasClick?.(x, y)
            return
          }
          if (activeToolRef.current === 'scale') {
            setScalePoints(prev => {
              const next = [...prev, { x, y }]
              if (next.length === 2) {
                // Show distance input dialog
                const dist = Math.sqrt((next[1].x - next[0].x) ** 2 + (next[1].y - next[0].y) ** 2)
                setScaleInput({ visible: true, x: evt.clientX, y: evt.clientY })
                return next
              }
              return next
            })
            return
          }
          if (activeToolRef.current === 'measure') {
            setMeasurePoints(prev => {
              if (prev.length >= 2) return [{ x, y }]
              return [...prev, { x, y }]
            })
            return
          }
          if (activeToolRef.current === 'mdf_idf') {
            onMdfIdfPlaced?.(x, y)
            return
          }
          if (activeToolRef.current === 'cable') {
            handleCableClick(x, y)
            return
          }
          // Deselect
          onSelectDevice(null)
        }
      })

      canvas.on('mouse:move', (opt: any) => {
        if (!isPanning.current) return
        const evt = opt.e as MouseEvent
        const vpt = canvas.viewportTransform!
        vpt[4] += evt.clientX - panStart.current.x
        vpt[5] += evt.clientY - panStart.current.y
        panStart.current = { x: evt.clientX, y: evt.clientY }
        canvas.requestRenderAll()
      })

      canvas.on('mouse:up', () => {
        if (isPanning.current) {
          isPanning.current = false
          canvas.setCursor('default')
        }
      })

      // ---- Object interactions (device click, device drag, FOV handle drag) ----
      canvas.on('mouse:down', (opt: any) => {
        const target = opt.target
        if (!target) return
        const rec = target as unknown as Record<string, unknown>

        // Click on device icon → select it
        if (rec.__deviceId && !rec.__fovHandle && !rec.__fovEdgeHandle) {
          onSelectDevice(rec.__deviceId as string)
          onToolChange?.('select')
        }
      })

      // Device drag end → persist position
      canvas.on('object:modified', (opt: any) => {
        const obj = opt.target
        if (!obj) return
        const rec = obj as unknown as Record<string, unknown>

        if (rec.__deviceId && !rec.__fovHandle && !rec.__fovEdgeHandle) {
          const id = rec.__deviceId as string
          onDeviceMoved?.(id, Math.round(obj.left ?? 0), Math.round(obj.top ?? 0))
        }

        // FOV handle drag end → commit for undo
        if (rec.__fovHandle || rec.__fovEdgeHandle) {
          onDragCommit?.(dragStartRef.current)
          dragStartRef.current = null
        }
      })

      // Device/handle dragging → real-time updates
      canvas.on('object:moving', (opt: any) => {
        const obj = opt.target
        if (!obj) return
        const rec = obj as unknown as Record<string, unknown>

        // ---- FOV distance handle (center arc) ----
        if (rec.__fovHandle) {
          const now = Date.now()
          if (now - throttleRef.current < 16) return
          throttleRef.current = now

          const deviceId = rec.__fovDeviceId as string
          const cx = rec.__fovDeviceCx as number
          const cy = rec.__fovDeviceCy as number
          const dx = (obj.left ?? 0) - cx
          const dy = (obj.top ?? 0) - cy
          const distPx = Math.sqrt(dx * dx + dy * dy)
          const distFt = Math.round(distPx / (scalePxPerFt || 10))
          let angleDeg = Math.round(Math.atan2(dy, dx) * (180 / Math.PI))
          if (angleDeg < 0) angleDeg += 360

          // Capture start state for undo
          if (!dragStartRef.current) {
            const device = devicesRef.current.find(d => d.id === deviceId)
            dragStartRef.current = {
              deviceId,
              prevAngle: device?.rotation ?? 0,
              prevDist: Number((device?.properties as Record<string, unknown>)?.target_distance) || 30,
              sensorIdx: 0,
            }
          }

          if (distFt > 1) onFovHandleDragged?.(deviceId, distFt)
          onDeviceRotated?.(deviceId, angleDeg)
          return
        }

        // ---- FOV angle handle (corner) ----
        if (rec.__fovEdgeHandle) {
          const now = Date.now()
          if (now - throttleRef.current < 16) return
          throttleRef.current = now

          const deviceId = rec.__fovDeviceId as string
          const cx = rec.__fovDeviceCx as number
          const cy = rec.__fovDeviceCy as number
          const rotRad = rec.__fovRotRad as number

          const dx = (obj.left ?? 0) - cx
          const dy = (obj.top ?? 0) - cy
          const handleAngle = Math.atan2(dy, dx)
          let diff = Math.abs(handleAngle - rotRad)
          if (diff > Math.PI) diff = 2 * Math.PI - diff
          const newFovDeg = Math.round(Math.min(180, Math.max(5, diff * 2 * (180 / Math.PI))))
          onFovAngleChanged?.(deviceId, newFovDeg)
          return
        }
      })
    }

    init()
    return () => {
      cancelled = true
      fabricRef.current?.dispose()
      fabricRef.current = null
      setFabricReady(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ========================================================================
  // 2. KEYBOARD SHORTCUTS
  // ========================================================================
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') { spaceHeld.current = true; e.preventDefault() }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIdRef.current && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          onDeviceDelete?.(selectedIdRef.current)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.shiftKey ? onRedo?.() : onUndo?.(); e.preventDefault() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedIdRef.current) { onDeviceCopy?.(selectedIdRef.current) }
      if (e.key === 'Escape') { onSelectDevice(null); onToolChange?.('select') }
      if (e.key === 'f' || e.key === 'F') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          // Toggle FOV is handled by parent
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') { spaceHeld.current = false }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [onDeviceDelete, onDeviceCopy, onUndo, onRedo, onSelectDevice, onToolChange])

  // ========================================================================
  // 3. CANVAS RESIZE
  // ========================================================================
  useEffect(() => {
    if (!containerRef.current || !fabricRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      fabricRef.current?.setDimensions({ width, height })
      fabricRef.current?.requestRenderAll()
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [fabricReady])

  // ========================================================================
  // 4. FLOOR PLAN
  // ========================================================================
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current

    // Remove old floor plan
    if (floorPlanObjRef.current) {
      canvas.remove(floorPlanObjRef.current)
      floorPlanObjRef.current = null
    }

    if (!floorPlan?.file_url) return

    async function loadFloorPlan() {
      const fm = await import('fabric')
      try {
        const img = await fm.FabricImage.fromURL(floorPlan!.file_url!, { crossOrigin: 'anonymous' })
        img.set({
          left: 0, top: 0,
          opacity: floorPlanOpacity,
          selectable: false, evented: false,
          originX: 'left', originY: 'top',
        })
        canvas.add(img)
        canvas.sendObjectToBack(img)
        floorPlanObjRef.current = img
        canvas.requestRenderAll()
      } catch (err) {
        onFloorPlanError?.('Failed to load floor plan image')
      }
    }
    loadFloorPlan()
  }, [floorPlan?.file_url, floorPlanOpacity, fabricReady])

  // ========================================================================
  // 5. GRID
  // ========================================================================
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current

    if (gridObjRef.current) {
      canvas.remove(gridObjRef.current)
      gridObjRef.current = null
    }

    if (!showGrid) return

    async function renderGrid() {
      const fm = await import('fabric')
      const size = GRID_SIZE
      const dotCanvas = document.createElement('canvas')
      dotCanvas.width = size; dotCanvas.height = size
      const ctx = dotCanvas.getContext('2d')!
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, 0.8, 0, Math.PI * 2)
      ctx.fill()

      const pattern = new fm.Pattern({ source: dotCanvas, repeat: 'repeat' })
      const rect = new fm.Rect({
        left: -10000, top: -10000, width: 20000, height: 20000,
        fill: pattern as unknown as string,
        selectable: false, evented: false,
      })
      canvas.add(rect)
      canvas.sendObjectToBack(rect)
      gridObjRef.current = rect
      canvas.requestRenderAll()
    }
    renderGrid()
  }, [showGrid, fabricReady])

  // ========================================================================
  // 6. DEVICE RENDERING
  // ========================================================================
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current

    // Remove old device objects
    for (const [, obj] of deviceObjMap.current) canvas.remove(obj)
    deviceObjMap.current.clear()

    async function renderDevices() {
      const fm = await import('fabric')
      const cameraTypes = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']

      for (const device of devices) {
        if (hiddenCategories?.has(device.category)) continue

        const isCamera = cameraTypes.includes(device.category)
        const isSelected = device.id === selectedDeviceId
        const iconKey = CATEGORY_TO_ICON[device.category] || 'generic'
        const svgStr = DEVICE_SVG_STRINGS[iconKey]
        const iconScale = 0.6

        try {
          let group: FabricObject

          if (svgStr) {
            const result = await fm.loadSVGFromString(svgStr)
            const svgGroup = fm.util.groupSVGElements(result.objects.filter(Boolean) as FabricObject[], result.options)
            // Label below icon
            const label = new fm.FabricText(device.label || '', {
              left: 0, top: 22, fontSize: 10,
              fill: C.textMuted, fontFamily: 'IBM Plex Sans, sans-serif',
              originX: 'center', originY: 'top',
            })
            group = new fm.Group([svgGroup, label], {
              left: device.position_x, top: device.position_y,
              originX: 'center', originY: 'center',
              scaleX: iconScale, scaleY: iconScale,
              angle: isCamera ? 0 : (device.rotation || 0), // Cameras rotate via FOV, not icon
              hasControls: false, hasBorders: false,
              lockScalingX: true, lockScalingY: true, lockRotation: true,
              selectable: true, evented: true,
              hoverCursor: 'move', moveCursor: 'move',
            })
          } else {
            // Fallback dot
            const dot = new fm.Circle({
              left: device.position_x, top: device.position_y,
              radius: 8, fill: C.accent,
              originX: 'center', originY: 'center',
              hasControls: false, hasBorders: false,
              selectable: true, evented: true,
              hoverCursor: 'move', moveCursor: 'move',
            })
            group = dot
          }

          // Tag with device ID for event handling
          const rec = group as unknown as Record<string, unknown>
          rec.__deviceId = device.id
          rec.__isCamera = isCamera

          // Selection highlight
          if (isSelected) {
            group.set({
              strokeWidth: 2,
              stroke: C.accent,
              padding: 4,
            } as Record<string, unknown>)
          }

          canvas.add(group)
          deviceObjMap.current.set(device.id, group)
        } catch {
          // SVG parse failed — skip
        }
      }

      // Z-order: grid → floor plan → cones → cables → devices (front)
      for (const [, obj] of deviceObjMap.current) {
        canvas.bringObjectToFront(obj)
      }
      canvas.requestRenderAll()
    }

    renderDevices()
  }, [devices, selectedDeviceId, fabricReady, hiddenCategories])

  // ========================================================================
  // 7. FOV CONE + HANDLE RENDERING (THE CRITICAL PART)
  // ========================================================================
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current

    // Clear old FOV objects
    for (const [, objs] of fovObjMap.current) {
      for (const o of objs) canvas.remove(o)
    }
    fovObjMap.current.clear()
    for (const [, h] of handleObjMap.current) canvas.remove(h)
    handleObjMap.current.clear()

    if (!showFovCones && !selectedDeviceId) return

    async function renderFov() {
      const fm = await import('fabric')

      for (const [deviceId, data] of fovData) {
        const device = devices.find(d => d.id === deviceId)
        if (!device) continue
        if (hiddenCategories?.has(device.category)) continue

        // Only show FOV for selected device if global FOV is off
        if (!showFovCones && deviceId !== selectedDeviceId) continue

        const objects: FabricObject[] = []
        const cx = device.position_x
        const cy = device.position_y
        const halfAngle = (data.hFov / 2) * (Math.PI / 180)

        // Determine imager angles (multi-sensor support)
        const imagerAngles = data.sensorAngles
          ? data.sensorAngles.map(a => a + (device.rotation || 0))
          : [(device.rotation || 0)]

        for (const imagerDeg of imagerAngles) {
          const rotRad = imagerDeg * (Math.PI / 180)

          // Render tiers (outermost first)
          for (let t = 0; t < data.tiers.length; t++) {
            const tier = data.tiers[t]
            const r = tier.distanceFt * (scalePxPerFt || 10)
            if (r < 2) continue

            // Build cone polygon points
            const steps = 24
            const points: Array<{ x: number; y: number }> = [{ x: cx, y: cy }]
            for (let i = 0; i <= steps; i++) {
              const angle = rotRad - halfAngle + (2 * halfAngle * i / steps)
              points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r })
            }

            // Determine fill color based on display mode
            let fillColor = data.colorHex || C.accent
            let fillOpacity = tier.opacity
            if (fovDisplayMode === 'ppf' || fovDisplayMode === 'dori') {
              fillColor = tier.color
              fillOpacity = t === 0 ? 0.08 : tier.opacity
            } else if (fovDisplayMode === 'heatmap') {
              fillColor = '#22c55e'
              fillOpacity = 0.08
            }

            const cone = new fm.Polygon(points, {
              fill: fillColor, opacity: fillOpacity,
              stroke: t === 0 ? fillColor : 'transparent',
              strokeWidth: t === 0 ? 1 : 0,
              strokeDashArray: t === 0 ? [4, 4] : undefined,
              selectable: false, evented: false,
              originX: 'left', originY: 'top',
            })
            canvas.add(cone)
            objects.push(cone)
          }

          // ---- FOV HANDLES (ONLY for selected device) ----
          // This is the IPVM/Hanwha 3-handle pattern
          if (deviceId === selectedDeviceId && onFovHandleDragged) {
            const outerTier = data.tiers[0]
            if (!outerTier) continue
            const outerR = outerTier.distanceFt * (scalePxPerFt || 10)
            if (outerR < 5) continue

            // ---- Handle 1: Center arc (target distance) ----
            const centerAngle = rotRad
            const hx = cx + Math.cos(centerAngle) * outerR
            const hy = cy + Math.sin(centerAngle) * outerR
            const distHandle = new fm.Circle({
              left: hx, top: hy, radius: 7,
              fill: '#ffffff', stroke: C.accent, strokeWidth: 2.5,
              originX: 'center', originY: 'center',
              selectable: true, evented: true,
              hasControls: false, hasBorders: false,
              hoverCursor: 'grab', moveCursor: 'grabbing',
            })
            const distRec = distHandle as unknown as Record<string, unknown>
            distRec.__fovHandle = true
            distRec.__fovDeviceId = deviceId
            distRec.__fovDeviceCx = cx
            distRec.__fovDeviceCy = cy
            distRec.__fovSensorIndex = 0
            canvas.add(distHandle)
            handleObjMap.current.set(`${deviceId}_dist`, distHandle)

            // Distance label
            const distFt = Math.round(outerTier.distanceFt)
            const distLabel = new fm.FabricText(`${distFt}ft`, {
              left: hx + Math.cos(centerAngle) * 18,
              top: hy + Math.sin(centerAngle) * 18,
              fontSize: 11, fontWeight: '600',
              fontFamily: "'IBM Plex Mono', monospace",
              fill: C.accent,
              originX: 'center', originY: 'center',
              selectable: false, evented: false,
            })
            canvas.add(distLabel)
            objects.push(distLabel)

            // ---- Handles 2 & 3: Corner handles (FOV angle) ----
            if (onFovAngleChanged) {
              const edgeR = outerR * 0.85
              const makeCornerHandle = (angle: number, key: string) => {
                const ex = cx + Math.cos(angle) * edgeR
                const ey = cy + Math.sin(angle) * edgeR
                const handle = new fm.Circle({
                  left: ex, top: ey, radius: 6,
                  fill: '#f97316', stroke: '#ffffff', strokeWidth: 2,
                  originX: 'center', originY: 'center',
                  selectable: true, evented: true,
                  hasControls: false, hasBorders: false,
                  hoverCursor: 'ew-resize', moveCursor: 'ew-resize',
                })
                const handleRec = handle as unknown as Record<string, unknown>
                handleRec.__fovEdgeHandle = true
                handleRec.__fovDeviceId = deviceId
                handleRec.__fovDeviceCx = cx
                handleRec.__fovDeviceCy = cy
                handleRec.__fovRotRad = rotRad
                canvas.add(handle)
                handleObjMap.current.set(key, handle)
              }
              makeCornerHandle(rotRad - halfAngle, `${deviceId}_left`)
              makeCornerHandle(rotRad + halfAngle, `${deviceId}_right`)

              // Angle label
              const angleDeg = Math.round(data.hFov)
              const angleLabel = new fm.FabricText(`${angleDeg}°`, {
                left: cx + Math.cos(rotRad) * (outerR * 0.4),
                top: cy + Math.sin(rotRad) * (outerR * 0.4) - 12,
                fontSize: 10, fontWeight: '600',
                fontFamily: "'IBM Plex Mono', monospace",
                fill: '#f97316',
                originX: 'center', originY: 'center',
                selectable: false, evented: false,
              })
              canvas.add(angleLabel)
              objects.push(angleLabel)
            }
          }
        }

        fovObjMap.current.set(deviceId, objects)
      }

      // Z-ordering: cones to back, handles to front
      for (const [, objs] of fovObjMap.current) {
        for (const o of objs) canvas.sendObjectToBack(o)
      }
      // Grid and floor plan even further back
      if (gridObjRef.current) canvas.sendObjectToBack(gridObjRef.current)
      if (floorPlanObjRef.current) {
        canvas.sendObjectToBack(floorPlanObjRef.current)
        if (gridObjRef.current) canvas.sendObjectToBack(gridObjRef.current)
      }
      // Devices on top of cones
      for (const [, obj] of deviceObjMap.current) canvas.bringObjectToFront(obj)
      // Handles on very top
      for (const [, h] of handleObjMap.current) canvas.bringObjectToFront(h)

      canvas.requestRenderAll()
    }

    renderFov()
  }, [fovData, devices, showFovCones, selectedDeviceId, scalePxPerFt, fabricReady,
      onFovHandleDragged, onFovAngleChanged, fovDisplayMode, highlightedPpfTier,
      hiddenCategories, walls])

  // ========================================================================
  // 8. CABLES
  // ========================================================================
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current

    for (const [, obj] of cableObjMap.current) canvas.remove(obj)
    cableObjMap.current.clear()

    async function renderCables() {
      const fm = await import('fabric')
      for (const cable of cables) {
        const fromDev = devices.find(d => d.id === cable.from_device_id)
        const toDev = cable.to_device_id ? devices.find(d => d.id === cable.to_device_id) : null
        if (!fromDev) continue

        const points: Array<{ x: number; y: number }> = [{ x: fromDev.position_x, y: fromDev.position_y }]
        if (cable.waypoints && Array.isArray(cable.waypoints)) {
          for (const wp of cable.waypoints as Array<{ x: number; y: number }>) {
            points.push(wp)
          }
        }
        if (toDev) points.push({ x: toDev.position_x, y: toDev.position_y })

        const flatCoords = points.flatMap(p => [p.x, p.y])
        const line = new fm.Polyline(points, {
          fill: 'transparent',
          stroke: '#64748b', strokeWidth: 2,
          strokeDashArray: [6, 3],
          selectable: false, evented: false,
          opacity: 0.6,
        })
        canvas.add(line)
        cableObjMap.current.set(cable.id, line)
      }
      canvas.requestRenderAll()
    }
    renderCables()
  }, [cables, devices, fabricReady])

  // ========================================================================
  // 9. SNAPSHOT REF (for exports)
  // ========================================================================
  useEffect(() => {
    if (snapshotRef) {
      snapshotRef.current = () => {
        if (!fabricRef.current) return null
        return fabricRef.current.toDataURL({ format: 'png', multiplier: 2 })
      }
    }
  }, [snapshotRef, fabricReady])

  // ========================================================================
  // 10. VIEWPORT CENTER REF (for auto-place)
  // ========================================================================
  useEffect(() => {
    if (viewportCenterRef) {
      viewportCenterRef.current = () => {
        if (!fabricRef.current) return { x: 400, y: 300 }
        const canvas = fabricRef.current
        const vpt = canvas.viewportTransform!
        const zoom = canvas.getZoom()
        const cx = (canvas.width! / 2 - vpt[4]) / zoom
        const cy = (canvas.height! / 2 - vpt[5]) / zoom
        return { x: Math.round(cx), y: Math.round(cy) }
      }
    }
  }, [viewportCenterRef, fabricReady])

  // ========================================================================
  // CABLE CLICK HANDLER
  // ========================================================================
  const handleCableClick = useCallback((x: number, y: number) => {
    setCableDraw(prev => {
      if (prev.phase === 'idle' || prev.phase === 'pick_source') {
        // Find nearest device
        const nearest = devices.reduce<{ id: string; dist: number } | null>((best, d) => {
          const dist = Math.sqrt((d.position_x - x) ** 2 + (d.position_y - y) ** 2)
          if (dist < 40 && (!best || dist < best.dist)) return { id: d.id, dist }
          return best
        }, null)
        if (nearest) {
          return { phase: 'routing', sourceDeviceId: nearest.id, waypoints: [{ x, y }] }
        }
        toast.error('Click near a device to start a cable')
        return prev
      }
      if (prev.phase === 'routing') {
        // Check if near a device (end cable)
        const nearest = devices.reduce<{ id: string; dist: number } | null>((best, d) => {
          if (d.id === prev.sourceDeviceId) return best
          const dist = Math.sqrt((d.position_x - x) ** 2 + (d.position_y - y) ** 2)
          if (dist < 40 && (!best || dist < best.dist)) return { id: d.id, dist }
          return best
        }, null)
        if (nearest) {
          // Complete cable
          const totalLen = [...prev.waypoints, { x, y }].reduce((sum, wp, i, arr) => {
            if (i === 0) return 0
            return sum + Math.sqrt((wp.x - arr[i-1].x) ** 2 + (wp.y - arr[i-1].y) ** 2)
          }, 0)
          onCableCreated?.({
            from_device_id: prev.sourceDeviceId!,
            to_device_id: nearest.id,
            waypoints: prev.waypoints,
            length_ft: Math.round(totalLen / (scalePxPerFt || 10)),
          })
          onToolChange?.('select')
          return { phase: 'idle', sourceDeviceId: null, waypoints: [] }
        }
        // Add waypoint
        return { ...prev, waypoints: [...prev.waypoints, { x, y }] }
      }
      return prev
    })
  }, [devices, scalePxPerFt, onCableCreated, onToolChange])

  // ========================================================================
  // SCALE CALIBRATION SUBMIT
  // ========================================================================
  const handleScaleSubmit = useCallback((distanceFt: number) => {
    if (scalePoints.length !== 2 || distanceFt <= 0) return
    const pixelDist = Math.sqrt(
      (scalePoints[1].x - scalePoints[0].x) ** 2 +
      (scalePoints[1].y - scalePoints[0].y) ** 2
    )
    const pxPerFt = pixelDist / distanceFt
    onScaleCalibrated?.(pxPerFt)
    setScalePoints([])
    setScaleInput({ visible: false, x: 0, y: 0 })
    onToolChange?.('select')
    toast.success(`Scale set: ${pxPerFt.toFixed(1)} px/ft`)
  }, [scalePoints, onScaleCalibrated, onToolChange])

  // ========================================================================
  // CURSOR
  // ========================================================================
  useEffect(() => {
    if (!containerRef.current) return
    const cursors: Record<string, string> = {
      select: 'default', place: 'crosshair', cable: 'crosshair',
      measure: 'crosshair', scale: 'crosshair', pan: 'grab',
      mdf_idf: 'crosshair', wall: 'crosshair', zone: 'crosshair', door: 'crosshair',
    }
    containerRef.current.style.cursor = cursors[activeTool] || 'default'
  }, [activeTool])

  // ========================================================================
  // DRAG & DROP (for device placement from catalog)
  // ========================================================================
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/json')
    if (!data || !fabricRef.current) return
    const canvas = fabricRef.current
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const point = canvas.getScenePoint(e.nativeEvent as MouseEvent)
    onDeviceDrop?.(Math.round(point.x), Math.round(point.y), data)
  }, [onDeviceDrop])

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div
      ref={containerRef}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      style={{ flex: 1, position: 'relative', overflow: 'hidden', background: C.bg }}
    >
      <canvas ref={canvasElRef} />

      {/* Satellite map layer (below canvas) */}
      {satelliteConfig && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <SatelliteMap
            lat={satelliteConfig.lat} lng={satelliteConfig.lng}
            zoom={satelliteConfig.zoom} opacity={satelliteConfig.opacity ?? 0.5}
          />
        </div>
      )}

      {/* Tool status bar */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
        background: 'rgba(0,0,0,0.7)', color: C.textMuted,
        pointerEvents: 'none', zIndex: 20,
      }}>
        {activeTool === 'select' && !selectedDeviceId && 'Click a device to select • Space+drag to pan • Scroll to zoom'}
        {activeTool === 'select' && selectedDeviceId && 'Drag device to move • Drag handles to adjust FOV • Delete to remove'}
        {activeTool === 'place' && (pendingDeviceName ? `Click to place: ${pendingDeviceName}` : 'Select a device from the catalog')}
        {activeTool === 'cable' && (cableDraw.phase === 'idle' ? 'Click near a device to start cable' : 'Click device to end • Click to add waypoint')}
        {activeTool === 'measure' && (measurePoints.length === 0 ? 'Click to start measuring' : measurePoints.length === 1 ? 'Click to set end point' : `Distance: ${(Math.sqrt((measurePoints[1].x - measurePoints[0].x) ** 2 + (measurePoints[1].y - measurePoints[0].y) ** 2) / (scalePxPerFt || 10)).toFixed(1)} ft`)}
        {activeTool === 'scale' && (scalePoints.length === 0 ? 'Click to set first point' : scalePoints.length === 1 ? 'Click to set second point' : 'Enter distance')}
        {activeTool === 'pan' && 'Drag to pan'}
        {activeTool === 'mdf_idf' && 'Click to place MDF/IDF'}
      </div>

      {/* Scale distance input popup */}
      {scaleInput.visible && (
        <div style={{
          position: 'fixed', left: scaleInput.x, top: scaleInput.y - 60,
          background: C.bgPanel, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: 12, zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Enter known distance (ft):</div>
          <form onSubmit={(e) => {
            e.preventDefault()
            const input = (e.target as HTMLFormElement).elements.namedItem('dist') as HTMLInputElement
            handleScaleSubmit(parseFloat(input.value))
          }}>
            <input name="dist" autoFocus type="number" step="0.1" min="0.1"
              style={{
                width: 100, padding: '4px 8px', background: C.bgActive,
                border: `1px solid ${C.accent}`, borderRadius: 4,
                color: C.text, fontSize: 13, fontFamily: "'IBM Plex Mono'",
                outline: 'none',
              }}
            />
            <button type="submit" style={{
              marginLeft: 6, padding: '4px 12px', background: C.accent,
              color: '#fff', border: 'none', borderRadius: 4, fontSize: 11,
              fontWeight: 600, cursor: 'pointer',
            }}>Set</button>
          </form>
        </div>
      )}

      {/* Context menu */}
      {contextMenu.visible && contextMenu.deviceId && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y,
          background: C.bgPanel, border: `1px solid ${C.border}`,
          borderRadius: 6, padding: 4, zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          minWidth: 140,
        }}>
          {[
            { label: 'Duplicate', action: () => onDeviceCopy?.(contextMenu.deviceId!) },
            { label: 'Delete', action: () => onDeviceDelete?.(contextMenu.deviceId!), danger: true },
          ].map(item => (
            <button key={item.label}
              onClick={() => { item.action(); setContextMenu(prev => ({ ...prev, visible: false })) }}
              style={{
                display: 'block', width: '100%', padding: '6px 12px',
                background: 'transparent', border: 'none', textAlign: 'left',
                color: (item as { danger?: boolean }).danger ? C.red : C.text,
                fontSize: 12, cursor: 'pointer', borderRadius: 4,
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.bgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >{item.label}</button>
          ))}
        </div>
      )}

      {/* Measure overlay */}
      {activeTool === 'measure' && measurePoints.length === 2 && (
        <div style={{
          position: 'absolute', top: 12, right: 12, padding: '8px 16px',
          background: C.bgPanel, border: `1px solid ${C.border}`,
          borderRadius: 6, zIndex: 20, fontSize: 13, color: C.text,
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          {(Math.sqrt(
            (measurePoints[1].x - measurePoints[0].x) ** 2 +
            (measurePoints[1].y - measurePoints[0].y) ** 2
          ) / (scalePxPerFt || 10)).toFixed(1)} ft
        </div>
      )}

      {/* Person preview for selected camera */}
      {selectedDeviceId && fovData.has(selectedDeviceId) && (
        <div style={{ position: 'absolute', bottom: 40, right: 12, zIndex: 20 }}>
          <PersonPreview
            ppf={(() => {
              const d = fovData.get(selectedDeviceId)
              if (!d || !d.resolutionW || !d.sensorW || !d.focalLength) return 0
              const dist = d.tiers[0]?.distanceFt || 30
              return calculatePpfAtDistance(d.resolutionW, d.sensorW, d.focalLength, dist)
            })()}
            distanceFt={fovData.get(selectedDeviceId)?.tiers[0]?.distanceFt || 30}
          />
        </div>
      )}
    </div>
  )
}
