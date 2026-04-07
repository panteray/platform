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
  walls?: Array<{ id: string; points: Array<{ x: number; y: number }> }>
  onWallCreated?: (pts: Array<{ x: number; y: number }>) => void
  onWallDeleted?: (id: string) => void
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
  onWallSelected?: (id: string) => void
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
    phase: 'pick_mdf' | 'pick_device' | 'routing'
    mdfId?: string
    mdfPx?: { x: number; y: number }
    deviceId?: string
    devicePx?: { x: number; y: number }
    waypoints: Array<{ x: number; y: number }>
  } | null>(null)
  const cablePreviewRef = useRef<google.maps.Polyline | null>(null)
  const cableLabelRef = useRef<google.maps.InfoWindow | null>(null)
  const cableMoveListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const activeToolRef = useRef(activeTool)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  const mdfMarkersRef = useRef<Map<string, GMarker>>(new Map())
  const cablePolylinesRef = useRef<google.maps.Polyline[]>([])
  const wallPolylinesRef = useRef<google.maps.Polyline[]>([])
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
  const onCableCreatedRef = useRef(onCableCreated)
  useEffect(() => { onCableCreatedRef.current = onCableCreated }, [onCableCreated])
  const onToolChangeRef = useRef(onToolChange)
  useEffect(() => { onToolChangeRef.current = onToolChange }, [onToolChange])

  // ── Cable drawing helpers ──
  const cleanupCableDraw = useCallback(() => {
    cableDrawRef.current = null
    cableMoveListenerRef.current?.remove()
    cableMoveListenerRef.current = null
    cablePreviewRef.current?.setMap(null)
    cablePreviewRef.current = null
    cableLabelRef.current?.close()
    cableLabelRef.current = null
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
    if (!cableLabelRef.current) {
      cableLabelRef.current = new google.maps.InfoWindow({
        content: `<div style="font:bold 13px Inter,sans-serif;color:#f97316;background:rgba(0,0,0,0.7);padding:2px 8px;border-radius:4px">${ft} ft</div>`,
        position: lastPt, disableAutoPan: true,
      })
      cableLabelRef.current.open(mapRef.current)
    } else {
      cableLabelRef.current.setContent(`<div style="font:bold 13px Inter,sans-serif;color:#f97316;background:rgba(0,0,0,0.7);padding:2px 8px;border-radius:4px">${ft} ft</div>`)
      if (lastPt) cableLabelRef.current.setPosition(lastPt)
    }
  }, [calcWaypointLengthFt])

  // Finish cable routing: commits the cable to DB
  const finishCableRouting = useCallback(() => {
    const draw = cableDrawRef.current
    if (!draw || draw.phase !== 'routing' || !draw.mdfPx || !draw.devicePx || !draw.deviceId) return

    const allWaypoints = [draw.mdfPx, ...draw.waypoints, draw.devicePx]
    const lengthFt = calcWaypointLengthFt(allWaypoints)

    onCableCreatedRef.current?.({
      from_device_id: draw.deviceId,
      to_device_id: null,
      waypoints: allWaypoints,
      length_ft: lengthFt,
    })

    cleanupCableDraw()
    onToolChangeRef.current?.('select')
  }, [calcWaypointLengthFt, cleanupCableDraw])

  // Step 1: Click MDF → Step 2: Click Device → Step 3: Route waypoints → click device/dblclick/Enter to finish
  const handleCableClick = useCallback((id: string, type: 'device' | 'mdf', px: number, py: number) => {
    const draw = cableDrawRef.current

    // ── Phase: pick_mdf — first click must be MDF ──
    if (!draw || draw.phase === 'pick_mdf') {
      if (type !== 'mdf') return // ignore non-MDF clicks
      cableDrawRef.current = { phase: 'pick_device', mdfId: id, mdfPx: { x: px, y: py }, waypoints: [] }
      // Show preview from MDF following mouse
      const ctx = geoContextRef.current
      if (mapRef.current && ctx) {
        cableMoveListenerRef.current = mapRef.current.addListener('mousemove', (e: google.maps.MapMouseEvent) => {
          const d = cableDrawRef.current
          if (!d || !e.latLng) return
          if (d.phase === 'pick_device' && d.mdfPx) {
            showCablePreview([d.mdfPx], e.latLng.lat(), e.latLng.lng())
          } else if (d.phase === 'routing' && d.mdfPx && d.devicePx) {
            const allPts = [d.mdfPx, ...d.waypoints, d.devicePx]
            // During routing, show line from MDF → waypoints → mouse → device
            // Insert mouse position before last point (device)
            const routePts = [d.mdfPx, ...d.waypoints]
            showCablePreview(routePts, e.latLng.lat(), e.latLng.lng())
          }
        })
      }
      return
    }

    // ── Phase: pick_device — second click must be Device ──
    if (draw.phase === 'pick_device') {
      if (type !== 'device') return // ignore non-device clicks
      draw.phase = 'routing'
      draw.deviceId = id
      draw.devicePx = { x: px, y: py }
      // Show straight line MDF → Device, user can now click map to add waypoints
      showCablePreview([draw.mdfPx!, { x: px, y: py }])
      return
    }

    // ── Phase: routing — clicking the connected device snaps/finishes the cable ──
    if (draw.phase === 'routing') {
      if (type === 'device' && id === draw.deviceId) {
        // Snap to the connected device — finish routing
        finishCableRouting()
      }
      // Clicking any other device or MDF during routing also finishes
      // (user is done routing, snap the endpoint)
      if (type === 'device') {
        // Update device endpoint to the clicked device
        draw.deviceId = id
        draw.devicePx = { x: px, y: py }
        finishCableRouting()
      }
      return
    }
  }, [showCablePreview, finishCableRouting])

  // Map click during cable routing phase → add waypoint between MDF and device
  const handleCableMapClick = useCallback((x: number, y: number) => {
    const draw = cableDrawRef.current
    if (!draw) return

    if (draw.phase === 'routing') {
      draw.waypoints.push({ x: Math.round(x), y: Math.round(y) })
      // Rebuild full path: MDF → waypoints → device
      const allPts = [draw.mdfPx!, ...draw.waypoints, draw.devicePx!]
      showCablePreview(allPts)
    }
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

    // Map click → deselect device
    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      setContextMenuVisible(false)
      if (e.latLng) {
        const ctx = geoContextRef.current
        // Cable routing phase: map clicks add waypoints
        if (activeToolRef.current === 'cable' && cableDrawRef.current?.phase === 'routing' && ctx) {
          const { x, y } = latLngToCanvasPixels(e.latLng.lat(), e.latLng.lng(), ctx)
          handleCableMapClick(x, y)
          return
        }
        onSelectDeviceRef.current(null)
        if (onCanvasClickRef.current && ctx) {
          const { x, y } = latLngToCanvasPixels(e.latLng.lat(), e.latLng.lng(), ctx)
          onCanvasClickRef.current(x, y)
        }
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

        // Marker click → select or cable mode
        const devId = dev.id
        marker.addListener('click', () => {
          if (activeToolRef.current === 'cable') {
            handleCableClick(devId, 'device', dev.position_x, dev.position_y)
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

        // Marker drag end → convert lat/lng back to px, call onDeviceMoved
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
        marker.addListener('click', () => {
          if (activeToolRef.current === 'cable') {
            handleCableClick(mdfId, 'mdf', mdf.position_x, mdf.position_y)
            return
          }
          onMdfSelectedRef.current?.(mdfId)
        })
        marker.addListener('rightclick', () => {
          if (confirm(`Delete ${mdf.name || 'MDF/IDF'} from map?`)) {
            onMdfIdfDeletedRef.current?.(mdfId)
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

  // Render cable polylines on Google Maps
  useEffect(() => {
    // Clear old polylines
    for (const pl of cablePolylinesRef.current) pl.setMap(null)
    cablePolylinesRef.current = []

    if (!mapRef.current || !geoContext || !cables.length) return
    const map = mapRef.current

    for (const cable of cables) {
      if (!cable.waypoints || cable.waypoints.length < 2) continue
      const path = cable.waypoints.map(wp => {
        const { lat, lng } = canvasPixelsToLatLng(wp.x, wp.y, geoContext)
        return { lat, lng }
      })
      const color = cable.color_hex || '#f97316'
      const polyline = new google.maps.Polyline({
        path,
        strokeColor: color,
        strokeOpacity: 0,
        strokeWeight: 0,
        map,
        clickable: false,
        zIndex: 1,
        icons: [{
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: color, scale: 2 },
          offset: '0', repeat: '10px',
        }],
      })
      cablePolylinesRef.current.push(polyline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cables, geoContext, mapReady])

  // Render wall polylines on Google Maps
  useEffect(() => {
    // Clear old wall lines
    for (const pl of wallPolylinesRef.current) pl.setMap(null)
    wallPolylinesRef.current = []

    if (!mapRef.current || !geoContext || !walls?.length) return
    const map = mapRef.current

    for (const wall of walls) {
      if (!wall.points || wall.points.length < 2) continue
      const path = wall.points.map(pt => {
        const { lat, lng } = canvasPixelsToLatLng(pt.x, pt.y, geoContext)
        return { lat, lng }
      })
      const polyline = new google.maps.Polyline({
        path,
        strokeColor: '#ef4444',
        strokeOpacity: 0.9,
        strokeWeight: 3,
        map,
        clickable: false,
        zIndex: 2,
      })
      wallPolylinesRef.current.push(polyline)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walls, geoContext, mapReady])

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
