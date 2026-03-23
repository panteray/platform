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
  onMdfSelected?: (id: string) => void
  showIrRange?: boolean
  hiddenPpfZones?: Set<string>
  showBlindSpot?: boolean
  onWallSelected?: (id: string) => void
  zoomToPointRef?: React.MutableRefObject<((x: number, y: number) => void) | null>
}

/* ─── Resolve CSS variable to computed value (needed for <canvas> 2D context) ─── */
function resolveCanvasColor(varName: string, fallback = '#09090b'): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback
}

/* ─── Camera categories ─── */
const CAM_CATS = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']

/* ─── Wall–FOV clipping helper: clip polygon against a wall segment ─── */
function clipFovByWalls(
  pts: Array<{ x: number; y: number }>,
  walls: Array<{ id: string; points: Array<{ x: number; y: number }> }>,
  cx: number, cy: number,
): Array<{ x: number; y: number }> {
  // For each wall segment, clip points that are "behind" the wall from the camera's perspective
  let clipped = [...pts]
  for (const wall of walls) {
    for (let w = 0; w < wall.points.length - 1; w++) {
      const wa = wall.points[w], wb = wall.points[w + 1]
      const wallDx = wb.x - wa.x, wallDy = wb.y - wa.y
      // Which side is the camera on?
      const camSide = (wallDx * (cy - wa.y) - wallDy * (cx - wa.x))
      clipped = clipped.map(p => {
        const pSide = (wallDx * (p.y - wa.y) - wallDy * (p.x - wa.x))
        // If point is on opposite side of wall from camera, project it onto the wall
        if (camSide * pSide < 0) {
          // Ray from camera through p, intersect with wall segment
          const dx = p.x - cx, dy = p.y - cy
          const denom = dx * wallDy - dy * wallDx
          if (Math.abs(denom) > 0.001) {
            const t = ((wa.x - cx) * wallDy - (wa.y - cy) * wallDx) / denom
            if (t > 0) return { x: cx + dx * t, y: cy + dy * t }
          }
        }
        return p
      })
    }
  }
  return clipped
}

export function CanvasArea({
  designId, areaId, floorPlan, devices, cables, showGrid, activeTool,
  selectedDeviceId, showFovCones, fovData, scalePxPerFt,
  floorPlanOpacity = 0.6, fovDisplayMode = 'simple',
  onSelectDevice, onDeviceMoved, onDeviceRotated,
  onDeviceCopy, onDeviceDelete, onToolChange, onScaleCalibrated,
  onFovHandleDragged, onFovAngleChanged, onCanvasClick, onCableCreated,
  mdfIdfs, onMdfIdfPlaced, onMdfIdfDeleted, onDragCommit, onZoomChange,
  onFloorPlanError, hiddenCategories, zoomToPointRef,
  walls, onWallCreated, onWallDeleted, onMdfSelected,
  showIrRange, hiddenPpfZones, showBlindSpot, onWallSelected,
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

  // Cable draw state machine: idle → pick_source → routing → complete
  const cableState = useRef<'idle' | 'pick_source' | 'routing'>('idle')
  const cableSourceId = useRef<string | null>(null)
  const cableWaypoints = useRef<Array<{ x: number; y: number }>>([])
  const cablePreviewObjs = useRef<FabricObject[]>([])
  const cableMousePt = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

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
  const wallObjs = useRef<FabricObject[]>([])
  const mdfObjs = useRef(new Map<string, FabricObject[]>())
  const gridObj = useRef<FabricObject | null>(null)
  const fpObj = useRef<FabricObject | null>(null)

  // Wall drawing state
  const wallPts = useRef<Array<{ x: number; y: number }>>([])
  const wallPreviewObjs = useRef<FabricObject[]>([])

  // Throttle for real-time drag
  const lastDragT = useRef(0)

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ show: boolean; x: number; y: number; id: string; type: 'device' | 'mdf' | 'wall' }>({ show: false, x: 0, y: 0, id: '', type: 'device' })

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

        // Middle-click / Space → start panning
        if (e.button === 1 || spaceDown.current || toolRef.current === 'pan') {
          panning.current = true
          panOrigin.current = { x: e.clientX, y: e.clientY }
          c.setCursor('grabbing')
          e.preventDefault()
          return
        }

        // Right-click → context menu (devices, MDFs, walls)
        if (e.button === 2) {
          const target = c.findTarget(e)
          const rec = target as unknown as Record<string, unknown> | null
          if (rec?.__devId) {
            setCtxMenu({ show: true, x: e.clientX, y: e.clientY, id: rec.__devId as string, type: 'device' })
          } else if (rec?.__mdfId) {
            setCtxMenu({ show: true, x: e.clientX, y: e.clientY, id: rec.__mdfId as string, type: 'mdf' })
          } else if (rec?.__wallId) {
            setCtxMenu({ show: true, x: e.clientX, y: e.clientY, id: rec.__wallId as string, type: 'wall' })
          }
          e.preventDefault()
          return
        }

        // ── CABLE TOOL: clicking on a device ──
        const target = o.target
        if (toolRef.current === 'cable' && target) {
          const rec = target as unknown as Record<string, unknown>
          const devId = rec.__devId as string | undefined
          if (devId) {
            if (cableState.current === 'idle' || cableState.current === 'pick_source') {
              // Start cable from this device
              cableState.current = 'routing'
              cableSourceId.current = devId
              cableWaypoints.current = []
              return
            }
            if (cableState.current === 'routing' && devId !== cableSourceId.current) {
              // Complete cable: from source → waypoints → this device
              const srcDev = devsRef.current.find(d => d.id === cableSourceId.current)
              const endDev = devsRef.current.find(d => d.id === devId)
              if (srcDev && endDev) {
                // Calculate total cable length in feet
                const allPts = [
                  { x: srcDev.position_x, y: srcDev.position_y },
                  ...cableWaypoints.current,
                  { x: endDev.position_x, y: endDev.position_y },
                ]
                let totalPx = 0
                for (let i = 1; i < allPts.length; i++) {
                  totalPx += Math.hypot(allPts[i].x - allPts[i - 1].x, allPts[i].y - allPts[i - 1].y)
                }
                const ft = scalePxPerFt > 0 ? Math.round(totalPx / scalePxPerFt) : 0
                onCableCreated?.({
                  from_device_id: cableSourceId.current!,
                  to_device_id: devId,
                  waypoints: cableWaypoints.current,
                  length_ft: ft,
                })
              }
              // Reset cable state
              cableState.current = 'pick_source'
              cableSourceId.current = null
              cableWaypoints.current = []
              // Clear preview
              for (const obj of cablePreviewObjs.current) c.remove(obj)
              cablePreviewObjs.current = []
              c.requestRenderAll()
              return
            }
          }
          return
        }

        // Left-click on fabric object → select device or allow handle drag
        if (target) {
          const rec = target as unknown as Record<string, unknown>
          // Handle objects: allow Fabric default drag (don't return early)
          if (rec.__fovDist || rec.__fovEdge) {
            // Just select the device so handles stay visible
            onSelectDevice(rec.__devId as string)
            return  // Let Fabric handle the drag natively
          }
          if (rec.__devId) {
            onSelectDevice(rec.__devId as string)
            onToolChange?.('select')
            return
          }
          // Click on MDF icon → select MDF
          if (rec.__mdfId) {
            onMdfSelected?.(rec.__mdfId as string)
            onToolChange?.('select')
          }
          return
        }

        // Check if click is near a wall segment
        if (onWallSelected && walls && walls.length > 0) {
          const pt = c.getScenePoint(e)
          const threshold = 10
          for (const wall of walls) {
            for (let i = 1; i < wall.points.length; i++) {
              const p1 = wall.points[i - 1], p2 = wall.points[i]
              // Point-to-segment distance
              const dx = p2.x - p1.x, dy = p2.y - p1.y
              const len2 = dx * dx + dy * dy
              if (len2 === 0) continue
              const t = Math.max(0, Math.min(1, ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / len2))
              const projX = p1.x + t * dx, projY = p1.y + t * dy
              const dist = Math.sqrt((pt.x - projX) ** 2 + (pt.y - projY) ** 2)
              if (dist < threshold) {
                onWallSelected(wall.id)
                return
              }
            }
          }
        }

        // Click on empty canvas → tool actions or start panning
        const pt = c.getScenePoint(e)
        const x = Math.round(pt.x), y = Math.round(pt.y)
        switch (toolRef.current) {
          case 'place': onCanvasClick?.(x, y); break
          case 'mdf_idf': onMdfIdfPlaced?.(x, y); break
          case 'wall':
            // Wall drawing: click to add points, double-click/Enter to finish
            wallPts.current.push({ x, y })
            break
          case 'cable':
            // Routing state: add waypoint
            if (cableState.current === 'routing') {
              cableWaypoints.current.push({ x, y })
            }
            break
          case 'scale':
            setScalePts(prev => {
              const next = [...prev, { x, y }]
              if (next.length >= 2) {
                setScalePopup({ show: true, x: e.clientX, y: e.clientY })
              }
              return next.length > 2 ? [{ x, y }] : next
            })
            break
          default:
            // Default: deselect + start panning on empty canvas
            onSelectDevice(null)
            panning.current = true
            panOrigin.current = { x: e.clientX, y: e.clientY }
            c.setCursor('grabbing')
            break
        }
      })

      // ── MOUSE MOVE (pan + cable preview + PPF tooltip) ──
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

        // Wall live preview
        if (toolRef.current === 'wall' && wallPts.current.length > 0) {
          const pt = c.getScenePoint(e)
          for (const obj of wallPreviewObjs.current) c.remove(obj)
          wallPreviewObjs.current = []
          const allPts = [...wallPts.current, { x: pt.x, y: pt.y }]
          import('fabric').then(fm => {
            const line = new fm.Polyline(allPts, {
              fill: 'transparent', stroke: '#333', strokeWidth: 3,
              selectable: false, evented: false, opacity: 0.7,
            })
            c.add(line); wallPreviewObjs.current.push(line)
            // Dots at placed points
            for (const wp of wallPts.current) {
              const dot = new fm.Circle({
                left: wp.x, top: wp.y, radius: 4,
                fill: '#333', stroke: '#fff', strokeWidth: 1.5,
                originX: 'center', originY: 'center',
                selectable: false, evented: false,
              })
              c.add(dot); wallPreviewObjs.current.push(dot)
            }
            c.requestRenderAll()
          })
        }

        // Cable live preview
        if (toolRef.current === 'cable' && cableState.current === 'routing' && cableSourceId.current) {
          const pt = c.getScenePoint(e)
          cableMousePt.current = { x: pt.x, y: pt.y }
          // Clear old preview
          for (const obj of cablePreviewObjs.current) c.remove(obj)
          cablePreviewObjs.current = []
          const srcDev = devsRef.current.find(d => d.id === cableSourceId.current)
          if (srcDev) {
            const allPts = [
              { x: srcDev.position_x, y: srcDev.position_y },
              ...cableWaypoints.current,
              { x: pt.x, y: pt.y },
            ]
            import('fabric').then(fm => {
              const line = new fm.Polyline(allPts, {
                fill: 'transparent', stroke: '#0ea5e9', strokeWidth: 2,
                strokeDashArray: [8, 4], selectable: false, evented: false,
                opacity: 0.8,
              })
              // Draw dots at waypoints
              const dots: FabricObject[] = []
              for (const wp of cableWaypoints.current) {
                const dot = new fm.Circle({
                  left: wp.x - 3, top: wp.y - 3, radius: 3,
                  fill: '#0ea5e9', stroke: '#fff', strokeWidth: 1,
                  selectable: false, evented: false,
                })
                dots.push(dot)
              }
              c.add(line, ...dots)
              cablePreviewObjs.current = [line, ...dots]
              c.requestRenderAll()
            })
          }
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
      if (e.key === 'Enter') {
        // Finish wall drawing if in progress
        if (wallPts.current.length >= 2) {
          onWallCreated?.(wallPts.current)
          wallPts.current = []
          if (fcRef.current) {
            for (const obj of wallPreviewObjs.current) fcRef.current.remove(obj)
            wallPreviewObjs.current = []
            fcRef.current.requestRenderAll()
          }
          return
        }
      }
      if (e.key === 'Escape') {
        // Cancel wall drawing
        if (wallPts.current.length > 0) {
          wallPts.current = []
          if (fcRef.current) {
            for (const obj of wallPreviewObjs.current) fcRef.current.remove(obj)
            wallPreviewObjs.current = []
            fcRef.current.requestRenderAll()
          }
          return
        }
        // Cancel cable routing if in progress
        if (cableState.current === 'routing') {
          cableState.current = 'pick_source'
          cableSourceId.current = null
          cableWaypoints.current = []
          if (fcRef.current) {
            for (const obj of cablePreviewObjs.current) fcRef.current.remove(obj)
            cablePreviewObjs.current = []
            fcRef.current.requestRenderAll()
          }
          return
        }
        onSelectDevice(null); onToolChange?.('select')
      }
    }
    const up = (e: KeyboardEvent) => { if (e.key === ' ') spaceDown.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [onDeviceDelete, onSelectDevice, onToolChange, onWallCreated])

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

      // Camera type → PNG image mapping
      const CAT_TO_PNG: Record<string, string> = {
        cctv: '/devices/camera-types/dome.png',
        dome: '/devices/camera-types/dome.png',
        bullet: '/devices/camera-types/bullet.png',
        ptz: '/devices/camera-types/ptz.png',
        fisheye: '/devices/camera-types/fisheye.png',
        multisensor_quad: '/devices/camera-types/multisensor.png',
        multisensor_dual: '/devices/camera-types/multisensor_dual.png',
        turret: '/devices/camera-types/turret.png',
        box: '/devices/camera-types/box.png',
      }
      const ICON_SIZE = 28 // px on canvas

      for (const dev of devices) {
        if (hiddenCategories?.has(dev.category)) continue
        const isSel = dev.id === selectedDeviceId
        const pngUrl = CAT_TO_PNG[dev.category]

        try {
          let obj: FabricObject

          if (pngUrl) {
            // Use real camera PNG photo
            try {
              const img = await fm.FabricImage.fromURL(pngUrl, { crossOrigin: 'anonymous' })
              const scale = ICON_SIZE / Math.max(img.width || 64, img.height || 64)
              img.set({
                left: dev.position_x, top: dev.position_y,
                originX: 'center', originY: 'center',
                scaleX: scale, scaleY: scale,
                hasControls: false, hasBorders: false, lockRotation: true,
                selectable: true, evented: true,
                hoverCursor: 'move', moveCursor: 'move',
              })
              obj = img
            } catch {
              // PNG failed, fall back to SVG
              const iconKey = CATEGORY_TO_ICON[dev.category] || 'generic'
              const svgStr = DEVICE_SVG_STRINGS[iconKey]
              if (svgStr) {
                const res = await fm.loadSVGFromString(svgStr)
                const ico = fm.util.groupSVGElements(res.objects.filter(Boolean) as FabricObject[], res.options)
                obj = new fm.Group([ico], {
                  left: dev.position_x, top: dev.position_y,
                  originX: 'center', originY: 'center', scaleX: 0.4, scaleY: 0.4,
                  hasControls: false, hasBorders: false, lockRotation: true,
                  selectable: true, evented: true,
                  hoverCursor: 'move', moveCursor: 'move',
                })
              } else {
                obj = new fm.Circle({
                  left: dev.position_x, top: dev.position_y, radius: 10, fill: C.accent,
                  originX: 'center', originY: 'center',
                  hasControls: false, hasBorders: false,
                  selectable: true, evented: true, hoverCursor: 'move', moveCursor: 'move',
                })
              }
            }
          } else {
            // No PNG for this category — use SVG icon
            const iconKey = CATEGORY_TO_ICON[dev.category] || 'generic'
            const svgStr = DEVICE_SVG_STRINGS[iconKey]
            if (svgStr) {
              const res = await fm.loadSVGFromString(svgStr)
              const ico = fm.util.groupSVGElements(res.objects.filter(Boolean) as FabricObject[], res.options)
              obj = new fm.Group([ico], {
                left: dev.position_x, top: dev.position_y,
                originX: 'center', originY: 'center', scaleX: 0.4, scaleY: 0.4,
                hasControls: false, hasBorders: false, lockRotation: true,
                selectable: true, evented: true,
                hoverCursor: 'move', moveCursor: 'move',
              })
            } else {
              obj = new fm.Circle({
                left: dev.position_x, top: dev.position_y, radius: 10, fill: C.accent,
                originX: 'center', originY: 'center',
                hasControls: false, hasBorders: false,
                selectable: true, evented: true, hoverCursor: 'move', moveCursor: 'move',
              })
            }
          }

          // Tag for event handling
          const rec = obj as unknown as Record<string, unknown>
          rec.__devId = dev.id

          // Selection ring
          if (isSel) obj.set({ stroke: C.accent, strokeWidth: 2, padding: 4 } as Record<string, unknown>)

          c.add(obj)
          devObjs.current.set(dev.id, obj)
        } catch { /* icon load failed */ }
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

        // PTZ pan circle — IPVM-style large gray circle showing 360° range
        if (dev.category === 'ptz') {
          const panR = (data.tiers[0]?.distanceFt || 30) * (scalePxPerFt || 10)
          if (panR > 5) {
            const panCircle = new fm.Circle({
              left: cx, top: cy, radius: panR,
              fill: 'rgba(128,128,128,0.12)', stroke: 'rgba(128,128,128,0.25)',
              strokeWidth: 1, originX: 'center', originY: 'center',
              selectable: false, evented: false,
            })
            c.add(panCircle)
            objects.push(panCircle)
          }
        }

        // Sensor angles: multi-sensor cameras render one cone per sensor
        const sensorRotations = data.sensorAngles && data.sensorAngles.length > 1
          ? data.sensorAngles
          : [(dev.rotation || 0)]

        for (const sensorRot of sensorRotations) {
          const sRotRad = sensorRot * Math.PI / 180

          // Draw tiers (outermost first, IPVM-style graduated opacity)
          // Map tier colors → zone names for filtering
          const colorToZone: Record<string, string> = {
            '#22c55e': 'identification', '#eab308': 'recognition',
            '#f97316': 'observation', '#ef4444': 'detection',
          }
          for (let t = 0; t < data.tiers.length; t++) {
            const tier = data.tiers[t]
            const r = tier.distanceFt * (scalePxPerFt || 10)
            if (r < 2) continue

            // Skip hidden PPF zones
            const zoneName = colorToZone[tier.color]
            if (zoneName && hiddenPpfZones?.has(zoneName)) continue

            // Build cone polygon (24-step arc)
            const steps = 24
            const pts: Array<{ x: number; y: number }> = [{ x: cx, y: cy }]
            for (let i = 0; i <= steps; i++) {
              const a = sRotRad - halfAng + (2 * halfAng * i / steps)
              pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
            }

            let fillColor = data.colorHex || C.accent
            if (fovDisplayMode === 'ppf' || fovDisplayMode === 'dori') fillColor = tier.color

            // IPVM: inner tiers darker (higher PPF), outer tiers lighter
            const gradOpacity = tier.opacity * (1 + (data.tiers.length - 1 - t) * 0.15)

            // IPVM-style wall clipping: clip FOV polygon points behind walls
            const clippedPts = walls && walls.length > 0 ? clipFovByWalls(pts, walls, cx, cy) : pts

            const cone = new fm.Polygon(clippedPts, {
              fill: fillColor, opacity: Math.min(0.7, gradOpacity),
              stroke: t === 0 ? 'rgba(0,0,0,0.35)' : 'transparent',
              strokeWidth: t === 0 ? 1.5 : 0,
              selectable: false, evented: false,
            })
            c.add(cone)
            objects.push(cone)
          }

          // ── RED CENTERLINE (IPVM-style) — gated by showIrRange ──
          if (showIrRange !== false) {
            const outerRForLine = (data.tiers[0]?.distanceFt || 30) * (scalePxPerFt || 10)
            if (outerRForLine > 5) {
              const centerLine = new fm.Line(
                [cx, cy, cx + Math.cos(sRotRad) * outerRForLine, cy + Math.sin(sRotRad) * outerRForLine],
                { stroke: '#e53e3e', strokeWidth: 2, selectable: false, evented: false, opacity: 0.85 }
              )
              c.add(centerLine)
              objects.push(centerLine)
            }
          }
        } // end sensorRotations loop

        // ── BLIND SPOT CIRCLE (orange dashed) ──
        if (showBlindSpot && data.blindSpotFt && data.blindSpotFt > 0) {
          const blindR = data.blindSpotFt * (scalePxPerFt || 10)
          if (blindR > 2) {
            const blindCircle = new fm.Circle({
              left: cx, top: cy, radius: blindR,
              fill: 'rgba(249,115,22,0.08)',
              stroke: '#f97316', strokeWidth: 1.5,
              strokeDashArray: [4, 3],
              originX: 'center', originY: 'center',
              selectable: false, evented: false,
              opacity: 0.7,
            })
            c.add(blindCircle)
            objects.push(blindCircle)
          }
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

            // IPVM-style: Person silhouette icon on centerline above distance handle
            const personSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="18" viewBox="0 0 12 18"><circle cx="6" cy="3" r="2.5" fill="#333"/><path d="M2 7h8l-1.5 6H7l-.5 5h-1L5 13H3.5z" fill="#333"/></svg>`
            try {
              const pRes = await fm.loadSVGFromString(personSvg)
              const personIcon = fm.util.groupSVGElements(pRes.objects.filter(Boolean) as FabricObject[], pRes.options)
              personIcon.set({
                left: dh_x + Math.cos(rotRad - Math.PI / 2) * 14,
                top: dh_y + Math.sin(rotRad - Math.PI / 2) * 14,
                originX: 'center', originY: 'center',
                scaleX: 0.8, scaleY: 0.8,
                selectable: false, evented: false,
              })
              c.add(personIcon); objects.push(personIcon)
            } catch { /* ok */ }

            // IPVM-style HAoV handles: black circles with white border at arc corners
            if (onFovAngleChanged) {
              for (const side of [-1, 1]) {
                const a = rotRad + side * halfAng
                const handle = new fm.Circle({
                  left: cx + Math.cos(a) * outerR, top: cy + Math.sin(a) * outerR,
                  radius: 5.5, fill: '#222', stroke: '#fff', strokeWidth: 2,
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
                fontSize: 10, fontWeight: '600', fill: '#e53e3e',
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
  }, [fovData, devices, showFovCones, selectedDeviceId, scalePxPerFt, ready, fovDisplayMode, hiddenCategories, onFovAngleChanged, walls, showIrRange, hiddenPpfZones, showBlindSpot])

  // ════════════════════════════════════════════════════════════════
  // WALLS — IPVM-style dark polylines
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!fcRef.current || !ready) return
    const c = fcRef.current
    for (const o of wallObjs.current) c.remove(o)
    wallObjs.current = []
    if (!walls || walls.length === 0) { c.requestRenderAll(); return }

    ;(async () => {
      const fm = await import('fabric')
      for (const wall of walls) {
        if (wall.points.length < 2) continue
        // Wall line — dark thick stroke (IPVM: solid black)
        const wLine = new fm.Polyline(wall.points, {
          fill: 'transparent', stroke: '#222', strokeWidth: 3,
          selectable: false, evented: true, opacity: 0.85,
          hoverCursor: 'pointer',
        })
        ;(wLine as unknown as Record<string, unknown>).__wallId = wall.id
        c.add(wLine); wallObjs.current.push(wLine)

        // Endpoint dots
        for (const pt of [wall.points[0], wall.points[wall.points.length - 1]]) {
          const dot = new fm.Circle({
            left: pt.x, top: pt.y, radius: 3.5,
            fill: '#444', stroke: '#fff', strokeWidth: 1.5,
            originX: 'center', originY: 'center',
            selectable: false, evented: false,
          })
          c.add(dot); wallObjs.current.push(dot)
        }
      }
      // Z-order: walls above floor plan but below devices
      for (const o of wallObjs.current) {
        c.bringObjectToFront(o)
      }
      for (const [, o] of devObjs.current) c.bringObjectToFront(o)
      for (const [, h] of handleObjs.current) c.bringObjectToFront(h)
      c.requestRenderAll()
    })()
  }, [walls, ready])

  // ════════════════════════════════════════════════════════════════
  // MDF/IDF RENDERING — IPVM-style rack icons + dashed cable lines
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!fcRef.current || !ready) return
    const c = fcRef.current
    for (const [, arr] of mdfObjs.current) for (const o of arr) c.remove(o)
    mdfObjs.current.clear()
    if (!mdfIdfs || mdfIdfs.length === 0) { c.requestRenderAll(); return }

    ;(async () => {
      const fm = await import('fabric')
      const MDF_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#14b8a6']

      for (let mi = 0; mi < mdfIdfs.length; mi++) {
        const mdf = mdfIdfs[mi]
        const objs: FabricObject[] = []
        const mdfColor = MDF_COLORS[mi % MDF_COLORS.length]

        // Rack icon SVG (IPVM-style green server rack)
        const rackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="6" y="4" width="20" height="24" rx="2" fill="${mdfColor}" opacity="0.9"/><rect x="9" y="8" width="14" height="3" rx="1" fill="#fff" opacity="0.6"/><rect x="9" y="13" width="14" height="3" rx="1" fill="#fff" opacity="0.6"/><rect x="9" y="18" width="14" height="3" rx="1" fill="#fff" opacity="0.6"/><circle cx="20" cy="9.5" r="1" fill="#22c55e"/><circle cx="20" cy="14.5" r="1" fill="#22c55e"/><circle cx="20" cy="19.5" r="1" fill="#22c55e"/></svg>`

        try {
          const res = await fm.loadSVGFromString(rackSvg)
          const ico = fm.util.groupSVGElements(res.objects.filter(Boolean) as FabricObject[], res.options)
          // Label below icon
          const lbl = new fm.FabricText(mdf.name || 'MDF', {
            left: 0, top: 20, fontSize: 10, fill: C.text,
            fontFamily: "'IBM Plex Sans', sans-serif", originX: 'center', originY: 'top',
            fontWeight: '600',
          })
          const group = new fm.Group([ico, lbl], {
            left: mdf.position_x, top: mdf.position_y,
            originX: 'center', originY: 'center',
            hasControls: false, hasBorders: false,
            selectable: true, evented: true,
            hoverCursor: 'move', moveCursor: 'move',
          })
          const rec = group as unknown as Record<string, unknown>
          rec.__mdfId = mdf.id
          c.add(group); objs.push(group)
        } catch { /* ok */ }

        // Draw dashed cable lines from MDF to all devices with cables (IPVM-style)
        // Derive connections from cables that reference devices near MDF
        for (const dev of devices) {
          const hasCable = cables.some(cb =>
            (cb.from_device_id === dev.id && cb.to_device_id === mdf.id) ||
            (cb.from_device_id === mdf.id && cb.to_device_id === dev.id)
          )
          if (!hasCable) continue
          const cable = new fm.Line(
            [mdf.position_x, mdf.position_y, dev.position_x, dev.position_y],
            {
              stroke: mdfColor, strokeWidth: 1.5,
              strokeDashArray: [8, 5], selectable: false, evented: false,
              opacity: 0.5,
            }
          )
          c.add(cable); objs.push(cable)
        }

        mdfObjs.current.set(mdf.id, objs)
      }

      // Z-order: MDF icons on top
      for (const [, arr] of mdfObjs.current) for (const o of arr) c.bringObjectToFront(o)
      for (const [, o] of devObjs.current) c.bringObjectToFront(o)
      for (const [, h] of handleObjs.current) c.bringObjectToFront(h)
      c.requestRenderAll()
    })()
  }, [mdfIdfs, devices, ready])

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
        {activeTool === 'select' && !selectedDeviceId && 'Click device to select • Drag empty area to pan • Scroll to zoom'}
        {activeTool === 'select' && selectedDeviceId && 'Drag device to move • Drag handles to adjust FOV • Del to remove'}
        {activeTool === 'pan' && 'Drag to pan the canvas'}
        {activeTool === 'scale' && `Click ${scalePts.length === 0 ? 'first' : scalePts.length === 1 ? 'second' : ''} point`}
        {activeTool === 'cable' && 'Click device to start cable • Click waypoints • Click device to end • Esc to cancel'}
        {activeTool === 'wall' && 'Click to place wall points • Enter to finish • Esc to cancel'}
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

      {/* Context menu — works for devices, MDFs, and walls */}
      {ctxMenu.show && (
        <div style={{
          position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
          background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6,
          padding: 4, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: 130,
        }}>
          {/* Type label */}
          <div style={{ padding: '4px 12px 2px', fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {ctxMenu.type === 'device' ? 'Camera' : ctxMenu.type === 'mdf' ? 'MDF/IDF' : 'Wall'}
          </div>
          {([
            ...(ctxMenu.type === 'device' ? [{ label: 'Duplicate', fn: () => onDeviceCopy?.(ctxMenu.id) }] : []),
            {
              label: 'Delete', danger: true,
              fn: () => {
                if (ctxMenu.type === 'device') onDeviceDelete?.(ctxMenu.id)
                else if (ctxMenu.type === 'mdf') onMdfIdfDeleted?.(ctxMenu.id)
                else if (ctxMenu.type === 'wall') onWallDeleted?.(ctxMenu.id)
              },
            },
          ] as Array<{ label: string; fn: () => void; danger?: boolean }>).map(i => (
            <button key={i.label} onClick={() => { i.fn(); setCtxMenu(p => ({ ...p, show: false })) }}
              style={{
                display: 'block', width: '100%', padding: '6px 12px', background: 'transparent',
                border: 'none', textAlign: 'left', color: i.danger ? C.red : C.text,
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
