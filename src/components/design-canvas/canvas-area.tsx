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

/* ─── Device icon mapping ─── */
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
  const groundOverlayRef = useRef<GOverlay | null>(null)
  const contextMenuRef = useRef<{ deviceId: string; x: number; y: number } | null>(null)
  const draggingDeviceRef = useRef<string | null>(null)
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
    script.onload = () => setMapReady(true)
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
        onSelectDeviceRef.current(null)
        const ctx = geoContextRef.current
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
      const iconUrl = CAT_TO_PNG[dev.category] || '/icons/cctv/dome.png'

      let marker = markersRef.current.get(dev.id)

      if (!marker) {
        marker = new google.maps.Marker({
          position: { lat, lng },
          map,
          icon: {
            url: iconUrl,
            scaledSize: new google.maps.Size(32, 32),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(16, 16),
          },
          draggable: isSelected,
          title: dev.label || 'Device',
        })

        // Marker click → select (uses ref to avoid stale closure)
        const devId = dev.id
        marker.addListener('click', () => {
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
        // Update marker position and draggable state
        marker.setPosition({ lat, lng })
        marker.setDraggable(isSelected)

        // Update opacity: selected = 1.0, others = 0.6
        const opacity = isSelected ? 1.0 : 0.6
        marker.setOpacity(opacity)
      }
    }

    // Remove markers for deleted devices
    for (const [devId, marker] of markersRef.current) {
      if (!seen.has(devId)) {
        marker.setMap(null)
        markersRef.current.delete(devId)
      }
    }
  }, [devices, selectedDeviceId, geoContext])

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
    const effectiveGoogleZoom = (mapRef.current.getZoom() ?? 18) + Math.log2(1)

    for (const [devId, data] of fovData) {
      const dev = devices.find((d) => d.id === devId)
      if (!dev) continue
      if (hiddenCategories?.has(dev.category)) continue

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
  }, [
    devices,
    fovData,
    showFovCones,
    geoContext,
    hiddenCategories,
    hiddenPpfZones,
    fovDisplayMode,
  ])

  // Update floor plan overlay
  useEffect(() => {
    if (!mapRef.current || !floorPlan || !geoContext) {
      if (groundOverlayRef.current) {
        groundOverlayRef.current.setMap(null)
        groundOverlayRef.current = null
      }
      return
    }

    const map = mapRef.current
    if (groundOverlayRef.current) {
      groundOverlayRef.current.setMap(null)
    }

    // For now, floor plan overlay is deferred (no image URL support)
    // This would require floorPlan.image_url or similar
  }, [floorPlan, geoContext])

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
