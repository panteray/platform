'use client'
/// <reference types="google.maps" />
/**
 * CanvasArea — Google Maps native canvas with device markers, FOV polygons, and drag interactions.
 *
 * Replaces Fabric.js entirely. Uses Google Maps as the canvas:
 *   - Satellite view as background
 *   - Device positions as google.maps.Marker (draggable when selected)
 *   - FOV cones as google.maps.Polygon
 *   - Floor plans as google.maps.GroundOverlay
 *   - Native pan (drag) and zoom (scroll wheel)
 *
 * Pixel coordinates stored in DB are converted to lat/lng via geo-math.ts
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { C, type CanvasTool } from './constants'
import {
  canvasPixelsToLatLng,
  latLngToCanvasPixels,
  generateFovConePolygon,
  generateCirclePolygon,
  feetPerPixelAtZoom,
  destinationPoint,
  distanceFt as haversineDistanceFt,
  bearing as bearingFromTo,
  type DesignGeoContext,
} from './geo-math'
import type { DesignDevice, DesignCable, DesignFloorPlan, DesignMdfIdf } from '@/types/database'
import type { DeviceFovData, FovTier } from './fov-data-types'
import { useMapsApiKey } from './use-maps-api-key'

export type { DeviceFovData, FovTier } from './fov-data-types'

// Types for Google Maps API
type GMap = google.maps.Map
type GMarker = google.maps.Marker
type GPolygon = google.maps.Polygon
type GOverlay = google.maps.GroundOverlay

/* ─── Props ─── */
interface Props {
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
  floorPlanOpacity?: number
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
  onCableUpdated?: (cableId: string, waypoints: Array<{ x: number; y: number }>, lengthFt: number) => void
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
  geoContext?: DesignGeoContext | null
  onFloorPlanError?: (msg: string) => void
  onZoomChange?: (zoom: number) => void
  walls?: Array<{ id: string; points: Array<{ x: number; y: number }>; color?: string; opacity?: number }>
  onWallCreated?: (pts: Array<{ x: number; y: number }>) => void
  onWallDeleted?: (id: string) => void
  onWallUpdated?: (id: string, updates: Record<string, unknown>) => void
  selectedWallId?: string | null
  onDeviceUpdateProp?: (id: string, prop: string, val: any) => void
  onUndo?: () => void
  onRedo?: () => void
  snapToGrid?: boolean
  onMdfIdfMoved?: (id: string, x: number, y: number) => void
  onMdfIdfDeleted?: (id: string) => void
  onShow3dPreview?: (device: DesignDevice) => void
  onMdfSelected?: (id: string) => void
  showIrRange?: boolean
  hiddenPpfZones?: Set<string>
  showBlindSpot?: boolean
  onWallSelected?: (id: string | null) => void
  onSelectImager?: (idx: number | null) => void
  zoomToPointRef?: React.MutableRefObject<((x: number, y: number) => void) | null>
  canvasActionsRef?: React.MutableRefObject<{ zoomIn: () => void; zoomOut: () => void; fitToView: () => void } | null>
}

/* ─── Device icon mapping (PNG fallback for non-camera devices) ─── */
const CAT_TO_PNG: Record<string, string> = {
  cctv: '/icons/cctv/dome.png',
  dome: '/icons/cctv/dome.png',
  bullet: '/icons/cctv/bullet.png',
  ptz: '/icons/cctv/PTZ.png',
  fisheye: '/icons/cctv/fisheye.png',
  multisensor_quad: '/icons/cctv/multisensor.png',
  multisensor_dual: '/icons/cctv/dualsensor.png',
  turret: '/icons/cctv/turret.png',
}

/* ─── Camera marker SVG paths (google.maps.Symbol supports rotation) ─── */
// Circle with a notch/wedge pointing in the aim direction (0° = East in canvas coords).
// Path is drawn centered at 0,0 in a 24x24 viewBox. The notch points RIGHT (0°).
// google.maps.Symbol rotation property rotates this.
const CAMERA_SVG_PATHS: Record<string, string> = {
  // Standard dome/turret — circle with direction notch
  dome:   'M 0,-10 A 10,10 0 1,0 0,10 A 10,10 0 1,0 0,-10 Z M 8,-4 L 14,0 L 8,4 Z',
  turret: 'M 0,-10 A 10,10 0 1,0 0,10 A 10,10 0 1,0 0,-10 Z M 8,-4 L 14,0 L 8,4 Z',
  cctv:   'M 0,-10 A 10,10 0 1,0 0,10 A 10,10 0 1,0 0,-10 Z M 8,-4 L 14,0 L 8,4 Z',
  // Bullet — elongated rectangle with aim arrow
  bullet: 'M -8,-6 L 8,-6 L 12,0 L 8,6 L -8,6 Z',
  // PTZ — circle with crosshair notch
  ptz:    'M 0,-10 A 10,10 0 1,0 0,10 A 10,10 0 1,0 0,-10 Z M 8,-5 L 16,0 L 8,5 Z',
  // Fisheye — full circle (no direction notch — 360° view)
  fisheye: 'M 0,-10 A 10,10 0 1,0 0,10 A 10,10 0 1,0 0,-10 Z',
  // Multi-sensor — circle with multiple notches
  multisensor_quad: 'M 0,-10 A 10,10 0 1,0 0,10 A 10,10 0 1,0 0,-10 Z M 8,-3 L 13,0 L 8,3 Z M -8,-3 L -13,0 L -8,3 Z',
  multisensor_dual: 'M 0,-10 A 10,10 0 1,0 0,10 A 10,10 0 1,0 0,-10 Z M 8,-3 L 13,0 L 8,3 Z',
}

const CAMERA_CATEGORIES = new Set([
  'cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual',
])

/** Screen pixel distance between two lat/lng positions on a Google Map.
 *  Uses the map's world projection + zoom to compute pixel separation. */
function screenPixelDist(
  map: google.maps.Map,
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const proj = map.getProjection()
  if (!proj) return Infinity
  const scale = 1 << (map.getZoom() ?? 1)
  const a = proj.fromLatLngToPoint(new google.maps.LatLng(lat1, lng1))
  const b = proj.fromLatLngToPoint(new google.maps.LatLng(lat2, lng2))
  if (!a || !b) return Infinity
  const dx = (a.x - b.x) * scale
  const dy = (a.y - b.y) * scale
  return Math.sqrt(dx * dx + dy * dy)
}

/** Distance from point (px,py) to line segment (ax,ay)→(bx,by) in pixels */
function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  const projX = ax + t * dx, projY = ay + t * dy
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

/** Signed angle difference (shortest path), result in [-180, 180] */
function angleDiff(a: number, b: number): number {
  let d = ((a - b + 540) % 360) - 180
  return d
}

/** Build a google.maps.Symbol for camera devices (supports rotation) */
function buildCameraSymbol(
  category: string,
  rotation: number,
  isSelected: boolean,
): google.maps.Symbol {
  const path = CAMERA_SVG_PATHS[category] || CAMERA_SVG_PATHS.dome
  // Canvas convention: 0° = East. google.maps.Symbol rotation: 0° = North, clockwise.
  // So canvas 0° (East) = Symbol 90°. Offset +90.
  const symbolRotation = (rotation + 90 + 360) % 360
  return {
    path,
    rotation: symbolRotation,
    fillColor: isSelected ? '#6d28d9' : '#1e293b',
    fillOpacity: isSelected ? 1.0 : 0.85,
    strokeColor: isSelected ? '#a78bfa' : '#64748b',
    strokeWeight: isSelected ? 2.5 : 1.5,
    scale: isSelected ? 1.6 : 1.3,
    anchor: new google.maps.Point(0, 0),
  }
}

const COLOR_TO_ZONE: Record<string, string> = {
  '#8b5cf6': 'inspection',
  '#22c55e': 'identification',
  '#eab308': 'recognition',
  '#f97316': 'observation',
  '#ef4444': 'detection',
  '#6b7280': 'monitor',
}

/**
 * CanvasArea — Google Maps-based design canvas
 */
function CanvasArea(props: Props) {
  const {
    designId,
    areaId,
    floorPlan,
    devices,
    cables,
    showGrid,
    activeTool,
    selectedDeviceId,
    showFovCones,
    fovData,
    scalePxPerFt,
    floorPlanOpacity = 1,
    fovDisplayMode = 'simple',
    onSelectDevice,
    onDeviceMoved,
    onDeviceRotated,
    onDeviceCopy,
    onDeviceDelete,
    onToolChange,
    onScaleCalibrated,
    onFovHandleDragged,
    onFovAngleChanged,
    onCanvasClick,
    onCableCreated,
    onCableUpdated,
    mdfIdfs,
    onMdfIdfPlaced,
    onDragCommit,
    highlightedPpfTier,
    onPpfTierClick,
    hiddenCategories,
    pendingDeviceName,
    onDeviceDrop,
    snapshotRef,
    viewportCenterRef,
    satelliteConfig,
    geoContext,
    onFloorPlanError,
    onZoomChange,
    walls,
    onWallCreated,
    onWallDeleted,
    onWallUpdated,
    selectedWallId,
    onDeviceUpdateProp,
    onUndo,
    onRedo,
    snapToGrid,
    onMdfIdfMoved,
    onMdfIdfDeleted,
    onShow3dPreview,
    onMdfSelected,
    showIrRange,
    hiddenPpfZones,
    showBlindSpot,
    onWallSelected,
    onSelectImager,
    zoomToPointRef,
    canvasActionsRef,
  } = props

  const mapsApiKey = useMapsApiKey()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GMap | null>(null)
  const markersRef = useRef<Map<string, GMarker>>(new Map())
  const polygonsRef = useRef<GPolygon[]>([])
  const selectedDevicePolygonsRef = useRef<GPolygon[]>([])
  const groundOverlayRef = useRef<GOverlay | null>(null)
  const contextMenuRef = useRef<{ deviceId: string; x: number; y: number } | null>(null)
  const draggingDeviceRef = useRef<string | null>(null)
  // Cable drawing state — MDF first → Device → then route waypoints
  const cableDrawRef = useRef<{
    phase: 'pick_mdf' | 'routing'
    mdfId?: string
    mdfPx?: { x: number; y: number }
    deviceId?: string
    devicePx?: { x: number; y: number }
    waypoints: Array<{ x: number; y: number }>
  } | null>(null)
  const cablePreviewRef = useRef<google.maps.Polyline | null>(null)
  const cableLabelRef = useRef<google.maps.Marker | null>(null)
  const cableMoveListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const cableSnapHighlightRef = useRef<google.maps.Marker | null>(null)
  const cableWaypointPreviewRef = useRef<google.maps.Marker | null>(null)
  const activeToolRef = useRef(activeTool)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  const mdfMarkersRef = useRef<Map<string, GMarker>>(new Map())
  const cablePolylinesRef = useRef<google.maps.Polyline[]>([])
  const cableWaypointMarkersRef = useRef<google.maps.Marker[]>([])
  const cablesRef = useRef(cables)
  useEffect(() => { cablesRef.current = cables }, [cables])
  const wallPolylinesRef = useRef<google.maps.Polyline[]>([])

  // ── Wall drawing state ──
  const wallDrawRef = useRef<{ points: Array<{ x: number; y: number }> } | null>(null)
  const wallPreviewRef = useRef<google.maps.Polyline | null>(null)
  const wallFollowerRef = useRef<google.maps.Polyline | null>(null)
  const wallSnapMarkerRef = useRef<google.maps.Marker | null>(null)
  const wallMoveListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const wallVertexMarkersRef = useRef<google.maps.Marker[]>([])

  const fovPolygonListenersRef = useRef<google.maps.MapsEventListener[]>([])
  const isDraggingFovRef = useRef(false)
  // IPVM-style drag handles: per-sensor person icon (rotation+distance) + 2 arc-edge circles (FOV angle)
  const fovHandleMarkersRef = useRef<GMarker[]>([])
  const fovAngleHandlePairsRef = useRef<[GMarker, GMarker][]>([])
  const pendingRotationRef = useRef<number | null>(null)
  const pendingDistanceRef = useRef<number | null>(null)
  const pendingFovAngleRef = useRef<number | null>(null)
  const dragDeviceIdRef = useRef<string | null>(null)
  const dragSensorIdxRef = useRef<number>(0)
  const [contextMenuVisible, setContextMenuVisible] = useState(false)

  // Stable refs for callbacks used inside Google Maps event listeners (avoid stale closures)
  const geoContextRef = useRef(geoContext)
  useEffect(() => { geoContextRef.current = geoContext }, [geoContext])
  const onSelectDeviceRef = useRef(onSelectDevice)
  useEffect(() => { onSelectDeviceRef.current = onSelectDevice }, [onSelectDevice])
  const onDeviceMovedRef = useRef(onDeviceMoved)
  useEffect(() => { onDeviceMovedRef.current = onDeviceMoved }, [onDeviceMoved])
  const onCanvasClickRef = useRef(onCanvasClick)
  useEffect(() => { onCanvasClickRef.current = onCanvasClick }, [onCanvasClick])
  const selectedDeviceIdRef = useRef(selectedDeviceId)
  useEffect(() => { selectedDeviceIdRef.current = selectedDeviceId }, [selectedDeviceId])
  const devicesRef = useRef(devices)
  useEffect(() => { devicesRef.current = devices }, [devices])
  const onZoomChangeRef = useRef(onZoomChange)
  useEffect(() => { onZoomChangeRef.current = onZoomChange }, [onZoomChange])
  const satelliteConfigRef = useRef(satelliteConfig)
  useEffect(() => { satelliteConfigRef.current = satelliteConfig }, [satelliteConfig])
  const onFovHandleDraggedRef = useRef(onFovHandleDragged)
  useEffect(() => { onFovHandleDraggedRef.current = onFovHandleDragged }, [onFovHandleDragged])
  const onFovAngleChangedRef = useRef(onFovAngleChanged)
  useEffect(() => { onFovAngleChangedRef.current = onFovAngleChanged }, [onFovAngleChanged])
  const onDeviceRotatedRef = useRef(onDeviceRotated)
  useEffect(() => { onDeviceRotatedRef.current = onDeviceRotated }, [onDeviceRotated])
  const fovDataRef = useRef(fovData)
  useEffect(() => { fovDataRef.current = fovData }, [fovData])
  const onDeviceUpdatePropRef = useRef(onDeviceUpdateProp)
  useEffect(() => { onDeviceUpdatePropRef.current = onDeviceUpdateProp }, [onDeviceUpdateProp])
  const onMdfIdfMovedRef = useRef(onMdfIdfMoved)
  useEffect(() => { onMdfIdfMovedRef.current = onMdfIdfMoved }, [onMdfIdfMoved])
  const onMdfSelectedRef = useRef(onMdfSelected)
  useEffect(() => { onMdfSelectedRef.current = onMdfSelected }, [onMdfSelected])
  const onMdfIdfDeletedRef = useRef(onMdfIdfDeleted)
  useEffect(() => { onMdfIdfDeletedRef.current = onMdfIdfDeleted }, [onMdfIdfDeleted])
  const mdfIdfsRef = useRef(mdfIdfs)
  useEffect(() => { mdfIdfsRef.current = mdfIdfs }, [mdfIdfs])
  // Cable click handler ref — avoids stale closure in marker listeners
  const handleCableClickRef = useRef<(id: string, type: 'device' | 'mdf', px: number, py: number) => void>(() => {})
  const onCableCreatedRef = useRef(onCableCreated)
  useEffect(() => { onCableCreatedRef.current = onCableCreated }, [onCableCreated])
  const onCableUpdatedRef = useRef(onCableUpdated)
  useEffect(() => { onCableUpdatedRef.current = onCableUpdated }, [onCableUpdated])
  const onToolChangeRef = useRef(onToolChange)
  useEffect(() => { onToolChangeRef.current = onToolChange }, [onToolChange])
  const onWallCreatedRef = useRef(onWallCreated)
  useEffect(() => { onWallCreatedRef.current = onWallCreated }, [onWallCreated])
  const onWallUpdatedRef = useRef(onWallUpdated)
  useEffect(() => { onWallUpdatedRef.current = onWallUpdated }, [onWallUpdated])
  const onWallSelectedRef = useRef(onWallSelected)
  useEffect(() => { onWallSelectedRef.current = onWallSelected }, [onWallSelected])
  const wallsRef = useRef(walls)
  useEffect(() => { wallsRef.current = walls }, [walls])
  const selectedWallIdRef = useRef(selectedWallId)
  useEffect(() => { selectedWallIdRef.current = selectedWallId }, [selectedWallId])
  const wallVertexEditMarkersRef = useRef<google.maps.Marker[]>([])

  // ── Cable drawing helpers ──
  const cleanupCableDraw = useCallback(() => {
    cableDrawRef.current = null
    cableMoveListenerRef.current?.remove()
    cableMoveListenerRef.current = null
    cablePreviewRef.current?.setMap(null)
    cablePreviewRef.current = null
    cableLabelRef.current?.setMap(null)
    cableLabelRef.current = null
    cableSnapHighlightRef.current?.setMap(null)
    cableSnapHighlightRef.current = null
    cableWaypointPreviewRef.current?.setMap(null)
    cableWaypointPreviewRef.current = null
  }, [])

  const calcWaypointLengthFt = useCallback((pts: Array<{ x: number; y: number }>) => {
    let total = 0
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x
      const dy = pts[i].y - pts[i - 1].y
      total += Math.sqrt(dx * dx + dy * dy)
    }
    return scalePxPerFt > 0 ? Math.round(total / scalePxPerFt) : Math.round(total)
  }, [scalePxPerFt])

  // Show/update the preview polyline + length label
  const showCablePreview = useCallback((pts: Array<{ x: number; y: number }>, mouseLat?: number, mouseLng?: number) => {
    const ctx = geoContextRef.current
    if (!ctx || !mapRef.current) return
    const path = pts.map(pt => canvasPixelsToLatLng(pt.x, pt.y, ctx))
    if (mouseLat !== undefined && mouseLng !== undefined) path.push({ lat: mouseLat, lng: mouseLng })

    if (!cablePreviewRef.current) {
      cablePreviewRef.current = new google.maps.Polyline({
        path, strokeColor: '#f97316', strokeOpacity: 0, strokeWeight: 0,
        map: mapRef.current, clickable: false, zIndex: 5,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#f97316', scale: 2.5 }, offset: '0', repeat: '8px' }],
      })
    } else {
      cablePreviewRef.current.setPath(path)
    }

    // Length label
    const mousePixel = (mouseLat !== undefined && mouseLng !== undefined)
      ? latLngToCanvasPixels(mouseLat, mouseLng, ctx) : null
    const allPts = mousePixel ? [...pts, mousePixel] : pts
    const ft = calcWaypointLengthFt(allPts)
    const lastPt = path[path.length - 1]
    // Use a Marker with label for distance display (non-clickable, doesn't block clicks)
    if (!cableLabelRef.current) {
      cableLabelRef.current = new google.maps.Marker({
        position: lastPt,
        map: mapRef.current,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: { text: `${ft} ft`, color: '#f97316', fontWeight: 'bold', fontSize: '13px' },
        clickable: false,
        zIndex: 20,
      })
    } else {
      cableLabelRef.current.setLabel({ text: `${ft} ft`, color: '#f97316', fontWeight: 'bold', fontSize: '13px' })
      if (lastPt) cableLabelRef.current.setPosition(lastPt)
    }
  }, [calcWaypointLengthFt])

  // Finish cable routing: commits the cable to DB
  // Sends mdfId as from_device_id so design-canvas.tsx routing detects it and moves to mdf_idf_id
  const finishCableRouting = useCallback(() => {
    const draw = cableDrawRef.current
    if (!draw || draw.phase !== 'routing' || !draw.mdfPx || !draw.devicePx || !draw.deviceId || !draw.mdfId) return

    const allWaypoints = [draw.mdfPx, ...draw.waypoints, draw.devicePx]
    const lengthFt = calcWaypointLengthFt(allWaypoints)

    onCableCreatedRef.current?.({
      from_device_id: draw.mdfId,
      to_device_id: draw.deviceId,
      waypoints: allWaypoints,
      length_ft: lengthFt,
    })

    cleanupCableDraw()
    onToolChangeRef.current?.('select')
  }, [calcWaypointLengthFt, cleanupCableDraw])

  // IPVM flow: Click MDF → click map for waypoints → click device to finish
  const handleCableClick = useCallback((id: string, type: 'device' | 'mdf', px: number, py: number) => {
    const draw = cableDrawRef.current

    // ── Phase: pick_mdf — first click must be MDF ──
    if (!draw || draw.phase === 'pick_mdf') {
      if (type !== 'mdf') return // ignore non-MDF clicks
      // Go straight to routing — no pick_device phase (IPVM pattern)
      cableDrawRef.current = { phase: 'routing', mdfId: id, mdfPx: { x: px, y: py }, waypoints: [] }
      // Show preview from MDF following mouse
      const ctx = geoContextRef.current
      if (mapRef.current && ctx) {
        cableMoveListenerRef.current = mapRef.current.addListener('mousemove', (e: google.maps.MapMouseEvent) => {
          const d = cableDrawRef.current
          if (!d || !e.latLng || d.phase !== 'routing' || !d.mdfPx) return
          const mouseLat = e.latLng.lat(), mouseLng = e.latLng.lng()

          // Rubber-band preview: MDF → waypoints → cursor
          const routePts = [d.mdfPx, ...d.waypoints]
          showCablePreview(routePts, mouseLat, mouseLng)

          // ── Snap highlight: green ring around nearest device within snap radius ──
          const SNAP_PX = 30 // screen pixel snap (IPVM standard)
          const devs = devicesRef.current
          let snapped = false
          for (const dev of devs) {
            const devPos = canvasPixelsToLatLng(dev.position_x, dev.position_y, ctx)
            if (mapRef.current && screenPixelDist(mapRef.current, mouseLat, mouseLng, devPos.lat, devPos.lng) < SNAP_PX) {
              if (!cableSnapHighlightRef.current) {
                cableSnapHighlightRef.current = new google.maps.Marker({
                  position: devPos, map: mapRef.current!, clickable: false, zIndex: 15,
                  icon: { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#22c55e', fillOpacity: 0.25, strokeColor: '#22c55e', strokeWeight: 2 },
                })
              } else {
                cableSnapHighlightRef.current.setPosition(devPos)
                cableSnapHighlightRef.current.setMap(mapRef.current!)
              }
              snapped = true
              break
            }
          }
          if (!snapped) cableSnapHighlightRef.current?.setMap(null)

          // ── Waypoint preview dot at cursor ──
          if (!cableWaypointPreviewRef.current) {
            cableWaypointPreviewRef.current = new google.maps.Marker({
              position: { lat: mouseLat, lng: mouseLng }, map: mapRef.current!, clickable: false, zIndex: 12,
              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 4, fillColor: '#f97316', fillOpacity: 0.6, strokeColor: '#f97316', strokeWeight: 1 },
            })
          } else {
            cableWaypointPreviewRef.current.setPosition({ lat: mouseLat, lng: mouseLng })
            cableWaypointPreviewRef.current.setMap(mapRef.current!)
          }
        })
      }
      return
    }

    // ── Phase: routing — clicking a device finishes the cable ──
    if (draw.phase === 'routing' && type === 'device') {
      draw.deviceId = id
      draw.devicePx = { x: px, y: py }
      finishCableRouting()
      return
    }
  }, [showCablePreview, finishCableRouting])
  // Keep ref in sync so marker listeners always use latest version
  useEffect(() => { handleCableClickRef.current = handleCableClick }, [handleCableClick])

  // Map click during cable routing phase → add waypoint (IPVM: click map for turns, click device to finish)
  const handleCableMapClick = useCallback((x: number, y: number) => {
    const draw = cableDrawRef.current
    if (!draw || draw.phase !== 'routing') return

    draw.waypoints.push({ x: Math.round(x), y: Math.round(y) })
    // Preview: MDF → waypoints (no device endpoint yet — user clicks device to finish)
    const routePts = [draw.mdfPx!, ...draw.waypoints]
    showCablePreview(routePts)
  }, [showCablePreview])

  // Cancel / finish cable drawing
  useEffect(() => {
    if (activeTool !== 'cable' && cableDrawRef.current) cleanupCableDraw()
  }, [activeTool, cleanupCableDraw])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cableDrawRef.current) {
        cleanupCableDraw()
        onToolChangeRef.current?.('select')
      }
      if (e.key === 'Enter' && cableDrawRef.current?.phase === 'routing') {
        finishCableRouting()
      }
    }
    const onDblClick = () => {
      if (cableDrawRef.current?.phase === 'routing') finishCableRouting()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('dblclick', onDblClick)
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('dblclick', onDblClick) }
  }, [cleanupCableDraw, finishCableRouting])

  // ── Wall drawing helpers ──
  const WALL_SNAP_PX = 12 // pixel distance for snap-to-vertex detection
  const WALL_CLOSE_PX = 15 // pixel distance to close/complete wall by clicking first vertex

  const cleanupWallDraw = useCallback(() => {
    wallDrawRef.current = null
    wallMoveListenerRef.current?.remove()
    wallMoveListenerRef.current = null
    wallPreviewRef.current?.setMap(null)
    wallPreviewRef.current = null
    wallFollowerRef.current?.setMap(null)
    wallFollowerRef.current = null
    wallSnapMarkerRef.current?.setMap(null)
    wallSnapMarkerRef.current = null
    for (const m of wallVertexMarkersRef.current) m.setMap(null)
    wallVertexMarkersRef.current = []
  }, [])

  /** Snap a canvas pixel position to the nearest existing wall vertex or edge point. */
  const snapToWallVertex = useCallback((px: { x: number; y: number }): { x: number; y: number; snapped: boolean } => {
    const allWalls = wallsRef.current ?? []
    const drawPts = wallDrawRef.current?.points ?? []
    let bestDist = WALL_SNAP_PX * WALL_SNAP_PX // squared threshold
    let bestPt = px
    let snapped = false

    // Check all existing wall vertices
    for (const wall of allWalls) {
      for (const pt of wall.points) {
        const dx = pt.x - px.x, dy = pt.y - px.y
        const d2 = dx * dx + dy * dy
        if (d2 < bestDist) { bestDist = d2; bestPt = { x: pt.x, y: pt.y }; snapped = true }
      }
    }

    // Check vertices of the wall currently being drawn (for self-snap, especially first point to close)
    for (const pt of drawPts) {
      const dx = pt.x - px.x, dy = pt.y - px.y
      const d2 = dx * dx + dy * dy
      if (d2 < bestDist) { bestDist = d2; bestPt = { x: pt.x, y: pt.y }; snapped = true }
    }

    // Snap to nearest point on existing wall edges (perpendicular projection)
    for (const wall of allWalls) {
      const pts = wall.points
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1]
        const abx = b.x - a.x, aby = b.y - a.y
        const len2 = abx * abx + aby * aby
        if (len2 === 0) continue
        const t = Math.max(0, Math.min(1, ((px.x - a.x) * abx + (px.y - a.y) * aby) / len2))
        const proj = { x: a.x + t * abx, y: a.y + t * aby }
        const dx = proj.x - px.x, dy = proj.y - px.y
        const d2 = dx * dx + dy * dy
        if (d2 < bestDist) { bestDist = d2; bestPt = proj; snapped = true }
      }
    }

    return { ...bestPt, snapped }
  }, [])

  /** Show the wall preview polyline (confirmed vertices) */
  const showWallPreview = useCallback((pts: Array<{ x: number; y: number }>) => {
    const ctx = geoContextRef.current
    if (!ctx || !mapRef.current) return
    const path = pts.map(pt => canvasPixelsToLatLng(pt.x, pt.y, ctx))

    if (!wallPreviewRef.current) {
      wallPreviewRef.current = new google.maps.Polyline({
        path, strokeColor: '#ef4444', strokeOpacity: 0.9, strokeWeight: 3,
        map: mapRef.current, clickable: false, zIndex: 10,
      })
    } else {
      wallPreviewRef.current.setPath(path)
    }
  }, [])

  /** Show the follower line (last confirmed vertex → cursor) */
  const showWallFollower = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = geoContextRef.current
    if (!ctx || !mapRef.current) return
    const path = [canvasPixelsToLatLng(from.x, from.y, ctx), canvasPixelsToLatLng(to.x, to.y, ctx)]

    if (!wallFollowerRef.current) {
      wallFollowerRef.current = new google.maps.Polyline({
        path, strokeColor: '#ef4444', strokeOpacity: 0.4, strokeWeight: 2,
        map: mapRef.current, clickable: false, zIndex: 9,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.6, strokeColor: '#ef4444', scale: 2 }, offset: '0', repeat: '10px' }],
      })
    } else {
      wallFollowerRef.current.setPath(path)
    }
  }, [])

  /** Show/hide snap indicator marker */
  const showWallSnapIndicator = useCallback((pos: { x: number; y: number } | null) => {
    if (!pos) {
      wallSnapMarkerRef.current?.setVisible(false)
      return
    }
    const ctx = geoContextRef.current
    if (!ctx || !mapRef.current) return
    const ll = canvasPixelsToLatLng(pos.x, pos.y, ctx)

    if (!wallSnapMarkerRef.current) {
      wallSnapMarkerRef.current = new google.maps.Marker({
        position: ll, map: mapRef.current, clickable: false, zIndex: 20,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#22c55e', fillOpacity: 0.9, strokeColor: '#fff', strokeWeight: 2 },
      })
    } else {
      wallSnapMarkerRef.current.setPosition(ll)
      wallSnapMarkerRef.current.setVisible(true)
    }
  }, [])

  /** Add a vertex marker dot to the map for visual feedback */
  const addWallVertexMarker = useCallback((pos: { x: number; y: number }) => {
    const ctx = geoContextRef.current
    if (!ctx || !mapRef.current) return
    const ll = canvasPixelsToLatLng(pos.x, pos.y, ctx)
    const marker = new google.maps.Marker({
      position: ll, map: mapRef.current, clickable: false, zIndex: 11,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 4, fillColor: '#ef4444', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1.5 },
    })
    wallVertexMarkersRef.current.push(marker)
  }, [])

  /** Complete wall drawing — save and cleanup */
  const completeWallDraw = useCallback(() => {
    const draw = wallDrawRef.current
    if (!draw || draw.points.length < 2) { cleanupWallDraw(); return }
    onWallCreatedRef.current?.(draw.points)
    cleanupWallDraw()
    onToolChangeRef.current?.('select')
  }, [cleanupWallDraw])

  /** Handle map click in wall mode — add vertex or complete */
  const handleWallMapClick = useCallback((clickX: number, clickY: number) => {
    const snapped = snapToWallVertex({ x: clickX, y: clickY })
    const pt = { x: Math.round(snapped.x), y: Math.round(snapped.y) }

    if (!wallDrawRef.current) {
      // First click — start wall
      wallDrawRef.current = { points: [pt] }
      showWallPreview([pt])
      addWallVertexMarker(pt)

      // Start mouse-move listener for follower line
      if (mapRef.current) {
        wallMoveListenerRef.current = mapRef.current.addListener('mousemove', (e: google.maps.MapMouseEvent) => {
          const ctx = geoContextRef.current
          if (!ctx || !wallDrawRef.current || !e.latLng) return
          const { x: mx, y: my } = latLngToCanvasPixels(e.latLng.lat(), e.latLng.lng(), ctx)
          const ms = snapToWallVertex({ x: mx, y: my })
          const lastPt = wallDrawRef.current.points[wallDrawRef.current.points.length - 1]
          showWallFollower(lastPt, ms)
          showWallSnapIndicator(ms.snapped ? ms : null)
        })
      }
      return
    }

    const draw = wallDrawRef.current
    const firstPt = draw.points[0]

    // Check if clicking near first vertex → close the wall
    if (draw.points.length >= 3) {
      const dx = pt.x - firstPt.x, dy = pt.y - firstPt.y
      if (Math.sqrt(dx * dx + dy * dy) < WALL_CLOSE_PX) {
        // Close the wall — add first point again to form a loop
        draw.points.push({ ...firstPt })
        completeWallDraw()
        return
      }
    }

    // Add vertex
    draw.points.push(pt)
    showWallPreview(draw.points)
    addWallVertexMarker(pt)
  }, [snapToWallVertex, showWallPreview, showWallFollower, showWallSnapIndicator, addWallVertexMarker, completeWallDraw])

  const handleWallMapClickRef = useRef(handleWallMapClick)
  useEffect(() => { handleWallMapClickRef.current = handleWallMapClick }, [handleWallMapClick])

  // Cancel / finish wall drawing
  useEffect(() => {
    if (activeTool !== 'wall' && wallDrawRef.current) cleanupWallDraw()
  }, [activeTool, cleanupWallDraw])

  // Cursor change for wall mode
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (activeTool === 'wall') {
      map.setOptions({ draggableCursor: 'crosshair' })
    } else {
      // Only reset if we were the ones that set it
      map.setOptions({ draggableCursor: '' })
    }
  }, [activeTool])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && wallDrawRef.current) {
        cleanupWallDraw()
        onToolChangeRef.current?.('select')
      }
      // Enter with 2+ points → complete the wall (open polyline, not closed)
      if (e.key === 'Enter' && wallDrawRef.current && wallDrawRef.current.points.length >= 2) {
        completeWallDraw()
      }
    }
    const onDblClick = () => {
      if (wallDrawRef.current && wallDrawRef.current.points.length >= 2) {
        completeWallDraw()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('dblclick', onDblClick)
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('dblclick', onDblClick) }
  }, [cleanupWallDraw, completeWallDraw])

  // Google Maps script loading (reuse cached script from satellite-map if present)
  const [mapReady, setMapReady] = useState(false)
  useEffect(() => {
    if (!mapsApiKey) return
    // If google.maps already loaded (satellite-map.tsx loaded it), skip script injection
    if (typeof google !== 'undefined' && google.maps?.Map) {
      setMapReady(true)
      return
    }
    const existing = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existing) {
      // Script already in DOM, wait for it
      const check = () => {
        if (typeof google !== 'undefined' && google.maps?.Map) { setMapReady(true); return }
        requestAnimationFrame(check)
      }
      check()
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => {
      // google.maps.Map may not be available immediately at onload — poll for it
      const check = () => {
        if (typeof google !== 'undefined' && google.maps?.Map) { setMapReady(true); return }
        requestAnimationFrame(check)
      }
      check()
    }
    document.head.appendChild(script)
  }, [mapsApiKey])

  // Initialize map once script is ready
  useEffect(() => {
    if (!mapReady || !mapContainerRef.current || mapRef.current) return

    const cfg = satelliteConfigRef.current
    const initialLat = cfg?.lat ?? 37.7749
    const initialLng = cfg?.lng ?? -122.4194
    const initialZoom = cfg?.zoom ?? 18

    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat: initialLat, lng: initialLng },
      zoom: initialZoom,
      mapTypeId: 'satellite',
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      draggableCursor: 'grab',
      draggingCursor: 'grabbing',
      keyboardShortcuts: true,
      styles: [
        { elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    })

    mapRef.current = map

    // Map click → cable mode proximity check, then deselect/canvas click
    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      setContextMenuVisible(false)
      if (!e.latLng) return
      const ctx = geoContextRef.current
      if (!ctx) return
      const { x: clickX, y: clickY } = latLngToCanvasPixels(e.latLng.lat(), e.latLng.lng(), ctx)

      // ── Cable mode: proximity snap to nearest device/MDF ──
      // Uses screen pixel distance (30px, like IPVM) for zoom-independent snap
      if (activeToolRef.current === 'cable') {
        const draw = cableDrawRef.current
        const SNAP_PX = 30 // screen pixel snap radius (IPVM standard)
        const clickLat = e.latLng.lat()
        const clickLng = e.latLng.lng()

        // Helper: check if click is near a canvas position (in screen pixels)
        const nearPos = (px: number, py: number) => {
          const pos = canvasPixelsToLatLng(px, py, ctx)
          return screenPixelDist(map, clickLat, clickLng, pos.lat, pos.lng) < SNAP_PX
        }

        // Phase: pick_mdf — must click near an MDF to start
        if (!draw || draw.phase === 'pick_mdf') {
          const mdfNodes = mdfIdfsRef.current ?? []
          for (const m of mdfNodes) {
            if (nearPos(m.position_x, m.position_y)) {
              handleCableClickRef.current(m.id, 'mdf', m.position_x, m.position_y)
              return
            }
          }
          return // must click near an MDF to start
        }

        // Phase: routing — click device to finish, click map to add waypoint
        if (draw.phase === 'routing') {
          // Check device snap first — clicking device finishes the cable
          const devs = devicesRef.current
          for (const d of devs) {
            if (nearPos(d.position_x, d.position_y)) {
              handleCableClickRef.current(d.id, 'device', d.position_x, d.position_y)
              return
            }
          }
          // Not near a device — add waypoint
          handleCableMapClick(clickX, clickY)
          return
        }
        return
      }

      // ── Wall mode: click to add vertices ──
      if (activeToolRef.current === 'wall') {
        handleWallMapClickRef.current(clickX, clickY)
        return
      }

      // ── Normal mode ── deselect everything
      onSelectDeviceRef.current(null)
      if (selectedWallIdRef.current) onWallSelectedRef.current?.(null)
      if (onCanvasClickRef.current) {
        onCanvasClickRef.current(clickX, clickY)
      }
    })

    // Zoom change
    map.addListener('zoom_changed', () => {
      onZoomChangeRef.current?.(map.getZoom() ?? initialZoom)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time init after script loads
  }, [mapReady])

  // Expose zoom actions (update whenever map or devices change)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (canvasActionsRef) {
      canvasActionsRef.current = {
        zoomIn: () => map.setZoom(Math.min((map.getZoom() ?? 18) + 1, 21)),
        zoomOut: () => map.setZoom(Math.max((map.getZoom() ?? 18) - 1, 1)),
        fitToView: () => {
          const ctx = geoContextRef.current
          const devs = devicesRef.current
          if (!ctx || devs.length === 0) return
          const bounds = new google.maps.LatLngBounds()
          for (const d of devs) {
            const { lat, lng } = canvasPixelsToLatLng(d.position_x, d.position_y, ctx)
            bounds.extend({ lat, lng })
          }
          map.fitBounds(bounds)
        },
      }
    }
    if (zoomToPointRef) {
      zoomToPointRef.current = (x: number, y: number) => {
        const ctx = geoContextRef.current
        if (!ctx) return
        const { lat, lng } = canvasPixelsToLatLng(x, y, ctx)
        map.setCenter({ lat, lng })
        map.setZoom(19)
      }
    }
  }, [mapReady, canvasActionsRef, zoomToPointRef])

  // Sync map center/zoom when satelliteConfig changes (e.g. switching areas)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !satelliteConfig) return
    map.setCenter({ lat: satelliteConfig.lat, lng: satelliteConfig.lng })
    map.setZoom(satelliteConfig.zoom)
  }, [satelliteConfig?.lat, satelliteConfig?.lng, satelliteConfig?.zoom])

  // Update device markers
  useEffect(() => {
    if (!mapRef.current || !geoContext) return

    const map = mapRef.current
    const seen = new Set<string>()

    for (const dev of devices) {
      seen.add(dev.id)
      const { lat, lng } = canvasPixelsToLatLng(dev.position_x, dev.position_y, geoContext)
      const isSelected = dev.id === selectedDeviceId
      const isCamera = CAMERA_CATEGORIES.has(dev.category)

      let marker = markersRef.current.get(dev.id)

      // Build icon: cameras use Symbol (rotation-capable), others use PNG
      const iconObj: google.maps.Symbol | google.maps.Icon = isCamera
        ? buildCameraSymbol(dev.category, dev.rotation || 0, isSelected)
        : {
            url: CAT_TO_PNG[dev.category] || '/icons/cctv/dome.png',
            scaledSize: new google.maps.Size(32, 32),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(16, 16),
          }

      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat, lng },
          map,
          icon: iconObj,
          draggable: isSelected,
          title: dev.label || 'Device',
        })

        // Marker click → select or cable mode (uses refs to avoid stale closures)
        const devId = dev.id
        marker.addListener('click', () => {
          if (activeToolRef.current === 'cable') {
            const d = devicesRef.current.find(dd => dd.id === devId)
            handleCableClickRef.current(devId, 'device', d?.position_x ?? 0, d?.position_y ?? 0)
            return
          }
          onSelectDeviceRef.current(devId)
        })

        // Marker right-click → context menu
        marker.addListener('rightclick', (e: google.maps.MapMouseEvent) => {
          const domEv = e.domEvent as MouseEvent
          domEv.preventDefault()
          contextMenuRef.current = { deviceId: devId, x: domEv.clientX, y: domEv.clientY }
          setContextMenuVisible(true)
        })

        // Marker drag start
        marker.addListener('dragstart', () => {
          draggingDeviceRef.current = devId
        })

        // Marker drag (continuous) → update cable polyline in real-time
        marker.addListener('drag', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return
          const ctx = geoContextRef.current
          if (!ctx) return
          const dragLat = e.latLng.lat(), dragLng = e.latLng.lng()
          const cbs = cablesRef.current
          const polys = cablePolylinesRef.current
          // cablePolylinesRef is built in same order as cables that have waypoints >= 2
          let polyIdx = 0
          for (const c of cbs) {
            if (!c.waypoints || c.waypoints.length < 2) continue
            if (c.from_device_id === devId || c.to_device_id === devId) {
              if (polyIdx < polys.length) {
                const isFrom = c.from_device_id === devId
                const path = c.waypoints.map((wp, i) => {
                  // Replace the correct endpoint: first wp if dragging from_device, last wp if dragging to_device
                  if (isFrom && i === 0) return { lat: dragLat, lng: dragLng }
                  if (!isFrom && i === c.waypoints.length - 1) return { lat: dragLat, lng: dragLng }
                  return canvasPixelsToLatLng(wp.x, wp.y, ctx)
                })
                polys[polyIdx].setPath(path)
              }
            }
            polyIdx++
          }
        })

        // Marker drag end → convert lat/lng back to px, call onDeviceMoved (persists cable update)
        marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          draggingDeviceRef.current = null
          const ctx = geoContextRef.current
          if (e.latLng && onDeviceMovedRef.current && ctx) {
            const newPos = latLngToCanvasPixels(e.latLng.lat(), e.latLng.lng(), ctx)
            onDeviceMovedRef.current(devId, Math.round(newPos.x), Math.round(newPos.y))
          }
        })

        markersRef.current.set(dev.id, marker)
      } else {
        // Update marker position, icon (rotation changes), and draggable state
        marker.setPosition({ lat, lng })
        marker.setIcon(iconObj)
        marker.setDraggable(isSelected)
      }
    }

    // Remove markers for deleted devices
    for (const [devId, marker] of markersRef.current) {
      if (!seen.has(devId)) {
        marker.setMap(null)
        markersRef.current.delete(devId)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mapReady triggers re-run after map init
  }, [devices, selectedDeviceId, geoContext, mapReady])

  // Update MDF/IDF markers on Google Maps
  useEffect(() => {
    if (!mapRef.current || !geoContext) return
    const map = mapRef.current
    const seen = new Set<string>()
    const nodes = mdfIdfs ?? []

    for (const mdf of nodes) {
      seen.add(mdf.id)
      const { lat, lng } = canvasPixelsToLatLng(mdf.position_x, mdf.position_y, geoContext)
      let marker = mdfMarkersRef.current.get(mdf.id)

      const mdfIcon: google.maps.Symbol = {
        path: 'M-8,-10 L8,-10 L8,10 L-8,10 Z M-5,-7 L5,-7 L5,-3 L-5,-3 Z M-5,0 L5,0 L5,4 L-5,4 Z M-5,7 L5,7',
        fillColor: mdf.color_hex || '#64748b',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 1.5,
        scale: 1.3,
        anchor: new google.maps.Point(0, 0),
      }

      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat, lng },
          map,
          icon: mdfIcon,
          draggable: true,
          zIndex: 5,
          title: mdf.name || 'MDF/IDF',
        })

        const mdfId = mdf.id
        const mdfPosX = mdf.position_x
        const mdfPosY = mdf.position_y
        marker.addListener('click', () => {
          if (activeToolRef.current === 'cable') {
            handleCableClickRef.current(mdfId, 'mdf', mdfPosX, mdfPosY)
            return
          }
          onMdfSelectedRef.current?.(mdfId)
        })
        marker.addListener('rightclick', () => {
          if (confirm(`Delete ${mdf.name || 'MDF/IDF'} from map?`)) {
            onMdfIdfDeletedRef.current?.(mdfId)
          }
        })
        // MDF drag (continuous) → update cable polyline start in real-time
        marker.addListener('drag', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return
          const ctx = geoContextRef.current
          if (!ctx) return
          const dragLat = e.latLng.lat(), dragLng = e.latLng.lng()
          const cbs = cablesRef.current
          const polys = cablePolylinesRef.current
          let polyIdx = 0
          for (const c of cbs) {
            if (!c.waypoints || c.waypoints.length < 2) continue
            if (c.mdf_idf_id === mdfId) {
              if (polyIdx < polys.length) {
                const path = c.waypoints.map((wp, i) => {
                  if (i === 0) return { lat: dragLat, lng: dragLng }
                  return canvasPixelsToLatLng(wp.x, wp.y, ctx)
                })
                polys[polyIdx].setPath(path)
              }
            }
            polyIdx++
          }
        })

        marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          const ctx = geoContextRef.current
          if (e.latLng && ctx) {
            const pos = latLngToCanvasPixels(e.latLng.lat(), e.latLng.lng(), ctx)
            onMdfIdfMovedRef.current?.(mdfId, Math.round(pos.x), Math.round(pos.y))
          }
        })

        mdfMarkersRef.current.set(mdf.id, marker)
      } else {
        marker.setPosition({ lat, lng })
        marker.setIcon(mdfIcon)
      }
    }

    // Remove markers for deleted MDF/IDF nodes
    for (const [id, marker] of mdfMarkersRef.current) {
      if (!seen.has(id)) {
        marker.setMap(null)
        mdfMarkersRef.current.delete(id)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mdfIdfs, geoContext, mapReady])

  // Render cable polylines + waypoint markers on Google Maps
  // Supports: click polyline to insert waypoint, drag waypoint to move, right-click to delete
  useEffect(() => {
    // Clear old polylines + waypoint markers
    for (const pl of cablePolylinesRef.current) pl.setMap(null)
    cablePolylinesRef.current = []
    for (const m of cableWaypointMarkersRef.current) m.setMap(null)
    cableWaypointMarkersRef.current = []

    if (!mapRef.current || !geoContext || !cables.length) return
    const map = mapRef.current
    const ctx = geoContext

    for (const cable of cables) {
      if (!cable.waypoints || cable.waypoints.length < 2) continue
      const path = cable.waypoints.map(wp => canvasPixelsToLatLng(wp.x, wp.y, ctx))
      const color = cable.color_hex || '#3b82f6'

      // Dashed polyline (IPVM style — fat invisible stroke for click hit area)
      const polyline = new google.maps.Polyline({
        path,
        strokeColor: color,
        strokeOpacity: 0,
        strokeWeight: 10,  // invisible but wide click target (IPVM uses 10)
        map,
        clickable: true,
        zIndex: 5,
        icons: [{
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: color, scale: 2.5 },
          offset: '0', repeat: '12px',
        }],
      })

      // Click on polyline → insert waypoint at closest segment point
      const cableId = cable.id
      polyline.addListener('click', (e: google.maps.PolyMouseEvent) => {
        if (!e.latLng) return
        const currentCable = cablesRef.current.find(c => c.id === cableId)
        if (!currentCable?.waypoints || currentCable.waypoints.length < 2) return
        const clickPx = latLngToCanvasPixels(e.latLng.lat(), e.latLng.lng(), ctx)
        // Find which segment the click is closest to
        let bestIdx = 1
        let bestDist = Infinity
        for (let i = 0; i < currentCable.waypoints.length - 1; i++) {
          const a = currentCable.waypoints[i]
          const b = currentCable.waypoints[i + 1]
          const dist = pointToSegmentDist(clickPx.x, clickPx.y, a.x, a.y, b.x, b.y)
          if (dist < bestDist) { bestDist = dist; bestIdx = i + 1 }
        }
        const newWp = [...currentCable.waypoints]
        newWp.splice(bestIdx, 0, { x: Math.round(clickPx.x), y: Math.round(clickPx.y) })
        const len = calcWaypointLengthFt(newWp)
        onCableUpdatedRef.current?.(cableId, newWp, len)
      })

      cablePolylinesRef.current.push(polyline)

      // Waypoint dot markers (skip first and last = MDF/device endpoints)
      for (let wpIdx = 1; wpIdx < cable.waypoints.length - 1; wpIdx++) {
        const wp = cable.waypoints[wpIdx]
        const pos = canvasPixelsToLatLng(wp.x, wp.y, ctx)
        const marker = new google.maps.Marker({
          position: pos,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: color,
            strokeWeight: 2,
          },
          draggable: true,
          clickable: true,
          zIndex: 10,
          title: 'Drag to move, right-click to delete',
        })

        // Drag waypoint to new position
        const wpIndex = wpIdx
        marker.addListener('dragend', () => {
          const newPos = marker.getPosition()
          if (!newPos) return
          const currentCable = cablesRef.current.find(c => c.id === cableId)
          if (!currentCable?.waypoints) return
          const px = latLngToCanvasPixels(newPos.lat(), newPos.lng(), ctx)
          const newWp = [...currentCable.waypoints]
          newWp[wpIndex] = { x: Math.round(px.x), y: Math.round(px.y) }
          const len = calcWaypointLengthFt(newWp)
          onCableUpdatedRef.current?.(cableId, newWp, len)
        })

        // Right-click → delete waypoint
        marker.addListener('rightclick', () => {
          const currentCable = cablesRef.current.find(c => c.id === cableId)
          if (!currentCable?.waypoints || currentCable.waypoints.length <= 2) return
          const newWp = currentCable.waypoints.filter((_, i) => i !== wpIndex)
          const len = calcWaypointLengthFt(newWp)
          onCableUpdatedRef.current?.(cableId, newWp, len)
        })

        cableWaypointMarkersRef.current.push(marker)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cables, geoContext, mapReady, calcWaypointLengthFt])

  // Render wall polylines on Google Maps — clickable, selectable, with vertex editing
  useEffect(() => {
    // Clear old wall lines + vertex edit markers
    for (const pl of wallPolylinesRef.current) pl.setMap(null)
    wallPolylinesRef.current = []
    for (const m of wallVertexEditMarkersRef.current) m.setMap(null)
    wallVertexEditMarkersRef.current = []

    if (!mapRef.current || !geoContext || !walls?.length) return
    const map = mapRef.current
    const ctx = geoContext

    for (const wall of walls) {
      if (!wall.points || wall.points.length < 2) continue
      const wallId = wall.id
      const color = wall.color || '#ef4444'
      const isSelected = wall.id === selectedWallId

      const path = wall.points.map(pt => {
        const { lat, lng } = canvasPixelsToLatLng(pt.x, pt.y, ctx)
        return { lat, lng }
      })

      // Polyline — fat invisible stroke for click hit area + visible colored line
      const polyline = new google.maps.Polyline({
        path,
        strokeColor: color,
        strokeOpacity: 0,
        strokeWeight: 8,  // invisible wide click target
        map,
        clickable: true,
        zIndex: isSelected ? 8 : 3,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: wall.opacity ?? 0.9,
            strokeColor: color,
            scale: isSelected ? 3 : 2.5,
          },
          offset: '0',
          repeat: '1px',  // near-solid line appearance
        }],
      })

      // Click wall polyline → select it OR insert a vertex if already selected
      polyline.addListener('click', (e: google.maps.PolyMouseEvent) => {
        if (!e.latLng) return
        const currentWalls = wallsRef.current ?? []
        const currentWall = currentWalls.find(w => w.id === wallId)

        // If this wall is already selected → insert a vertex
        if (selectedWallIdRef.current === wallId && currentWall) {
          const clickPx = latLngToCanvasPixels(e.latLng.lat(), e.latLng.lng(), ctx)
          let bestIdx = 1
          let bestDist = Infinity
          for (let i = 0; i < currentWall.points.length - 1; i++) {
            const a = currentWall.points[i], b = currentWall.points[i + 1]
            const dist = pointToSegmentDist(clickPx.x, clickPx.y, a.x, a.y, b.x, b.y)
            if (dist < bestDist) { bestDist = dist; bestIdx = i + 1 }
          }
          const newPts = [...currentWall.points]
          newPts.splice(bestIdx, 0, { x: Math.round(clickPx.x), y: Math.round(clickPx.y) })
          onWallUpdatedRef.current?.(wallId, { points: newPts })
          return
        }

        // Otherwise → select this wall
        onWallSelectedRef.current?.(wallId)
      })

      wallPolylinesRef.current.push(polyline)

      // Draggable vertex markers — only for the selected wall
      if (isSelected) {
        for (let vIdx = 0; vIdx < wall.points.length; vIdx++) {
          const pt = wall.points[vIdx]
          const pos = canvasPixelsToLatLng(pt.x, pt.y, ctx)
          const vertexIdx = vIdx // closure capture

          const marker = new google.maps.Marker({
            position: pos,
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 5,
              fillColor: '#ffffff',
              fillOpacity: 1,
              strokeColor: color,
              strokeWeight: 2,
            },
            draggable: true,
            clickable: true,
            zIndex: 12,
            cursor: 'grab',
          })

          // Drag vertex → update wall points
          marker.addListener('dragend', () => {
            const newPos = marker.getPosition()
            if (!newPos) return
            const currentWalls = wallsRef.current ?? []
            const currentWall = currentWalls.find(w => w.id === wallId)
            if (!currentWall) return
            const px = latLngToCanvasPixels(newPos.lat(), newPos.lng(), ctx)
            const newPts = [...currentWall.points]
            newPts[vertexIdx] = { x: Math.round(px.x), y: Math.round(px.y) }
            onWallUpdatedRef.current?.(wallId, { points: newPts })
          })

          // Right-click vertex → delete it (if wall has >2 points)
          marker.addListener('rightclick', () => {
            const currentWalls = wallsRef.current ?? []
            const currentWall = currentWalls.find(w => w.id === wallId)
            if (!currentWall || currentWall.points.length <= 2) return
            const newPts = currentWall.points.filter((_, i) => i !== vertexIdx)
            onWallUpdatedRef.current?.(wallId, { points: newPts })
          })

          wallVertexEditMarkersRef.current.push(marker)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walls, geoContext, mapReady, selectedWallId])

  // Render floor plan as GroundOverlay
  useEffect(() => {
    if (groundOverlayRef.current) {
      groundOverlayRef.current.setMap(null)
      groundOverlayRef.current = null
    }

    if (!mapRef.current || !floorPlan || !geoContext) return
    const fileUrl = floorPlan.file_url
    if (!fileUrl) return

    const map = mapRef.current
    const fpW = floorPlan.width || 1000
    const fpH = floorPlan.height || 800
    const opacity = floorPlanOpacity ?? floorPlan.opacity ?? 0.6

    // Convert floor plan pixel dimensions to lat/lng bounds
    // Floor plan is centered at origin (0,0) and extends to (fpW, fpH) in canvas pixels
    const sw = canvasPixelsToLatLng(0, fpH, geoContext)
    const ne = canvasPixelsToLatLng(fpW, 0, geoContext)
    const bounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(sw.lat, sw.lng),
      new google.maps.LatLng(ne.lat, ne.lng),
    )

    const overlay = new google.maps.GroundOverlay(fileUrl, bounds, {
      opacity,
      clickable: false,
    })
    overlay.setMap(map)
    groundOverlayRef.current = overlay
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorPlan, floorPlanOpacity, geoContext, mapReady])

  // Update FOV polygons
  useEffect(() => {
    if (!mapRef.current || !geoContext || !showFovCones) {
      // Clear all polygons if FOV not shown
      for (const poly of polygonsRef.current) {
        poly.setMap(null)
      }
      polygonsRef.current = []
      return
    }

    const map = mapRef.current
    const newPolygons: GPolygon[] = []
    const newSelectedPolygons: GPolygon[] = []

    for (const [devId, data] of fovData) {
      const dev = devices.find((d) => d.id === devId)
      if (!dev) continue
      if (hiddenCategories?.has(dev.category)) continue

      const isSelected = devId === selectedDeviceId
      const { lat: camLat, lng: camLng } = canvasPixelsToLatLng(
        dev.position_x,
        dev.position_y,
        geoContext,
      )

      const sensorRotations = data.sensorAngles?.length ? data.sensorAngles : [dev.rotation || 0]

      for (let sIdx = 0; sIdx < sensorRotations.length; sIdx++) {
        const sensorRotDeg = sensorRotations[sIdx]
        const imagerData = data.perImagerData?.[sIdx]
        const effectiveTiers = imagerData?.tiers || data.tiers
        const effectiveHFov = imagerData?.hFov ?? data.hFov

        for (let t = 0; t < effectiveTiers.length; t++) {
          const tier = effectiveTiers[t]
          const zoneName = COLOR_TO_ZONE[tier.color]
          if (zoneName && hiddenPpfZones?.has(zoneName)) continue

          let fillColor = imagerData?.colorHex || data.colorHex || C.accent
          if (fovDisplayMode === 'ppf' || fovDisplayMode === 'dori') {
            fillColor = tier.color
          }

          const gradOpacity = Math.min(
            0.55,
            tier.opacity * (1 + (effectiveTiers.length - 1 - t) * 0.15),
          )

          let path: Array<{ lat: number; lng: number }>
          if (effectiveHFov >= 359) {
            path = generateCirclePolygon(camLat, camLng, tier.distanceFt, 48)
          } else {
            path = generateFovConePolygon({
              lat: camLat,
              lng: camLng,
              rotationDeg: sensorRotDeg,
              hFovDeg: effectiveHFov,
              radiusFt: tier.distanceFt,
              steps: Math.max(24, Math.min(48, Math.round(effectiveHFov))),
            })
          }

          if (path.length < 3) continue

          const poly = new google.maps.Polygon({
            paths: path,
            fillColor,
            fillOpacity: gradOpacity * 0.85,
            strokeColor: t === 0 ? fillColor : 'transparent',
            strokeOpacity: t === 0 ? 0.55 : 0,
            strokeWeight: t === 0 ? 2 : 0,
            map,
            clickable: false,
            zIndex: sensorRotations.length > 1 ? 1 + sIdx : 1,
          })
          newPolygons.push(poly)
          if (isSelected) newSelectedPolygons.push(poly)
        }
      }

      // PTZ pan range circle
      if (dev.category === 'ptz') {
        const panR = data.tiers[0]?.distanceFt || 30
        const ring = generateCirclePolygon(camLat, camLng, panR, 48)
        if (ring.length >= 3) {
          const poly = new google.maps.Polygon({
            paths: ring,
            fillColor: '#808080',
            fillOpacity: 0.06,
            strokeColor: '#808080',
            strokeOpacity: 0.25,
            strokeWeight: 1,
            map,
            clickable: false,
            zIndex: 0,
          })
          newPolygons.push(poly)
        }
      }
    }

    // Clear old polygons
    for (const poly of polygonsRef.current) {
      poly.setMap(null)
    }
    polygonsRef.current = newPolygons
    selectedDevicePolygonsRef.current = newSelectedPolygons
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mapReady triggers re-run after map init
  }, [
    devices,
    selectedDeviceId,
    fovData,
    showFovCones,
    geoContext,
    hiddenCategories,
    hiddenPpfZones,
    fovDisplayMode,
    mapReady,
  ])

  // IPVM-style FOV handle markers: per-sensor person icon (rotation+distance) + 2 arc-edge circles (FOV angle)
  // Multi-sensor cameras: each sensor gets its OWN independent set of handles.
  // Deferred persistence: live visual updates during drag, single PATCH on release.
  useEffect(() => {
    // Skip handle updates while actively dragging (prevent effect re-run from killing drag)
    if (isDraggingFovRef.current) return

    // Clean up previous handles
    for (const m of fovHandleMarkersRef.current) m.setMap(null)
    fovHandleMarkersRef.current = []
    for (const [l, r] of fovAngleHandlePairsRef.current) { l.setMap(null); r.setMap(null) }
    fovAngleHandlePairsRef.current = []
    for (const l of fovPolygonListenersRef.current) l.remove()
    fovPolygonListenersRef.current = []

    if (!mapRef.current || !geoContext || !showFovCones || !selectedDeviceId) return

    const dev = devices.find((d) => d.id === selectedDeviceId)
    if (!dev || !CAMERA_CATEGORIES.has(dev.category)) return

    const data = fovData.get(selectedDeviceId)
    if (!data || !data.tiers.length) return

    const selectedPolygons = selectedDevicePolygonsRef.current
    if (!selectedPolygons.length) return

    const map = mapRef.current
    const { lat: camLat, lng: camLng } = canvasPixelsToLatLng(dev.position_x, dev.position_y, geoContext)
    const SENSOR_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7']

    // Determine sensors: multi-sensor has sensorAngles, single-sensor uses device rotation
    const sensorRotations = data.sensorAngles?.length ? data.sensorAngles : [dev.rotation || 0]
    const isMultiSensor = sensorRotations.length > 1

    // ── Build polygon index map: which polygons belong to which sensor ──
    const sensorPolyRanges: Array<{ start: number; count: number }> = []
    let polyOffset = 0
    for (let sIdx = 0; sIdx < sensorRotations.length; sIdx++) {
      const imagerData = data.perImagerData?.[sIdx]
      const effectiveTiers = imagerData?.tiers || data.tiers
      let count = 0
      for (const tier of effectiveTiers) {
        const zoneName = COLOR_TO_ZONE[tier.color]
        if (zoneName && hiddenPpfZones?.has(zoneName)) continue
        count++
      }
      sensorPolyRanges.push({ start: polyOffset, count })
      polyOffset += count
    }

    // ── SVG icons ──
    const buildPersonSvg = (color: string): google.maps.Symbol => ({
      path: 'M0,-8 C-2,-8 -3,-6.5 -3,-5 C-3,-3.5 -2,-2 0,-2 C2,-2 3,-3.5 3,-5 C3,-6.5 2,-8 0,-8 Z M-4,0 L-4,6 L-2,6 L-2,2 L2,2 L2,6 L4,6 L4,0 L3,-1 L-3,-1 Z',
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 1.5,
      scale: 1.3,
      anchor: new google.maps.Point(0, 0),
    })
    const buildCircleSvg = (color: string): google.maps.Symbol => ({
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#ffffff',
      fillOpacity: 1,
      strokeColor: color,
      strokeWeight: 2,
      scale: 5,
    })

    // ── Helper: live-update ONLY one sensor's polygons ──
    const liveUpdateSensorPolygons = (
      sIdx: number, newRotDeg: number, newOuterDist: number, newHFov: number,
    ) => {
      const range = sensorPolyRanges[sIdx]
      if (!range) return
      const imagerData = data.perImagerData?.[sIdx]
      const effectiveTiers = imagerData?.tiers || data.tiers
      const origOuter = effectiveTiers[0]?.distanceFt ?? 30
      const scale = origOuter > 0 ? newOuterDist / origOuter : 1

      let localIdx = 0
      for (const tier of effectiveTiers) {
        const zoneName = COLOR_TO_ZONE[tier.color]
        if (zoneName && hiddenPpfZones?.has(zoneName)) continue
        const polyIdx = range.start + localIdx
        if (polyIdx >= selectedPolygons.length) break

        const scaledDist = tier.distanceFt * scale
        let path: Array<{ lat: number; lng: number }>
        if (newHFov >= 359) {
          path = generateCirclePolygon(camLat, camLng, scaledDist, 48)
        } else {
          path = generateFovConePolygon({
            lat: camLat, lng: camLng,
            rotationDeg: newRotDeg,
            hFovDeg: newHFov,
            radiusFt: scaledDist,
            steps: Math.max(24, Math.min(48, Math.round(newHFov))),
          })
        }
        if (path.length >= 3) {
          selectedPolygons[polyIdx].setPaths(path.map(p => new google.maps.LatLng(p.lat, p.lng)))
        }
        localIdx++
      }
    }

    // ── Commit drag: persist changes on release ──
    const commitDrag = () => {
      if (!isDraggingFovRef.current) return
      isDraggingFovRef.current = false
      map.setOptions({ draggable: true })
      const devId = dragDeviceIdRef.current
      if (!devId) return

      const sIdx = dragSensorIdxRef.current

      if (isMultiSensor) {
        // Per-sensor persistence via __batch
        const props = (dev.properties ?? {}) as Record<string, unknown>
        const updates: Record<string, unknown> = { ...props }

        // Update sensor_angles if rotation changed
        if (pendingRotationRef.current !== null) {
          const angles = [...(data.sensorAngles || sensorRotations)]
          angles[sIdx] = pendingRotationRef.current
          updates.sensor_angles = angles
        }

        // Update per_imager_props if distance or fov angle changed
        const perImager = [...((props.per_imager_props as Array<Record<string, unknown>>) || [])]
        // Ensure array has entries for all sensors
        while (perImager.length <= sIdx) perImager.push({})
        if (pendingDistanceRef.current !== null) {
          perImager[sIdx] = { ...perImager[sIdx], distance: pendingDistanceRef.current }
        }
        if (pendingFovAngleRef.current !== null) {
          perImager[sIdx] = { ...perImager[sIdx], hfov: pendingFovAngleRef.current }
        }
        if (pendingDistanceRef.current !== null || pendingFovAngleRef.current !== null) {
          updates.per_imager_props = perImager
        }

        onDeviceUpdatePropRef.current?.(devId, '__batch', updates)
      } else {
        // Single sensor: use dedicated callbacks
        if (pendingRotationRef.current !== null) {
          onDeviceRotatedRef.current?.(devId, pendingRotationRef.current)
        }
        if (pendingDistanceRef.current !== null) {
          onFovHandleDraggedRef.current?.(devId, pendingDistanceRef.current)
        }
        if (pendingFovAngleRef.current !== null) {
          onFovAngleChangedRef.current?.(devId, pendingFovAngleRef.current)
        }
      }

      pendingRotationRef.current = null
      pendingDistanceRef.current = null
      pendingFovAngleRef.current = null
      dragDeviceIdRef.current = null
    }

    // ── Create handles per sensor ──
    for (let sIdx = 0; sIdx < sensorRotations.length; sIdx++) {
      const sensorRot = sensorRotations[sIdx]
      const imagerData = data.perImagerData?.[sIdx]
      const sensorHFov = imagerData?.hFov ?? data.hFov
      const sensorOuterDist = (imagerData?.tiers || data.tiers)[0]?.distanceFt ?? 30
      const sensorColor = isMultiSensor ? (SENSOR_COLORS[sIdx % SENSOR_COLORS.length]) : '#6d28d9'
      const mapBearing = (sensorRot + 90 + 360) % 360
      const sHalfFov = sensorHFov / 2

      // Person icon at cone tip
      const personPos = destinationPoint(camLat, camLng, mapBearing, sensorOuterDist)
      const personMarker = new google.maps.Marker({
        position: personPos, map,
        icon: buildPersonSvg(sensorColor),
        draggable: true, zIndex: 10,
        title: isMultiSensor ? `Sensor ${sIdx + 1}: drag to set rotation & distance` : 'Drag to set rotation & distance',
      })
      fovHandleMarkersRef.current.push(personMarker)

      // Angle handles at arc edges
      const leftPos = destinationPoint(camLat, camLng, (mapBearing - sHalfFov + 360) % 360, sensorOuterDist)
      const rightPos = destinationPoint(camLat, camLng, (mapBearing + sHalfFov) % 360, sensorOuterDist)
      const leftMarker = new google.maps.Marker({
        position: leftPos, map,
        icon: buildCircleSvg(sensorColor),
        draggable: true, zIndex: 10,
        title: isMultiSensor ? `Sensor ${sIdx + 1}: drag to adjust FOV angle` : 'Drag to adjust FOV angle',
      })
      const rightMarker = new google.maps.Marker({
        position: rightPos, map,
        icon: buildCircleSvg(sensorColor),
        draggable: true, zIndex: 10,
        title: isMultiSensor ? `Sensor ${sIdx + 1}: drag to adjust FOV angle` : 'Drag to adjust FOV angle',
      })
      fovAngleHandlePairsRef.current.push([leftMarker, rightMarker])

      // ── Person icon drag: rotation + distance (this sensor only) ──
      const pDragStart = personMarker.addListener('dragstart', () => {
        isDraggingFovRef.current = true
        dragDeviceIdRef.current = selectedDeviceId
        dragSensorIdxRef.current = sIdx
        map.setOptions({ draggable: false })
      })
      fovPolygonListenersRef.current.push(pDragStart)

      const pDrag = personMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return
        const newBearing = bearingFromTo(camLat, camLng, e.latLng.lat(), e.latLng.lng())
        const newCanvasRot = ((newBearing - 90 + 360) % 360)
        const newDist = Math.max(5, Math.round(haversineDistanceFt(camLat, camLng, e.latLng.lat(), e.latLng.lng())))

        pendingRotationRef.current = Math.round(newCanvasRot)
        pendingDistanceRef.current = newDist

        // Live update THIS sensor's polygons only
        liveUpdateSensorPolygons(sIdx, newCanvasRot, newDist, sensorHFov)

        // Update camera marker icon rotation (single sensor only — multi-sensor body doesn't rotate)
        if (!isMultiSensor) {
          const devMarker = markersRef.current.get(selectedDeviceId)
          if (devMarker) devMarker.setIcon(buildCameraSymbol(dev.category, newCanvasRot, true))
        }

        // Reposition this sensor's angle handles
        const newMapB = (newCanvasRot + 90 + 360) % 360
        leftMarker.setPosition(destinationPoint(camLat, camLng, (newMapB - sHalfFov + 360) % 360, newDist))
        rightMarker.setPosition(destinationPoint(camLat, camLng, (newMapB + sHalfFov) % 360, newDist))
      })
      fovPolygonListenersRef.current.push(pDrag)

      const pDragEnd = personMarker.addListener('dragend', () => { commitDrag() })
      fovPolygonListenersRef.current.push(pDragEnd)

      // ── Angle handle drag: FOV angle (this sensor only) ──
      const setupAngleDrag = (handle: GMarker, otherHandle: GMarker, side: 'left' | 'right') => {
        const aDragStart = handle.addListener('dragstart', () => {
          isDraggingFovRef.current = true
          dragDeviceIdRef.current = selectedDeviceId
          dragSensorIdxRef.current = sIdx
          map.setOptions({ draggable: false })
        })
        fovPolygonListenersRef.current.push(aDragStart)

        const aDrag = handle.addListener('drag', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return
          const effectiveRot = pendingRotationRef.current ?? sensorRot
          const effectiveDist = pendingDistanceRef.current ?? sensorOuterDist
          const centerBearing = (effectiveRot + 90 + 360) % 360

          const handleBearing = bearingFromTo(camLat, camLng, e.latLng.lat(), e.latLng.lng())
          let diff = handleBearing - centerBearing
          if (diff > 180) diff -= 360
          if (diff < -180) diff += 360
          const newHalfFov = Math.max(5, Math.min(179, Math.abs(diff)))
          const newFovAngle = Math.round(newHalfFov * 2)

          pendingFovAngleRef.current = newFovAngle

          // Live update THIS sensor's polygons only
          liveUpdateSensorPolygons(sIdx, effectiveRot, effectiveDist, newFovAngle)

          // Reposition other handle symmetrically
          const otherBearing = side === 'left'
            ? (centerBearing + newHalfFov) % 360
            : (centerBearing - newHalfFov + 360) % 360
          otherHandle.setPosition(destinationPoint(camLat, camLng, otherBearing, effectiveDist))

          // Reposition person icon at centerline
          personMarker.setPosition(destinationPoint(camLat, camLng, centerBearing, effectiveDist))
        })
        fovPolygonListenersRef.current.push(aDrag)

        const aDragEnd = handle.addListener('dragend', () => { commitDrag() })
        fovPolygonListenersRef.current.push(aDragEnd)
      }

      setupAngleDrag(leftMarker, rightMarker, 'left')
      setupAngleDrag(rightMarker, leftMarker, 'right')
    }

    // ── Document-level mouseup safety net ──
    const docMouseUp = () => { commitDrag() }
    document.addEventListener('mouseup', docMouseUp)

    return () => {
      for (const l of fovPolygonListenersRef.current) l.remove()
      fovPolygonListenersRef.current = []
      document.removeEventListener('mouseup', docMouseUp)
      for (const m of fovHandleMarkersRef.current) m.setMap(null)
      fovHandleMarkersRef.current = []
      for (const [l, r] of fovAngleHandlePairsRef.current) { l.setMap(null); r.setMap(null) }
      fovAngleHandlePairsRef.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId, devices, fovData, showFovCones, geoContext, hiddenPpfZones, mapReady])

  // Context menu handler
  const handleContextMenuAction = (action: 'copy' | 'delete' | 'preview') => {
    if (!contextMenuRef.current) return

    const { deviceId } = contextMenuRef.current
    setContextMenuVisible(false)

    switch (action) {
      case 'copy':
        onDeviceCopy?.(deviceId)
        break
      case 'delete':
        onDeviceDelete?.(deviceId)
        break
      case 'preview':
        const dev = devices.find((d) => d.id === deviceId)
        if (dev) onShow3dPreview?.(dev)
        break
    }

    contextMenuRef.current = null
  }

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#f0f0f0',
      }}
    >
      {/* Context menu */}
      {contextMenuVisible && contextMenuRef.current && (
        <div
          style={{
            position: 'fixed',
            left: contextMenuRef.current.x,
            top: contextMenuRef.current.y,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 9999,
            minWidth: '120px',
          }}
        >
          <div
            style={{
              padding: '8px 0',
            }}
          >
            <div
              onClick={() => handleContextMenuAction('preview')}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
            >
              3D Preview
            </div>
            <div
              onClick={() => handleContextMenuAction('copy')}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
            >
              Copy
            </div>
            <div
              onClick={() => handleContextMenuAction('delete')}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#ef4444',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
            >
              Delete
            </div>
          </div>
        </div>
      )}

      {/* Click outside context menu to close */}
      {contextMenuVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9998,
          }}
          onClick={() => setContextMenuVisible(false)}
        />
      )}
    </div>
  )
}

export { CanvasArea }
export default CanvasArea
