'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  ZoomIn, ZoomOut, Hand, MousePointer, Cable as CableIcon,
  X, Crosshair, Search,
} from 'lucide-react'
import type { SurveyFloorPlan, SurveyDevice, SurveyCable } from '@/types/database'
import {
  SURVEY_SYSTEM_TYPES, SURVEY_DEVICE_TYPES, SYSTEM_TYPE_COLORS,
  SURVEY_CABLE_TYPES, DEFAULT_FOV_ANGLES, generateDeviceLabel,
} from '@/lib/survey-constants'
import { C, CABLE_DEFAULT_COLORS } from '../design-canvas/constants'
import { useMapsApiKey } from '../design-canvas/use-maps-api-key'
import { SurveyDevicePanel } from './SurveyDevicePanel'
import { SurveyDeviceIcon, surveyDeviceIconDataUrl } from './survey-device-icons'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Props {
  surveyId: string
  floorPlan: SurveyFloorPlan
  devices: SurveyDevice[]
  allDevices: SurveyDevice[]
  onDevicesChanged: (devices: SurveyDevice[]) => void
  readOnly?: boolean
}

type Tool = 'select' | 'pan' | 'cable' | 'scale' | 'place'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const btnStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  background: active ? C.accentSubtle : 'transparent',
  border: active ? `1px solid ${C.accent}40` : '1px solid transparent',
  borderRadius: 3,
  color: active ? C.accent : C.textMuted,
  fontSize: 10,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: '2px 6px',
  height: 26,
})

function getCableColorForType(t: string): string {
  const key = t.toLowerCase().replace(/\s+/g, '_').replace('—', '').replace('-', '_').trim()
  return CABLE_DEFAULT_COLORS[key] ?? CABLE_DEFAULT_COLORS.other ?? '#78716c'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SurveyCanvas({
  surveyId,
  floorPlan,
  devices,
  allDevices,
  onDevicesChanged,
  readOnly = false,
}: Props) {
  const mapsApiKey = useMapsApiKey()

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const cablesPolyRef = useRef<Map<string, google.maps.Polyline>>(new Map())
  const draftPolyRef = useRef<google.maps.Polyline | null>(null)
  const groundOverlayRef = useRef<google.maps.GroundOverlay | null>(null)
  const scaleLineRef = useRef<google.maps.Polyline | null>(null)
  const scriptLoadedRef = useRef(false)

  // State
  const [tool, setTool] = useState<Tool>('select')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('cctv')
  const [paletteSearch, setPaletteSearch] = useState('')
  const [placingDevice, setPlacingDevice] = useState<{ systemType: string; deviceType: string } | null>(null)

  // Cable state
  const [cables, setCables] = useState<SurveyCable[]>([])
  const [draftCablePoints, setDraftCablePoints] = useState<google.maps.LatLng[]>([])
  const [cableType, setCableType] = useState('cat6')
  const [cableSlack, setCableSlack] = useState(10)

  // Scale
  const [scalePxPerFt, setScalePxPerFt] = useState<number | null>(floorPlan.scale_px_per_ft ?? null)
  const [scalePoints, setScalePoints] = useState<google.maps.LatLng[]>([])

  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null

  // ---------------------------------------------------------------------------
  // Load Google Maps script
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapsApiKey || scriptLoadedRef.current) return
    if (typeof google !== 'undefined' && google.maps) {
      scriptLoadedRef.current = true
      setMapReady(true)
      return
    }

    const existing = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existing) {
      const check = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          scriptLoadedRef.current = true
          clearInterval(check)
          setMapReady(prev => !prev)
        }
      }, 200)
      return () => clearInterval(check)
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}`
    script.async = true
    script.defer = true
    script.onload = () => {
      scriptLoadedRef.current = true
      setMapReady(true)
    }
    document.head.appendChild(script)
  }, [mapsApiKey])

  // ---------------------------------------------------------------------------
  // Initialize Map
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || !mapsApiKey) return
    if (typeof google === 'undefined' || !google.maps) return
    if (mapRef.current) return

    const lat = floorPlan.satellite_lat ?? 30.0
    const lng = floorPlan.satellite_lng ?? -90.0
    const zoom = floorPlan.satellite_zoom ?? 18

    const satelliteCleanStyle: google.maps.MapTypeStyle[] = [
      { elementType: 'labels', stylers: [{ visibility: 'off' }] },
      { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    ]

    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat, lng },
      zoom,
      mapTypeId: 'satellite',
      disableDefaultUI: true,
      zoomControl: false,
      gestureHandling: 'greedy',
      draggableCursor: 'default',
      draggingCursor: 'grabbing',
      keyboardShortcuts: true,
      styles: satelliteCleanStyle,
    })

    mapRef.current = map

    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      handleMapClick(e.latLng)
    })

    map.addListener('dblclick', () => {
      handleDblClick()
    })

    // Persist map center+zoom when user pans/zooms
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    map.addListener('idle', () => {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        const center = map.getCenter()
        const z = map.getZoom()
        if (!center || z == null) return
        fetch(`/api/org/surveys/${surveyId}/floor-plans?fp_id=${floorPlan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            satellite_lat: center.lat(),
            satellite_lng: center.lng(),
            satellite_zoom: z,
          }),
        })
      }, 800)
    })

    setMapReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsApiKey, mapReady])

  // ---------------------------------------------------------------------------
  // Floor plan overlay
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapRef.current || !floorPlan.image_url) return
    if (groundOverlayRef.current) {
      groundOverlayRef.current.setMap(null)
    }

    const lat = floorPlan.satellite_lat ?? 30.0
    const lng = floorPlan.satellite_lng ?? -90.0
    const spread = 0.002

    const bounds = new google.maps.LatLngBounds(
      { lat: lat - spread, lng: lng - spread },
      { lat: lat + spread, lng: lng + spread }
    )

    const overlay = new google.maps.GroundOverlay(floorPlan.image_url, bounds, {
      opacity: 0.7,
      clickable: false,
    })
    overlay.setMap(mapRef.current)
    groundOverlayRef.current = overlay
  }, [floorPlan.image_url, floorPlan.satellite_lat, floorPlan.satellite_lng, mapReady])

  // ---------------------------------------------------------------------------
  // Load cables
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    fetch(`/api/org/surveys/${surveyId}/cables`)
      .then(r => r.ok ? r.json() : [])
      .then((data: SurveyCable[]) => {
        if (cancelled) return
        setCables((data || []).filter(c => c.floor_plan_id === floorPlan.id))
      })
      .catch(e => console.error('[SurveyCanvas] Failed to load cables:', e))
    return () => { cancelled = true }
  }, [surveyId, floorPlan.id])

  // ---------------------------------------------------------------------------
  // Sync device markers to map
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const existing = markersRef.current
    const currentIds = new Set(devices.map(d => d.id))

    for (const [id, marker] of existing) {
      if (!currentIds.has(id)) {
        marker.setMap(null)
        existing.delete(id)
      }
    }

    for (const device of devices) {
      const color = device.color_hex || SYSTEM_TYPE_COLORS[device.system_type] || '#6b7280'
      const pos = deviceToLatLng(device, map)
      const isSelected = device.id === selectedDeviceId
      const iconSize = isSelected ? 36 : 28
      const iconHalf = iconSize / 2
      const iconUrl = surveyDeviceIconDataUrl(device.system_type, device.device_type, color, iconSize, isSelected)

      if (existing.has(device.id)) {
        const marker = existing.get(device.id)!
        marker.setPosition(pos)
        marker.setIcon({
          url: iconUrl,
          scaledSize: new google.maps.Size(iconSize, iconSize),
          anchor: new google.maps.Point(iconHalf, iconHalf),
          labelOrigin: new google.maps.Point(iconHalf, iconSize + 8),
        })
        marker.setLabel({
          text: device.label,
          color: '#fff',
          fontSize: '10px',
          fontWeight: 'bold',
          className: 'survey-marker-label',
        })
        marker.setZIndex(isSelected ? 20 : 10)
      } else {
        const marker = new google.maps.Marker({
          position: pos,
          map,
          icon: {
            url: iconUrl,
            scaledSize: new google.maps.Size(iconSize, iconSize),
            anchor: new google.maps.Point(iconHalf, iconHalf),
            labelOrigin: new google.maps.Point(iconHalf, iconSize + 8),
          },
          label: {
            text: device.label,
            color: '#fff',
            fontSize: '10px',
            fontWeight: 'bold',
            className: 'survey-marker-label',
          },
          draggable: !readOnly,
          zIndex: isSelected ? 20 : 10,
        })

        marker.addListener('click', () => {
          setSelectedDeviceId(device.id)
        })

        if (!readOnly) {
          marker.addListener('dragend', () => {
            const newPos = marker.getPosition()
            if (!newPos || !mapRef.current) return
            const { px, py } = latLngToDevicePos(newPos, mapRef.current)
            onDevicesChanged(
              allDevices.map(d => d.id === device.id ? { ...d, position_x: px, position_y: py } : d)
            )
            fetch(`/api/org/surveys/${surveyId}/devices?device_id=${device.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ position_x: px, position_y: py }),
            })
          })
        }

        existing.set(device.id, marker)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, mapReady, readOnly, selectedDeviceId])

  // ---------------------------------------------------------------------------
  // Sync cable polylines to map
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const existing = cablesPolyRef.current
    const currentIds = new Set(cables.map(c => c.id))

    for (const [id, poly] of existing) {
      if (!currentIds.has(id)) {
        poly.setMap(null)
        existing.delete(id)
      }
    }

    for (const cable of cables) {
      if (existing.has(cable.id)) continue
      const pts = (cable.polyline || []) as [number, number][]
      if (pts.length < 2) continue

      const path = pts.map(([px, py]) => pixelToLatLng(px, py, map))
      const color = cable.color_hex || getCableColorForType(cable.cable_type || 'other')

      const poly = new google.maps.Polyline({
        path,
        map,
        strokeColor: color,
        strokeWeight: 3,
        strokeOpacity: 0.9,
        zIndex: 5,
      })

      existing.set(cable.id, poly)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cables, mapReady])

  // ---------------------------------------------------------------------------
  // Coordinate conversion helpers
  // ---------------------------------------------------------------------------
  function deviceToLatLng(device: SurveyDevice, map: google.maps.Map): google.maps.LatLng {
    return pixelToLatLng(device.position_x, device.position_y, map)
  }

  function pixelToLatLng(px: number, py: number, _map: google.maps.Map): google.maps.LatLng {
    const centerLat = floorPlan.satellite_lat ?? 30.0
    const centerLng = floorPlan.satellite_lng ?? -90.0
    const zoom = floorPlan.satellite_zoom ?? 18

    const metersPerPx = (156543.03392 * Math.cos(centerLat * Math.PI / 180)) / Math.pow(2, zoom)
    const offsetXMeters = (px - 500) * metersPerPx
    const offsetYMeters = (py - 400) * metersPerPx

    const lat = centerLat - (offsetYMeters / 111320)
    const lng = centerLng + (offsetXMeters / (111320 * Math.cos(centerLat * Math.PI / 180)))

    return new google.maps.LatLng(lat, lng)
  }

  function latLngToDevicePos(latLng: google.maps.LatLng, _map: google.maps.Map): { px: number; py: number } {
    const centerLat = floorPlan.satellite_lat ?? 30.0
    const centerLng = floorPlan.satellite_lng ?? -90.0
    const zoom = floorPlan.satellite_zoom ?? 18

    const metersPerPx = (156543.03392 * Math.cos(centerLat * Math.PI / 180)) / Math.pow(2, zoom)
    const dLat = centerLat - latLng.lat()
    const dLng = latLng.lng() - centerLng

    const offsetYMeters = dLat * 111320
    const offsetXMeters = dLng * 111320 * Math.cos(centerLat * Math.PI / 180)

    return {
      px: 500 + offsetXMeters / metersPerPx,
      py: 400 + offsetYMeters / metersPerPx,
    }
  }

  function latLngDistanceFt(a: google.maps.LatLng, b: google.maps.LatLng): number {
    const R = 20902231
    const dLat = (b.lat() - a.lat()) * Math.PI / 180
    const dLng = (b.lng() - a.lng()) * Math.PI / 180
    const sinDLat = Math.sin(dLat / 2)
    const sinDLng = Math.sin(dLng / 2)
    const h = sinDLat * sinDLat + Math.cos(a.lat() * Math.PI / 180) * Math.cos(b.lat() * Math.PI / 180) * sinDLng * sinDLng
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  }

  // ---------------------------------------------------------------------------
  // Map click handler (dispatches by tool)
  // ---------------------------------------------------------------------------
  const handleMapClickRef = useRef<(latLng: google.maps.LatLng) => void>(() => {})
  const handleDblClickRef = useRef<() => void>(() => {})

  handleMapClickRef.current = (latLng: google.maps.LatLng) => {
    if (readOnly) return

    if (tool === 'place' && placingDevice) {
      createDeviceAtLatLng(latLng, placingDevice.systemType, placingDevice.deviceType)
      setPlacingDevice(null)
      setTool('select')
      return
    }

    if (tool === 'cable') {
      const pts = [...draftCablePoints, latLng]
      setDraftCablePoints(pts)
      updateDraftPolyline(pts)
      return
    }

    if (tool === 'scale') {
      const pts = [...scalePoints, latLng]
      setScalePoints(pts)
      updateScaleLine(pts)
      if (pts.length === 2) {
        const distFt = latLngDistanceFt(pts[0], pts[1])
        const ftStr = typeof window !== 'undefined'
          ? window.prompt(`Map distance: ${distFt.toFixed(1)} ft. Enter actual distance in feet (or accept this value):`, distFt.toFixed(1))
          : null
        const ft = ftStr ? parseFloat(ftStr) : NaN
        if (ft > 0 && mapRef.current) {
          const p1 = latLngToDevicePos(pts[0], mapRef.current)
          const p2 = latLngToDevicePos(pts[1], mapRef.current)
          const mapDistPx = Math.sqrt((p2.px - p1.px) ** 2 + (p2.py - p1.py) ** 2)
          const pxPerFt = mapDistPx / ft
          saveCalibration(pxPerFt)
        }
        setScalePoints([])
        clearScaleLine()
        setTool('select')
      }
      return
    }

    if (tool === 'select') {
      setSelectedDeviceId(null)
    }
  }

  handleDblClickRef.current = () => {
    if (tool === 'cable' && draftCablePoints.length >= 2) {
      finishCable()
    }
  }

  function handleMapClick(latLng: google.maps.LatLng) {
    handleMapClickRef.current(latLng)
  }
  function handleDblClick() {
    handleDblClickRef.current()
  }

  // ---------------------------------------------------------------------------
  // Device CRUD
  // ---------------------------------------------------------------------------
  async function createDeviceAtLatLng(latLng: google.maps.LatLng, systemType: string, deviceType: string) {
    if (!mapRef.current) return

    const { px, py } = latLngToDevicePos(latLng, mapRef.current)
    const label = generateDeviceLabel(systemType, deviceType, allDevices.map(d => d.label))
    const fovAngle = systemType === 'cctv' ? (DEFAULT_FOV_ANGLES[deviceType] || 90) : undefined

    const res = await fetch(`/api/org/surveys/${surveyId}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        floor_plan_id: floorPlan.id,
        system_type: systemType,
        device_type: deviceType,
        label,
        position_x: px,
        position_y: py,
        fov_angle: fovAngle,
        color_hex: SYSTEM_TYPE_COLORS[systemType] || '#6b7280',
      }),
    })

    if (res.ok) {
      const device = await res.json()
      onDevicesChanged([...allDevices, device])
      setSelectedDeviceId(device.id)
    }
  }

  function handleAddDevice(systemType: string, deviceType: string) {
    if (readOnly) return
    setPlacingDevice({ systemType, deviceType })
    setTool('place')
  }

  async function handleDeleteDevice(deviceId: string) {
    const res = await fetch(`/api/org/surveys/${surveyId}/devices?device_id=${deviceId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      onDevicesChanged(allDevices.filter(d => d.id !== deviceId))
      if (selectedDeviceId === deviceId) setSelectedDeviceId(null)
    }
  }

  async function handleUpdateDevice(deviceId: string, updates: Partial<SurveyDevice>) {
    const res = await fetch(`/api/org/surveys/${surveyId}/devices?device_id=${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const updated = await res.json()
      onDevicesChanged(allDevices.map(d => d.id === deviceId ? { ...d, ...updated } : d))
    }
  }

  // ---------------------------------------------------------------------------
  // Cable logic
  // ---------------------------------------------------------------------------
  function updateDraftPolyline(pts: google.maps.LatLng[]) {
    if (!mapRef.current) return
    if (draftPolyRef.current) {
      draftPolyRef.current.setPath(pts)
    } else {
      const color = getCableColorForType(cableType)
      draftPolyRef.current = new google.maps.Polyline({
        path: pts,
        map: mapRef.current,
        strokeColor: color,
        strokeWeight: 3,
        strokeOpacity: 0.6,
        zIndex: 15,
      })
    }
  }

  function clearDraftPolyline() {
    if (draftPolyRef.current) {
      draftPolyRef.current.setMap(null)
      draftPolyRef.current = null
    }
    setDraftCablePoints([])
  }

  async function finishCable() {
    if (draftCablePoints.length < 2 || !mapRef.current) return

    const polyline: [number, number][] = draftCablePoints.map(ll => {
      const { px, py } = latLngToDevicePos(ll, mapRef.current!)
      return [px, py]
    })

    let totalFt = 0
    for (let i = 1; i < draftCablePoints.length; i++) {
      totalFt += latLngDistanceFt(draftCablePoints[i - 1], draftCablePoints[i])
    }
    const lengthFt = totalFt * (1 + cableSlack / 100)
    const color = getCableColorForType(cableType)

    const res = await fetch(`/api/org/surveys/${surveyId}/cables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        floor_plan_id: floorPlan.id,
        label: `C-${cables.length + 1}`,
        cable_type: cableType,
        color_hex: color,
        slack_pct: cableSlack,
        polyline,
        length_ft: lengthFt,
      }),
    })

    if (res.ok) {
      const created = await res.json()
      setCables(prev => [...prev, created])
    }

    clearDraftPolyline()
  }

  // ---------------------------------------------------------------------------
  // Scale calibration
  // ---------------------------------------------------------------------------
  async function saveCalibration(pxPerFt: number) {
    setScalePxPerFt(pxPerFt)
    await fetch(`/api/org/surveys/${surveyId}/floor-plans?fp_id=${floorPlan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scale_px_per_ft: pxPerFt }),
    })
  }

  function updateScaleLine(pts: google.maps.LatLng[]) {
    if (!mapRef.current) return
    if (scaleLineRef.current) {
      scaleLineRef.current.setPath(pts)
    } else {
      scaleLineRef.current = new google.maps.Polyline({
        path: pts,
        map: mapRef.current,
        strokeColor: '#f59e0b',
        strokeWeight: 2,
        strokeOpacity: 1,
        zIndex: 20,
      })
    }
  }

  function clearScaleLine() {
    if (scaleLineRef.current) {
      scaleLineRef.current.setMap(null)
      scaleLineRef.current = null
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tool === 'cable' && e.key === 'Enter') finishCable()
      if (tool === 'cable' && e.key === 'Escape') { clearDraftPolyline(); setTool('select') }
      if (tool === 'scale' && e.key === 'Escape') { setScalePoints([]); clearScaleLine(); setTool('select') }
      if (tool === 'place' && e.key === 'Escape') { setPlacingDevice(null); setTool('select') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, draftCablePoints, scalePoints])

  // ---------------------------------------------------------------------------
  // Zoom controls
  // ---------------------------------------------------------------------------
  const handleZoomIn = useCallback(() => {
    if (!mapRef.current) return
    const z = mapRef.current.getZoom()
    if (z != null) mapRef.current.setZoom(z + 1)
  }, [])

  const handleZoomOut = useCallback(() => {
    if (!mapRef.current) return
    const z = mapRef.current.getZoom()
    if (z != null) mapRef.current.setZoom(z - 1)
  }, [])

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  const deviceCounts = devices.reduce<Record<string, number>>((acc, d) => {
    acc[d.system_type] = (acc[d.system_type] || 0) + 1
    return acc
  }, {})
  const totalCableFt = cables.reduce((sum, c) => sum + (c.length_ft || 0), 0)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 500, background: C.bg }}>
      {/* TOOL STRIP — 32px */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 32,
        padding: '0 8px',
        background: C.bgSurface,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button style={btnStyle(tool === 'select')} onClick={() => { setTool('select'); setPlacingDevice(null) }} title="Select">
          <MousePointer size={13} /> <span>Select</span>
        </button>
        <button style={btnStyle(tool === 'pan')} onClick={() => { setTool('pan'); setPlacingDevice(null) }} title="Pan">
          <Hand size={13} /> <span>Pan</span>
        </button>
        {!readOnly && (
          <>
            <button style={btnStyle(tool === 'cable')} onClick={() => { setTool('cable'); setPlacingDevice(null); clearDraftPolyline() }} title="Draw Cable">
              <CableIcon size={13} /> <span>Cable</span>
            </button>
            <button style={btnStyle(tool === 'scale')} onClick={() => { setTool('scale'); setScalePoints([]); clearScaleLine(); setPlacingDevice(null) }} title="Calibrate Scale">
              <Crosshair size={13} /> <span>Scale</span>
            </button>
          </>
        )}

        {tool === 'cable' && !readOnly && (
          <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: C.textMuted }}>Type:</span>
            <select
              value={cableType}
              onChange={e => setCableType(e.target.value)}
              style={{
                fontSize: 9,
                background: C.bgPanel,
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                padding: '1px 4px',
              }}
            >
              {SURVEY_CABLE_TYPES.map(ct => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
            <span style={{ fontSize: 9, color: C.textMuted }}>Slack:</span>
            <input
              type="number"
              value={cableSlack}
              onChange={e => setCableSlack(Number(e.target.value) || 0)}
              style={{
                width: 36,
                fontSize: 9,
                background: C.bgPanel,
                color: C.text,
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                padding: '1px 4px',
              }}
            />
            <span style={{ fontSize: 9, color: C.textMuted }}>%</span>
            {draftCablePoints.length >= 2 && (
              <button
                style={{ ...btnStyle(false), fontSize: 9, color: C.accent }}
                onClick={() => finishCable()}
              >Finish ({draftCablePoints.length} pts)</button>
            )}
          </div>
        )}

        {tool === 'scale' && (
          <span style={{ marginLeft: 8, fontSize: 9, color: C.textMuted }}>
            Click two points to calibrate ({scalePoints.length}/2)
          </span>
        )}

        {tool === 'place' && placingDevice && (
          <span style={{ marginLeft: 8, fontSize: 9, color: C.accent }}>
            Click map to place device (Esc to cancel)
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button style={btnStyle(false)} onClick={handleZoomIn} title="Zoom In">
          <ZoomIn size={13} />
        </button>
        <button style={btnStyle(false)} onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut size={13} />
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* DEVICE PALETTE — 220px, tabs + search + list */}
        {!readOnly && !selectedDevice && (
          <div style={{
            width: 220,
            background: C.bgSurface,
            borderRight: `1px solid ${C.border}`,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}>
            {/* Category tabs — 3×2 grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              borderBottom: `1px solid ${C.border}`,
            }}>
              {SURVEY_SYSTEM_TYPES.map(sys => {
                const isActive = activeCategory === sys.value
                const count = deviceCounts[sys.value] || 0
                const short = sys.value === 'access_control' ? 'ACS'
                  : sys.value === 'vape_environmental' ? 'Vape'
                  : sys.label
                return (
                  <button
                    key={sys.value}
                    onClick={() => setActiveCategory(sys.value)}
                    title={sys.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px 2px',
                      gap: 2,
                      background: isActive ? C.bgActive : 'transparent',
                      border: 'none',
                      borderBottom: isActive ? `2px solid ${sys.color}` : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      fontSize: 9,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? C.text : C.textMuted,
                    }}>{short}</span>
                    {count > 0 && (
                      <span style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: '#fff',
                        background: sys.color,
                        padding: '0 4px',
                        borderRadius: 6,
                        minWidth: 14,
                        textAlign: 'center',
                      }}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Search */}
            <div style={{ padding: 6, borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: C.bgPanel,
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                padding: '2px 6px',
              }}>
                <Search size={11} color={C.textMuted} />
                <input
                  value={paletteSearch}
                  onChange={e => setPaletteSearch(e.target.value)}
                  placeholder="Search devices..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: C.text,
                    fontSize: 10,
                    padding: '2px 0',
                  }}
                />
              </div>
            </div>

            {/* Device list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
              {(() => {
                const search = paletteSearch.trim().toLowerCase()
                const sourceCategories = search
                  ? SURVEY_SYSTEM_TYPES.map(s => s.value)
                  : [activeCategory]
                const rows: { sys: string; color: string; value: string; label: string }[] = []
                for (const catValue of sourceCategories) {
                  const sys = SURVEY_SYSTEM_TYPES.find(s => s.value === catValue)
                  if (!sys) continue
                  const list = SURVEY_DEVICE_TYPES[catValue as keyof typeof SURVEY_DEVICE_TYPES] || []
                  for (const dt of list) {
                    if (search && !dt.label.toLowerCase().includes(search) && !dt.value.toLowerCase().includes(search)) continue
                    rows.push({ sys: sys.value, color: sys.color, value: dt.value, label: dt.label })
                  }
                }
                if (rows.length === 0) {
                  return (
                    <div style={{ padding: 12, textAlign: 'center', fontSize: 10, color: C.textMuted }}>
                      No matching devices
                    </div>
                  )
                }
                return rows.map(row => (
                  <button
                    key={`${row.sys}:${row.value}`}
                    onClick={() => handleAddDevice(row.sys, row.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '4px 6px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontSize: 11,
                      color: C.text,
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.bgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <SurveyDeviceIcon systemType={row.sys} deviceType={row.value} color={row.color} size={18} />
                    <span>{row.label}</span>
                  </button>
                ))
              })()}
            </div>

            {/* Placed inventory */}
            {devices.length > 0 && (
              <div style={{
                borderTop: `1px solid ${C.border}`,
                padding: 6,
                maxHeight: 180,
                overflowY: 'auto',
              }}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  color: C.textMuted,
                  marginBottom: 4,
                }}>
                  Placed on map ({devices.length})
                </div>
                {devices.map(d => {
                  const sys = SURVEY_SYSTEM_TYPES.find(s => s.value === d.system_type)
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDeviceId(d.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        padding: '3px 4px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 2,
                        cursor: 'pointer',
                        fontSize: 10,
                        color: C.text,
                        textAlign: 'left',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.bgHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: d.color_hex || sys?.color || '#6b7280', flexShrink: 0,
                      }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* MAP CONTAINER */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div
            ref={mapContainerRef}
            style={{
              position: 'absolute',
              inset: 0,
              cursor: tool === 'pan' ? 'grab'
                : (tool === 'place' || tool === 'cable' || tool === 'scale') ? 'crosshair'
                : 'default',
            }}
          />
          {!mapsApiKey && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: C.bg,
              color: C.textMuted,
              fontSize: 12,
            }}>
              Loading maps...
            </div>
          )}
        </div>

        {/* RIGHT PANEL — device properties */}
        {selectedDevice && (
          <div style={{
            width: 300,
            borderLeft: `1px solid ${C.border}`,
            background: C.bgPanel,
            overflowY: 'auto',
            position: 'relative',
          }}>
            <button
              onClick={() => setSelectedDeviceId(null)}
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: C.textMuted,
                zIndex: 5,
              }}
            >
              <X size={14} />
            </button>
            <SurveyDevicePanel
              device={selectedDevice}
              surveyId={surveyId}
              onUpdate={(updates) => handleUpdateDevice(selectedDevice.id, updates)}
              onDelete={() => handleDeleteDevice(selectedDevice.id)}
              onClose={() => setSelectedDeviceId(null)}
              readOnly={readOnly}
            />
          </div>
        )}
      </div>

      {/* STATUS BAR — 28px */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 28,
        padding: '0 10px',
        background: C.bgSurface,
        borderTop: `1px solid ${C.border}`,
        fontSize: 10,
        color: C.textMuted,
      }}>
        <span>Devices: {devices.length}</span>
        {Object.entries(deviceCounts).map(([sys, count]) => {
          const info = SURVEY_SYSTEM_TYPES.find(s => s.value === sys)
          return (
            <span key={sys} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: info?.color || '#6b7280' }} />
              {info?.label || sys}: {count}
            </span>
          )
        })}
        <span style={{ width: 1, height: 14, background: C.border }} />
        <span>Cables: {cables.length} ({totalCableFt.toFixed(0)} ft)</span>
        <span style={{ width: 1, height: 14, background: C.border }} />
        <span>{scalePxPerFt ? `Scale: ${scalePxPerFt.toFixed(1)} px/ft` : 'No scale set'}</span>
      </div>
    </div>
  )
}
