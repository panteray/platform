'use client'
/**
 * CanvasArea — Fabric.js canvas with FOV drag handles (IPVM/Hanwha pattern).
 *
 * Event model:
 *   - Fabric handles ALL object dragging natively
 *   - Pan: space+drag or middle-click (never conflicts with handles)
 *   - FOV handles: 3 per selected camera (center=distance, corners=angle)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { C, GRID_SIZE, ZOOM_MIN, ZOOM_MAX, type CanvasTool } from './constants'
import { calculatePpfAtDistance, classifyDori } from '@/lib/calculators'
import { DEVICE_SVG_STRINGS, CATEGORY_TO_ICON } from './icons'
import type { DesignDevice, DesignCable, DesignFloorPlan, DesignMdfIdf } from '@/types/database'

type FabricCanvas = import('fabric').Canvas
type FabricObject = import('fabric').FabricObject

/* ─── FOV types ─── */
interface FovTier { distanceFt: number; color: string; opacity: number }
export interface DeviceFovData {
  hFov: number; rotation: number; tiers: FovTier[]
  sensorAngles?: number[]
  resolutionW?: number; sensorW?: number; focalLength?: number
  blindSpotFt?: number; colorHex?: string
}

/* ─── Props ─── */
interface Props {
  designId: string; areaId: string | null
  floorPlan: DesignFloorPlan | null
  devices: DesignDevice[]; cables: DesignCable[]
  showGrid: boolean; activeTool: CanvasTool
  selectedDeviceId: string | null
  showFovCones: boolean; fovData: Map<string, DeviceFovData>
  scalePxPerFt: number; floorPlanOpacity?: number
  fovDisplayMode?: 'simple' | 'ppf' | 'dori' | 'heatmap'
  onSelectDevice: (id: string | null) => void
  onDeviceMoved?: (id: string, x: number, y: number) => void
  onDeviceRotated?: (id: string, angle: number) => void
  onDeviceCopy?: (id: string) => void
  onDeviceDelete?: (id: string) => void
  onToolChange?: (tool: CanvasTool) => void
  onScaleCalibrated?: (pxPerFt: number) => void
  onFovHandleDragged?: (deviceId: string, targetDistanceFt: number) => void
  onFovAngleChanged?: (deviceId: string, fovAngle: number) => void
  onCanvasClick?: (x: number, y: number) => void
  onCableCreated?: (cable: { from_device_id: string; to_device_id: string | null; waypoints: Array<{ x: number; y: number }>; length_ft: number }) => void
  mdfIdfs?: DesignMdfIdf[]
  onMdfIdfPlaced?: (x: number, y: number) => void
  onDragCommit?: (s: unknown) => void
  highlightedPpfTier?: string | null
  onPpfTierClick?: (tier: string | null) => void
  hiddenCategories?: Set<string>
  pendingDeviceName?: string
  onDeviceDrop?: (x: number, y: number, data: string) => void
  snapshotRef?: React.MutableRefObject<(() => string | null) | null>
  viewportCenterRef?: React.MutableRefObject<(() => { x: number; y: number }) | null>
  satelliteConfig?: { lat: number; lng: number; zoom: number; opacity?: number } | null
  onFloorPlanError?: (msg: string) => void
  onZoomChange?: (zoom: number) => void
  walls?: Array<{ id: string; points: Array<{ x: number; y: number }> }>
  onWallCreated?: (points: Array<{ x: number; y: number }>) => void
  onSensorRotated?: (id: string, index: number, angle: number) => void
  onUndo?: () => void; onRedo?: () => void
  snapToGrid?: boolean
  onWallDeleted?: (id: string) => void
  onMdfIdfMoved?: (id: string, x: number, y: number) => void
  onMdfIdfDeleted?: (id: string) => void
  onShow3dPreview?: (device: DesignDevice) => void
  zoomToPointRef?: React.MutableRefObject<((x: number, y: number) => void) | null>
}

/* ─── Resolve CSS variable to computed value (needed for <canvas> 2D context) ─── */
function resolveCanvasColor(varName: string, fallback = '#09090b'): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback
}

/* ─── Camera categories ─── */
const CAM_CATS = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']

export function CanvasArea({
  designId, areaId, floorPlan, devices, cables, showGrid, activeTool,
  selectedDeviceId, showFovCones, fovData, scalePxPerFt,
  floorPlanOpacity = 0.6, fovDisplayMode = 'simple',
  onSelectDevice, onDeviceMoved, onDeviceRotated,
  onDeviceCopy, onDeviceDelete, onToolChange, onScaleCalibrated,
  onFovHandleDragged, onFovAngleChanged, onCanvasClick, onCableCreated,
  mdfIdfs, onMdfIdfPlaced, onDragCommit, onZoomChange,
  onFloorPlanError, hiddenCategories, zoomToPointRef,
}: Props) {

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fcRef = useRef<FabricCanvas | null>(null)
  const [ready, setReady] = useState(false)

  // Stable refs for event handlers
  const toolRef = useRef(activeTool)
  useEffect(() => { toolRef.current = activeTool }, [activeTool])
  const selRef = useRef(selectedDeviceId)
  useEffect(() => { selRef.current = selectedDeviceId }, [selectedDeviceId])
  const devsRef = useRef(devices)
  useEffect(() => { devsRef.current = devices }, [devices])

  // Expose zoom-to-point function via ref
  useEffect(() => {
    if (!zoomToPointRef) return
    zoomToPointRef.current = (x: number, y: number) => {
      const c = fcRef.current
      if (!c) return
      const vpt = c.viewportTransform!
      const zoom = vpt[0] || 1
      const canvasW = c.getWidth()
      const canvasH = c.getHeight()
      vpt[4] = canvasW / 2 - x * zoom
      vpt[5] = canvasH / 2 - y * zoom
      c.requestRenderAll()
    }
    return () => { if (zoomToPointRef) zoomToPointRef.current = null }
  }, [zoomToPointRef, ready])

  // Pan state
  const panning = useRef(false)
  const panOrigin = useRef({ x: 0, y: 0 })
  const spaceDown = useRef(false)

  // Object maps (device ID → fabric object)
  const devObjs = useRef(new Map<string, FabricObject>())
  const fovObjs = useRef(new Map<string, FabricObject[]>())
  const handleObjs = useRef(new Map<string, FabricObject>())
  const gridObj = useRef<FabricObject | null>(null)
  const fpObj = useRef<FabricObject | null>(null)

  // Throttle for real-time drag
  const lastDragT = useRef(0)

  // Context menu
  const [ctxMenu, setCtxMenu] = useState({ show: false, x: 0, y: 0, id: '' })

  // Scale calibration
  const [scalePts, setScalePts] = useState<Array<{ x: number; y: number }>>([])
  const [scalePopup, setScalePopup] = useState({ show: false, x: 0, y: 0 })

  // PPF tooltip state
  const [ppfTooltip, setPpfTooltip] = useState<{ show: boolean; x: number; y: number; ppf: number; dori: string; distFt: number; label: string } | null>(null)
  const fovDataRef = useRef(fovData)
  useEffect(() => { fovDataRef.current = fovData }, [fovData])
  const scalePxRef = useRef(scalePxPerFt)
  useEffect(() => { scalePxRef.current = scalePxPerFt }, [scalePxPerFt])
  const lastPpfT = useRef(0)

  // ════════════════════════════════════════════════════════════════
  // INIT CANVAS
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current) return
    let dead = false

    async function boot() {
      const fm = await import('fabric')
      if (dead || !canvasElRef.current || !containerRef.current) return

      const { width, height } = containerRef.current.getBoundingClientRect()
      const c = new fm.Canvas(canvasElRef.current, {
        width, height, backgroundColor: resolveCanvasColor('--canvas-bg'),
        selection: false, preserveObjectStacking: true,
        stopContextMenu: true, fireRightClick: true,
      })
      fcRef.current = c
      setReady(true)

      // ── ZOOM (scroll) ──
      c.on('mouse:wheel', (o: any) => {
        const e = o.e as WheelEvent; e.preventDefault()
        let z = c.getZoom() * (0.999 ** e.deltaY)
        z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
        c.zoomToPoint(c.getScenePoint(e), z)
        onZoomChange?.(z)
        c.requestRenderAll()
      })

      // ── MOUSE DOWN ──
      c.on('mouse:down', (o: any) => {
        const e = o.e as MouseEvent
        setCtxMenu(p => ({ ...p, show: false }))

        // Middle-click / Space / Pan tool → start panning
        if (e.button === 1 || spaceDown.current || toolRef.current === 'pan') {
          panning.current = true
          panOrigin.current = { x: e.clientX, y: e.clientY }
          c.setCursor('grabbing')
          e.preventDefault()
          return
        }

        // Right-click → context menu
        if (e.button === 2) {
          const target = c.findTarget(e)
          const rec = target as unknown as Record<string, unknown> | null
          if (rec?.__devId) {
            setCtxMenu({ show: true, x: e.clientX, y: e.clientY, id: rec.__devId as string })
          }
          e.preventDefault()
          return
        }

        // Left-click on fabric object → select device
        const target = o.target
        if (target) {
          const rec = target as unknown as Record<string, unknown>
          if (rec.__devId && !rec.__fovDist && !rec.__fovEdge) {
            onSelectDevice(rec.__devId as string)
            onToolChange?.('select')
          }
          return
        }

        // Click on empty canvas → tool actions or deselect
        const pt = c.getScenePoint(e)
        const x = Math.round(pt.x), y = Math.round(pt.y)
        switch (toolRef.current) {
          case 'place': onCanvasClick?.(x, y); break
          case 'mdf_idf': onMdfIdfPlaced?.(x, y); break
          case 'scale':
            setScalePts(prev => {
              const next = [...prev, { x, y }]
              if (next.length >= 2) {
                setScalePopup({ show: true, x: e.clientX, y: e.clientY })
              }
              return next.length > 2 ? [{ x, y }] : next
            })
            break
          default: onSelectDevice(null); break
        }
      })

      // ── MOUSE MOVE (pan + PPF tooltip) ──
      c.on('mouse:move', (o: any) => {
        const e = o.e as MouseEvent

        // Pan handling
        if (panning.current) {
          const vpt = c.viewportTransform!
          vpt[4] += e.clientX - panOrigin.current.x
          vpt[5] += e.clientY - panOrigin.current.y
          panOrigin.current = { x: e.clientX, y: e.clientY }
          c.requestRenderAll()
          return
        }

        // PPF-at-cursor (throttled 50ms)
        const now = Date.now()
        if (now - lastPpfT.current < 50) return
        lastPpfT.current = now

        const pt = c.getScenePoint(e)
        const mx = pt.x, my = pt.y
        const fd = fovDataRef.current
        const devs = devsRef.current
        const scale = scalePxRef.current || 10
        let found = false

        for (const [devId, data] of fd) {
          if (!data.resolutionW || !data.sensorW || !data.focalLength) continue
          const dev = devs.find(d => d.id === devId)
          if (!dev) continue

          const cx = dev.position_x, cy = dev.position_y
          const dx = mx - cx, dy = my - cy
          const distPx = Math.sqrt(dx * dx + dy * dy)
          const distFt = distPx / scale

          // Check if within outermost tier distance
          const maxDist = data.tiers[0]?.distanceFt || 30
          if (distFt > maxDist || distFt < 0.5) continue

          // Check if within FOV angle
          const halfAng = (data.hFov / 2) * Math.PI / 180
          const rotRad = (dev.rotation || 0) * Math.PI / 180
          let cursorAngle = Math.atan2(dy, dx) - rotRad
          // Normalize to -PI..PI
          while (cursorAngle > Math.PI) cursorAngle -= 2 * Math.PI
          while (cursorAngle < -Math.PI) cursorAngle += 2 * Math.PI
          if (Math.abs(cursorAngle) > halfAng) continue

          // Inside FOV cone — compute PPF
          const ppf = calculatePpfAtDistance(data.resolutionW, data.sensorW, data.focalLength, distFt)
          const dori = classifyDori(ppf)
          const label = dev.label || dev.category
          setPpfTooltip({ show: true, x: e.clientX, y: e.clientY, ppf: Math.round(ppf), dori, distFt: Math.round(distFt), label })
          found = true
          break
        }
        if (!found) setPpfTooltip(null)
      })

      // ── MOUSE UP (stop pan) ──
      c.on('mouse:up', () => { if (panning.current) { panning.current = false; c.setCursor('default') } })

      // ── OBJECT MODIFIED (drag end → persist) ──
      c.on('object:modified', (o: any) => {
        const obj = o.target; if (!obj) return
        const rec = obj as unknown as Record<string, unknown>
        if (rec.__devId && !rec.__fovDist && !rec.__fovEdge) {
          onDeviceMoved?.(rec.__devId as string, Math.round(obj.left ?? 0), Math.round(obj.top ?? 0))
        }
        if (rec.__fovDist || rec.__fovEdge) {
          onDragCommit?.(null)
        }
      })

      // ── OBJECT MOVING (real-time drag updates) ──
      c.on('object:moving', (o: any) => {
        const obj = o.target; if (!obj) return
        const rec = obj as unknown as Record<string, unknown>
        const now = Date.now()
        if (now - lastDragT.current < 16) return
        lastDragT.current = now

        // FOV distance handle
        if (rec.__fovDist) {
          const id = rec.__devId as string
          const cx = rec.__cx as number, cy = rec.__cy as number
          const dx = (obj.left ?? 0) - cx, dy = (obj.top ?? 0) - cy
          const distPx = Math.sqrt(dx * dx + dy * dy)
          const distFt = Math.max(1, Math.round(distPx / (scalePxPerFt || 10)))
          const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360
          onFovHandleDragged?.(id, distFt)
          onDeviceRotated?.(id, angle)
          return
        }

        // FOV angle handle
        if (rec.__fovEdge) {
          const id = rec.__devId as string
          const cx = rec.__cx as number, cy = rec.__cy as number
          const rotRad = rec.__rotRad as number
          const dx = (obj.left ?? 0) - cx, dy = (obj.top ?? 0) - cy
          let diff = Math.abs(Math.atan2(dy, dx) - rotRad)
          if (diff > Math.PI) diff = 2 * Math.PI - diff
          const fov = Math.round(Math.min(180, Math.max(5, diff * 2 * 180 / Math.PI)))
          onFovAngleChanged?.(id, fov)
          return
        }
      })
    }

    boot()
    return () => { dead = true; fcRef.current?.dispose(); fcRef.current = null; setReady(false) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ════════════════════════════════════════════════════════════════
  // KEYBOARD
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === ' ') { spaceDown.current = true; e.preventDefault() }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        onDeviceDelete?.(selRef.current)
      }
      if (e.key === 'Escape') { onSelectDevice(null); onToolChange?.('select') }
    }
    const up = (e: KeyboardEvent) => { if (e.key === ' ') spaceDown.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [onDeviceDelete, onSelectDevice, onToolChange])

  // ════════════════════════════════════════════════════════════════
  // RESIZE
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!containerRef.current || !fcRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      fcRef.current?.setDimensions({ width, height })
      fcRef.current?.requestRenderAll()
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [ready])

  // ════════════════════════════════════════════════════════════════
  // FLOOR PLAN
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!fcRef.current || !ready) return
    const c = fcRef.current
    if (fpObj.current) { c.remove(fpObj.current); fpObj.current = null }
    if (!floorPlan?.file_url) return

    ;(async () => {
      const fm = await import('fabric')
      try {
        const img = await fm.FabricImage.fromURL(floorPlan.file_url!, { crossOrigin: 'anonymous' })
        img.set({ left: 0, top: 0, opacity: floorPlanOpacity, selectable: false, evented: false })
        c.add(img); c.sendObjectToBack(img)
        fpObj.current = img
        c.requestRenderAll()
      } catch { onFloorPlanError?.('Failed to load floor plan') }
    })()
  }, [floorPlan?.file_url, floorPlanOpacity, ready])

  // ════════════════════════════════════════════════════════════════
  // GRID
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!fcRef.current || !ready) return
    const c = fcRef.current
    if (gridObj.current) { c.remove(gridObj.current); gridObj.current = null }
    if (!showGrid) return

    ;(async () => {
      const fm = await import('fabric')
      const dotC = document.createElement('canvas')
      dotC.width = GRID_SIZE; dotC.height = GRID_SIZE
      const ctx = dotC.getContext('2d')!
      ctx.fillStyle = resolveCanvasColor('--canvas-grid-dot', 'rgba(255,255,255,0.06)')
      ctx.beginPath(); ctx.arc(GRID_SIZE / 2, GRID_SIZE / 2, 0.8, 0, Math.PI * 2); ctx.fill()
      const pat = new fm.Pattern({ source: dotC, repeat: 'repeat' })
      const r = new fm.Rect({ left: -10000, top: -10000, width: 20000, height: 20000, fill: pat as unknown as string, selectable: false, evented: false })
      c.add(r); c.sendObjectToBack(r)
      gridObj.current = r
      c.requestRenderAll()
    })()
  }, [showGrid, ready])

  // ════════════════════════════════════════════════════════════════
  // THEME CHANGE — re‑apply canvas bg + grid dots when light/dark toggles
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!ready) return
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      const c = fcRef.current
      if (!c) return
      // Re-apply canvas background
      c.backgroundColor = resolveCanvasColor('--canvas-bg')
      // Rebuild grid dots with new dot color
      if (showGrid && gridObj.current) {
        ;(async () => {
          const fm = await import('fabric')
          c.remove(gridObj.current!)
          const dotC = document.createElement('canvas')
          dotC.width = GRID_SIZE; dotC.height = GRID_SIZE
          const ctx = dotC.getContext('2d')!
          ctx.fillStyle = resolveCanvasColor('--canvas-grid-dot', 'rgba(255,255,255,0.06)')
          ctx.beginPath(); ctx.arc(GRID_SIZE / 2, GRID_SIZE / 2, 0.8, 0, Math.PI * 2); ctx.fill()
          const pat = new fm.Pattern({ source: dotC, repeat: 'repeat' })
          const r = new fm.Rect({ left: -10000, top: -10000, width: 20000, height: 20000, fill: pat as unknown as string, selectable: false, evented: false })
          c.add(r); c.sendObjectToBack(r)
          gridObj.current = r
          c.requestRenderAll()
        })()
      } else {
        c.requestRenderAll()
      }
    })
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [ready, showGrid])

  // ════════════════════════════════════════════════════════════════
  // DEVICES
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!fcRef.current || !ready) return
    const c = fcRef.current

    // Remove old
    for (const [, o] of devObjs.current) c.remove(o)
    devObjs.current.clear()

    ;(async () => {
      const fm = await import('fabric')

      for (const dev of devices) {
        if (hiddenCategories?.has(dev.category)) continue
        const isSel = dev.id === selectedDeviceId
        const iconKey = CATEGORY_TO_ICON[dev.category] || 'generic'
        const svgStr = DEVICE_SVG_STRINGS[iconKey]

        try {
          let obj: FabricObject
          if (svgStr) {
            const res = await fm.loadSVGFromString(svgStr)
            const ico = fm.util.groupSVGElements(res.objects.filter(Boolean) as FabricObject[], res.options)
            const lbl = new fm.FabricText(dev.label || '', {
              left: 0, top: 22, fontSize: 10, fill: C.textMuted,
              fontFamily: "'IBM Plex Sans', sans-serif", originX: 'center', originY: 'top',
            })
            obj = new fm.Group([ico, lbl], {
              left: dev.position_x, top: dev.position_y,
              originX: 'center', originY: 'center', scaleX: 0.6, scaleY: 0.6,
              hasControls: false, hasBorders: false, lockRotation: true,
              selectable: true, evented: true,
              hoverCursor: 'move', moveCursor: 'move',
            })
          } else {
            obj = new fm.Circle({
              left: dev.position_x, top: dev.position_y, radius: 8, fill: C.accent,
              originX: 'center', originY: 'center',
              hasControls: false, hasBorders: false,
              selectable: true, evented: true, hoverCursor: 'move', moveCursor: 'move',
            })
          }

          // Tag for event handling
          const rec = obj as unknown as Record<string, unknown>
          rec.__devId = dev.id

          // Selection ring
          if (isSel) obj.set({ stroke: C.accent, strokeWidth: 2, padding: 4 } as Record<string, unknown>)

          c.add(obj)
          devObjs.current.set(dev.id, obj)
        } catch { /* SVG parse failed */ }
      }

      // Z-order: devices on top of cones
      for (const [, o] of devObjs.current) c.bringObjectToFront(o)
      c.requestRenderAll()
    })()
  }, [devices, selectedDeviceId, ready, hiddenCategories])

  // ════════════════════════════════════════════════════════════════
  // FOV CONES + HANDLES
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!fcRef.current || !ready) return
    const c = fcRef.current

    // Clear old
    for (const [, arr] of fovObjs.current) for (const o of arr) c.remove(o)
    fovObjs.current.clear()
    for (const [, h] of handleObjs.current) c.remove(h)
    handleObjs.current.clear()

    if (!showFovCones && !selectedDeviceId) { c.requestRenderAll(); return }

    ;(async () => {
      const fm = await import('fabric')

      for (const [devId, data] of fovData) {
        const dev = devices.find(d => d.id === devId)
        if (!dev) continue
        if (!showFovCones && devId !== selectedDeviceId) continue
        if (hiddenCategories?.has(dev.category)) continue

        const objects: FabricObject[] = []
        const cx = dev.position_x, cy = dev.position_y
        const halfAng = (data.hFov / 2) * Math.PI / 180
        const rotRad = (dev.rotation || 0) * Math.PI / 180

        // Draw tiers (outermost first)
        for (let t = 0; t < data.tiers.length; t++) {
          const tier = data.tiers[t]
          const r = tier.distanceFt * (scalePxPerFt || 10)
          if (r < 2) continue

          // Build cone polygon
          const steps = 24
          const pts: Array<{ x: number; y: number }> = [{ x: cx, y: cy }]
          for (let i = 0; i <= steps; i++) {
            const a = rotRad - halfAng + (2 * halfAng * i / steps)
            pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
          }

          let fillColor = data.colorHex || C.accent
          if (fovDisplayMode === 'ppf' || fovDisplayMode === 'dori') fillColor = tier.color

          const cone = new fm.Polygon(pts, {
            fill: fillColor, opacity: tier.opacity,
            stroke: t === 0 ? fillColor : 'transparent',
            strokeWidth: t === 0 ? 1 : 0,
            strokeDashArray: t === 0 ? [4, 4] : undefined,
            strokeOpacity: 0.3,
            selectable: false, evented: false,
          })
          c.add(cone)
          objects.push(cone)
        }

        // ── HANDLES (selected device only) ──
        if (devId === selectedDeviceId) {
          const outerR = (data.tiers[0]?.distanceFt || 30) * (scalePxPerFt || 10)
          if (outerR > 5) {
            // Handle 1: Distance (white circle at arc center)
            const dh_x = cx + Math.cos(rotRad) * outerR
            const dh_y = cy + Math.sin(rotRad) * outerR
            const distHandle = new fm.Circle({
              left: dh_x, top: dh_y, radius: 7,
              fill: '#ffffff', stroke: C.accent, strokeWidth: 2.5,
              originX: 'center', originY: 'center',
              selectable: true, evented: true,
              hasControls: false, hasBorders: false,
              hoverCursor: 'grab', moveCursor: 'grabbing',
            })
            const dRec = distHandle as unknown as Record<string, unknown>
            dRec.__fovDist = true; dRec.__devId = devId
            dRec.__cx = cx; dRec.__cy = cy
            c.add(distHandle)
            handleObjs.current.set(`${devId}_d`, distHandle)

            // Distance label
            const distFt = Math.round(data.tiers[0].distanceFt)
            const dLabel = new fm.FabricText(`${distFt}ft`, {
              left: dh_x + Math.cos(rotRad) * 18, top: dh_y + Math.sin(rotRad) * 18,
              fontSize: 11, fontWeight: '600', fill: C.accent,
              fontFamily: "'IBM Plex Mono', monospace",
              originX: 'center', originY: 'center',
              selectable: false, evented: false,
            })
            c.add(dLabel); objects.push(dLabel)

            // Handles 2 & 3: Angle (orange circles at cone edge)
            if (onFovAngleChanged) {
              const edgeR = outerR * 0.85
              for (const side of [-1, 1]) {
                const a = rotRad + side * halfAng
                const handle = new fm.Circle({
                  left: cx + Math.cos(a) * edgeR, top: cy + Math.sin(a) * edgeR,
                  radius: 6, fill: '#f97316', stroke: '#fff', strokeWidth: 2,
                  originX: 'center', originY: 'center',
                  selectable: true, evented: true,
                  hasControls: false, hasBorders: false,
                  hoverCursor: 'ew-resize', moveCursor: 'ew-resize',
                })
                const hRec = handle as unknown as Record<string, unknown>
                hRec.__fovEdge = true; hRec.__devId = devId
                hRec.__cx = cx; hRec.__cy = cy; hRec.__rotRad = rotRad
                c.add(handle)
                handleObjs.current.set(`${devId}_e${side}`, handle)
              }

              // Angle label
              const aLabel = new fm.FabricText(`${Math.round(data.hFov)}°`, {
                left: cx + Math.cos(rotRad) * outerR * 0.4,
                top: cy + Math.sin(rotRad) * outerR * 0.4 - 12,
                fontSize: 10, fontWeight: '600', fill: '#f97316',
                fontFamily: "'IBM Plex Mono', monospace",
                originX: 'center', originY: 'center',
                selectable: false, evented: false,
              })
              c.add(aLabel); objects.push(aLabel)
            }
          }
        }
        fovObjs.current.set(devId, objects)
      }

      // Z-ordering
      for (const [, arr] of fovObjs.current) for (const o of arr) c.sendObjectToBack(o)
      if (fpObj.current) c.sendObjectToBack(fpObj.current)
      if (gridObj.current) c.sendObjectToBack(gridObj.current)
      for (const [, o] of devObjs.current) c.bringObjectToFront(o)
      for (const [, h] of handleObjs.current) c.bringObjectToFront(h)
      c.requestRenderAll()
    })()
  }, [fovData, devices, showFovCones, selectedDeviceId, scalePxPerFt, ready, fovDisplayMode, hiddenCategories, onFovAngleChanged])

  // ════════════════════════════════════════════════════════════════
  // CABLES
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!fcRef.current || !ready) return
    const c = fcRef.current
    // Simple cable lines
    ;(async () => {
      const fm = await import('fabric')
      for (const cable of cables) {
        const from = devices.find(d => d.id === cable.from_device_id)
        const to = cable.to_device_id ? devices.find(d => d.id === cable.to_device_id) : null
        if (!from) continue
        const pts = [{ x: from.position_x, y: from.position_y }]
        if (cable.waypoints) for (const wp of cable.waypoints) pts.push(wp)
        if (to) pts.push({ x: to.position_x, y: to.position_y })
        const line = new fm.Polyline(pts, {
          fill: 'transparent', stroke: '#64748b', strokeWidth: 2,
          strokeDashArray: [6, 3], selectable: false, evented: false, opacity: 0.6,
        })
        c.add(line)
      }
      c.requestRenderAll()
    })()
  }, [cables, devices, ready])

  // ════════════════════════════════════════════════════════════════
  // SCALE VISUAL MARKERS (green endpoints + dashed line)
  // ════════════════════════════════════════════════════════════════
  const scaleObjs = useRef<FabricObject[]>([])
  useEffect(() => {
    if (!fcRef.current || !ready) return
    const c = fcRef.current
    // Clear previous markers
    for (const o of scaleObjs.current) c.remove(o)
    scaleObjs.current = []

    if (scalePts.length === 0) { c.requestRenderAll(); return }

    ;(async () => {
      const fm = await import('fabric')

      // Draw endpoint circles
      for (const pt of scalePts) {
        const circle = new fm.Circle({
          left: pt.x, top: pt.y, radius: 7,
          fill: '#22c55e', stroke: '#fff', strokeWidth: 2.5,
          originX: 'center', originY: 'center',
          selectable: false, evented: false,
        })
        c.add(circle)
        scaleObjs.current.push(circle)
      }

      // Draw dashed line between points
      if (scalePts.length >= 2) {
        const line = new fm.Line(
          [scalePts[0].x, scalePts[0].y, scalePts[1].x, scalePts[1].y],
          {
            stroke: '#22c55e', strokeWidth: 2, strokeDashArray: [8, 4],
            selectable: false, evented: false, opacity: 0.8,
          }
        )
        c.add(line)
        scaleObjs.current.push(line)

        // Distance label at midpoint
        const midX = (scalePts[0].x + scalePts[1].x) / 2
        const midY = (scalePts[0].y + scalePts[1].y) / 2
        const pxDist = Math.round(Math.sqrt(
          (scalePts[1].x - scalePts[0].x) ** 2 + (scalePts[1].y - scalePts[0].y) ** 2
        ))
        const label = new fm.FabricText(`${pxDist}px`, {
          left: midX, top: midY - 16,
          fontSize: 11, fontWeight: '600', fill: '#22c55e',
          fontFamily: "'Inter', sans-serif",
          originX: 'center', originY: 'center',
          selectable: false, evented: false,
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: 3,
        } as Record<string, unknown>)
        c.add(label)
        scaleObjs.current.push(label)
      }

      // Z-order: scale markers on top
      for (const o of scaleObjs.current) c.bringObjectToFront(o)
      c.requestRenderAll()
    })()
  }, [scalePts, ready])

  // ════════════════════════════════════════════════════════════════
  // SCALE SUBMIT
  // ════════════════════════════════════════════════════════════════
  const submitScale = useCallback((ft: number) => {
    if (scalePts.length < 2 || ft <= 0) return
    const px = Math.sqrt((scalePts[1].x - scalePts[0].x) ** 2 + (scalePts[1].y - scalePts[0].y) ** 2)
    const pxPerFt = px / ft
    onScaleCalibrated?.(pxPerFt)
    // Clear visual markers
    if (fcRef.current) {
      for (const o of scaleObjs.current) fcRef.current.remove(o)
      scaleObjs.current = []
      fcRef.current.requestRenderAll()
    }
    setScalePts([]); setScalePopup({ show: false, x: 0, y: 0 })
    onToolChange?.('select')
    toast.success(`Scale: ${pxPerFt.toFixed(1)} px/ft`)
  }, [scalePts, onScaleCalibrated, onToolChange])

  // ════════════════════════════════════════════════════════════════
  // CURSOR
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!containerRef.current) return
    const map: Record<string, string> = {
      select: 'default', place: 'crosshair', cable: 'crosshair',
      measure: 'crosshair', scale: 'crosshair', pan: 'grab',
      mdf_idf: 'crosshair', wall: 'crosshair', zone: 'crosshair', door: 'crosshair',
    }
    containerRef.current.style.cursor = map[activeTool] || 'default'
  }, [activeTool])

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div ref={containerRef}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { /* drop handler for catalog */ }}
      style={{ flex: 1, position: 'relative', overflow: 'hidden', background: C.bg }}>

      <canvas ref={canvasElRef} />

      {/* Status bar */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        padding: '4px 14px', borderRadius: 6, fontSize: 11, fontWeight: 500,
        background: 'rgba(0,0,0,0.75)', color: C.textMuted,
        pointerEvents: 'none', zIndex: 20,
      }}>
        {activeTool === 'select' && !selectedDeviceId && 'Click device to select • Space+drag to pan • Scroll to zoom'}
        {activeTool === 'select' && selectedDeviceId && 'Drag device to move • Drag handles to adjust FOV • Del to remove'}
        {activeTool === 'pan' && 'Drag to pan the canvas'}
        {activeTool === 'scale' && `Click ${scalePts.length === 0 ? 'first' : scalePts.length === 1 ? 'second' : ''} point`}
        {activeTool === 'cable' && 'Click device to start cable'}
        {activeTool === 'mdf_idf' && 'Click to place MDF/IDF'}
        {activeTool === 'measure' && 'Click two points to measure'}
        {activeTool === 'place' && 'Click to place device'}
      </div>

      {/* Scale popup */}
      {scalePopup.show && (
        <div style={{
          position: 'fixed', left: scalePopup.x, top: scalePopup.y - 60,
          background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: 12, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Distance (ft):</div>
          <form onSubmit={e => { e.preventDefault(); submitScale(parseFloat(((e.target as HTMLFormElement).elements.namedItem('d') as HTMLInputElement).value)) }}>
            <input name="d" autoFocus type="number" step="0.1" min="0.1"
              style={{ width: 80, padding: '4px 8px', background: C.bgActive, border: `1px solid ${C.accent}`, borderRadius: 4, color: C.text, fontSize: 12, outline: 'none' }} />
            <button type="submit" style={{ marginLeft: 6, padding: '4px 10px', background: C.accent, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Set</button>
          </form>
        </div>
      )}

      {/* PPF-at-cursor tooltip */}
      {ppfTooltip?.show && (
        <div style={{
          position: 'fixed', left: ppfTooltip.x + 16, top: ppfTooltip.y - 8,
          background: 'rgba(0,0,0,0.88)', borderRadius: 6, padding: '6px 10px',
          zIndex: 100, pointerEvents: 'none', whiteSpace: 'nowrap',
          border: `1px solid ${ppfTooltip.dori === 'identification' ? '#22c55e' : ppfTooltip.dori === 'recognition' ? '#eab308' : ppfTooltip.dori === 'observation' ? '#f97316' : ppfTooltip.dori === 'detection' ? '#ef4444' : '#555'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Inter', sans-serif" }}>
            {ppfTooltip.ppf} <span style={{ fontSize: 10, fontWeight: 500, color: '#aaa' }}>PPF</span>
          </div>
          <div style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
            color: ppfTooltip.dori === 'identification' ? '#22c55e' : ppfTooltip.dori === 'recognition' ? '#eab308' : ppfTooltip.dori === 'observation' ? '#f97316' : ppfTooltip.dori === 'detection' ? '#ef4444' : '#888',
          }}>
            {ppfTooltip.dori === 'none' ? 'Below Detection' : ppfTooltip.dori}
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
            {ppfTooltip.distFt}ft · {ppfTooltip.label}
          </div>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu.show && (
        <div style={{
          position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
          background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6,
          padding: 4, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: 130,
        }}>
          {[
            { label: 'Duplicate', fn: () => onDeviceCopy?.(ctxMenu.id) },
            { label: 'Delete', fn: () => onDeviceDelete?.(ctxMenu.id), danger: true },
          ].map(i => (
            <button key={i.label} onClick={() => { i.fn(); setCtxMenu(p => ({ ...p, show: false })) }}
              style={{
                display: 'block', width: '100%', padding: '6px 12px', background: 'transparent',
                border: 'none', textAlign: 'left', color: (i as { danger?: boolean }).danger ? C.red : C.text,
                fontSize: 12, cursor: 'pointer', borderRadius: 4, fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bgHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >{i.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}
