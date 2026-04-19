'use client'

import { useEffect, useRef, useState } from 'react'
import {
  buildDesignGeoContext,
  canvasPixelsToLatLng,
  generateFovConePolygon,
  generateCirclePolygon,
  alignMapConeRadiusFeet,
} from '@/components/design-canvas/geo-math'

interface DeviceLite {
  id: string
  label: string
  category: string
  status: string
  position_x: number
  position_y: number
  rotation: number
  properties: Record<string, unknown>
  cableRunFt: number | null
  mdfName: string | null
}

interface Wall {
  id: string
  points: Array<{ x: number; y: number }>
  color: string
}

interface Mdf {
  id: string
  name: string
  position_x: number
  position_y: number
}

interface PhotoCalloutLite {
  id: string
  url: string
  caption: string | null
  lat: number | null
  lng: number | null
  deviceId: string | null
}

export interface SiteMapProps {
  areaId: string
  mapsKey: string
  lat: number
  lng: number
  zoom: number
  scalePxPerFt: number
  devices: DeviceLite[]
  mdfs: Mdf[]
  walls: Wall[]
  photos?: PhotoCalloutLite[]
}

declare global {
  interface Window {
    google?: {
      maps?: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown
        Polygon: new (opts: Record<string, unknown>) => unknown
        Polyline: new (opts: Record<string, unknown>) => unknown
        Marker: new (opts: Record<string, unknown>) => unknown
        Size: new (w: number, h: number) => unknown
        Point: new (x: number, y: number) => unknown
        SymbolPath: { CIRCLE: number }
        event: { addListenerOnce: (m: unknown, ev: string, cb: () => void) => void }
      }
    }
    __siteMapsReady?: Record<string, boolean>
  }
}

function loadMapsOnce(key: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.maps) return Promise.resolve()
  if (document.getElementById('gmaps-print')) {
    return new Promise((res) => {
      const check = () => window.google?.maps ? res() : setTimeout(check, 50)
      check()
    })
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.id = 'gmaps-print'
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&v=weekly`
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('maps failed'))
    document.head.appendChild(s)
  })
}

const DORI_COLORS: Record<string, string> = {
  monitor: '#6b7280',
  detection: '#ef4444',
  observation: '#f97316',
  recognition: '#eab308',
  identification: '#22c55e',
}

function markAreaReady(areaId: string) {
  if (typeof window === 'undefined') return
  window.__siteMapsReady = window.__siteMapsReady || {}
  window.__siteMapsReady[areaId] = true
}

function cameraHFov(props: Record<string, unknown>): number {
  const explicit = Number(props.h_fov)
  if (explicit > 0 && explicit <= 360) return explicit
  const sensorW = Number(props.sensor_w) || 5.14
  const focal = Number(props.focal_length) || 4
  return 2 * Math.atan(sensorW / (2 * focal)) * 180 / Math.PI
}

// Tier ring distances (ft) based on PPF scaling: ppf(d) = resW / (2 * d * tan(hFov/2))
// So d_at_ppf(T) = resW / (2 * T * tan(hFov/2))
function tierDistances(props: Record<string, unknown>, hFovDeg: number): Record<string, number> {
  const resW = Number(props.resolution_w) || 3840
  const hFovRad = hFovDeg * Math.PI / 180
  const tan = Math.tan(hFovRad / 2)
  if (tan <= 0) return {}
  const dForPpf = (p: number) => resW / (2 * p * tan)
  return {
    identification: dForPpf(76),
    recognition: dForPpf(38),
    observation: dForPpf(19),
    detection: dForPpf(8),
    monitor: dForPpf(4),
  }
}

export function SiteMap({ areaId, mapsKey, lat, lng, zoom, scalePxPerFt, devices, mdfs, walls, photos = [] }: SiteMapProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!mapsKey || !lat || !lng) {
      markAreaReady(areaId)
      setFailed(true)
      return
    }
    ;(async () => {
      try {
        await loadMapsOnce(mapsKey)
        if (cancelled || !hostRef.current || !window.google?.maps) return
        const gm = window.google.maps
        const map = new gm.Map(hostRef.current, {
          center: { lat, lng },
          zoom,
          mapTypeId: 'satellite',
          tilt: 0,
          disableDefaultUI: true,
          gestureHandling: 'none',
          keyboardShortcuts: false,
        })

        const ppf = scalePxPerFt > 0 ? scalePxPerFt : 4
        const geoCtx = buildDesignGeoContext({ lat, lng }, ppf)
        if (!geoCtx) { markAreaReady(areaId); return }

        // Walls first (under everything)
        for (const w of walls) {
          if (w.points.length < 2) continue
          const path = w.points.map(p => canvasPixelsToLatLng(p.x, p.y, geoCtx))
          new gm.Polyline({
            path, map,
            strokeColor: w.color || '#f97316',
            strokeWeight: 3,
            strokeOpacity: 0.95,
          })
        }

        // FOV cones per camera (tiers largest → smallest for proper layering)
        for (const d of devices) {
          const pos = canvasPixelsToLatLng(d.position_x, d.position_y, geoCtx)
          const isCam = d.category.startsWith('camera')
          if (isCam) {
            const hFov = cameraHFov(d.properties)
            const tiers = tierDistances(d.properties, hFov)
            const order: Array<keyof typeof tiers> = ['monitor', 'detection', 'observation', 'recognition', 'identification']
            for (const name of order) {
              const distFt = tiers[name]
              if (!distFt || distFt < 2 || distFt > 1000) continue
              const mapRadius = alignMapConeRadiusFeet(distFt, ppf, zoom, lat)
              const ring = hFov >= 355
                ? generateCirclePolygon(pos.lat, pos.lng, mapRadius)
                : generateFovConePolygon({ lat: pos.lat, lng: pos.lng, rotationDeg: d.rotation, hFovDeg: hFov, radiusFt: mapRadius })
              if (ring.length < 3) continue
              new gm.Polygon({
                paths: ring, map,
                fillColor: DORI_COLORS[name], fillOpacity: 0.2,
                strokeColor: DORI_COLORS[name], strokeOpacity: 0.5, strokeWeight: 1,
              })
            }
          }

          const color = d.status === 'relocate' ? '#f97316' : d.category.startsWith('camera') ? '#3b82f6' : '#8b5cf6'
          const labelText = `${d.label}${d.cableRunFt ? ` · ${Math.round(d.cableRunFt)}ft` : ''}${d.mdfName ? ` → ${d.mdfName}` : ''}`
          new gm.Marker({
            position: pos, map,
            label: { text: labelText, color: '#fff', fontSize: '10px', fontWeight: '700' },
            icon: {
              path: gm.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            },
          })
        }

        // Photo callouts: place a photo marker offset from matched device with leader polyline
        const devicePosMap = new Map<string, { lat: number; lng: number }>()
        for (const d of devices) {
          devicePosMap.set(d.id, canvasPixelsToLatLng(d.position_x, d.position_y, geoCtx))
        }
        const matchedPhotos = photos.filter(p => p.deviceId && devicePosMap.has(p.deviceId!))
        const offsetDirs = [0, 45, 90, 135, 180, 225, 270, 315]
        const OFFSET_FT = 35
        const FT_PER_METER_LOCAL = 3.28084
        const ftToDeg = (ft: number, atLat: number) => {
          const meters = ft / FT_PER_METER_LOCAL
          return {
            dLat: (meters / 111320),
            dLng: (meters / (111320 * Math.cos(atLat * Math.PI / 180))),
          }
        }
        matchedPhotos.forEach((ph, i) => {
          const dPos = devicePosMap.get(ph.deviceId!)!
          const dir = (offsetDirs[i % offsetDirs.length]) * Math.PI / 180
          const { dLat, dLng } = ftToDeg(OFFSET_FT, dPos.lat)
          const photoLat = dPos.lat + dLat * Math.cos(dir)
          const photoLng = dPos.lng + dLng * Math.sin(dir)
          new gm.Polyline({
            path: [dPos, { lat: photoLat, lng: photoLng }], map,
            strokeColor: '#fbbf24', strokeOpacity: 0.9, strokeWeight: 2,
          })
          new gm.Marker({
            position: { lat: photoLat, lng: photoLng }, map,
            icon: {
              url: ph.url,
              scaledSize: new gm.Size(48, 36),
              anchor: new gm.Point(24, 18),
            },
            title: ph.caption || '',
          })
        })

        for (const m of mdfs) {
          const pos = canvasPixelsToLatLng(m.position_x, m.position_y, geoCtx)
          new gm.Marker({
            position: pos, map,
            label: { text: m.name, color: '#fff', fontSize: '11px', fontWeight: '700' },
            icon: {
              path: gm.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#111827',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            },
          })
        }

        gm.event.addListenerOnce(map, 'idle', () => {
          setTimeout(() => markAreaReady(areaId), 1000)
        })
      } catch {
        setFailed(true)
        markAreaReady(areaId)
      }
    })()

    return () => { cancelled = true }
  }, [areaId, mapsKey, lat, lng, zoom, scalePxPerFt, devices, mdfs, walls, photos])

  if (failed) {
    return <div style={{ width: '100%', height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', color: '#6b7280', fontSize: 12, border: '1px solid #e5e7eb' }}>Site map unavailable (no satellite coordinates)</div>
  }
  return <div ref={hostRef} data-site-map={areaId} style={{ width: '100%', height: 500, border: '1px solid #e5e7eb' }} />
}
