'use client'

import { useEffect, useRef, type RefObject } from 'react'
import type { DesignDevice } from '@/types/database'
import type { SatelliteMapHandle } from './satellite-map'
import type { DesignGeoContext } from './geo-math'
import {
  alignMapConeRadiusFeet,
  canvasPixelsToLatLng,
  generateCirclePolygon,
  generateFovConePolygon,
} from './geo-math'
import type { DeviceFovData } from './fov-data-types'
import { C } from './constants'

const COLOR_TO_ZONE: Record<string, string> = {
  '#8b5cf6': 'inspection',
  '#22c55e': 'identification',
  '#eab308': 'recognition',
  '#f97316': 'observation',
  '#ef4444': 'detection',
  '#6b7280': 'monitor',
}

type MapsNS = {
  Polygon: new (opts: Record<string, unknown>) => GPolygon
  LatLng: new (lat: number, lng: number) => unknown
}

type GMap = {
  setCenter: (c: { lat: number; lng: number }) => void
  setZoom: (z: number) => void
}

type GPolygon = { setMap: (m: GMap | null) => void }

function getGoogleMaps(): MapsNS | null {
  const g = (typeof window !== 'undefined' ? window : null) as unknown as {
    google?: { maps?: MapsNS }
  }
  return g?.google?.maps ?? null
}

/** Wait until SatelliteMap has finished creating the Map instance. */
function waitForMap(
  satMapRef: RefObject<SatelliteMapHandle | null>,
  maxMs: number,
): Promise<GMap | null> {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const tick = () => {
      const m = satMapRef.current?.getMap() as GMap | null
      if (m) {
        resolve(m)
        return
      }
      if (Date.now() - t0 > maxMs) {
        resolve(null)
        return
      }
      requestAnimationFrame(tick)
    }
    tick()
  })
}

/**
 * Phase B: native `google.maps.Polygon` FOV layers on the satellite map (lat/lng).
 * Radius uses `alignMapConeRadiusFeet` so ground distance matches Fabric + `scalePxPerFt`
 * at the current `SatelliteMap` zoom (`baseSatelliteZoom + log2(fabricViewportZoom)`).
 */
export function useMapFovPolygons(opts: {
  satMapRef: RefObject<SatelliteMapHandle | null>
  geoContext: DesignGeoContext | null
  /** Area `satellite_zoom` (matches SatelliteMap originRef). */
  baseSatelliteZoom: number
  /** Fabric `canvas.getZoom()` — paired with base zoom in syncTransform. */
  fabricViewportZoom: number
  devices: DesignDevice[]
  fovData: Map<string, DeviceFovData>
  showFovCones: boolean
  selectedDeviceId: string | null
  hiddenCategories?: Set<string>
  hiddenPpfZones?: Set<string>
  fovDisplayMode: 'simple' | 'ppf' | 'dori' | 'heatmap'
  isDraggingFovRef: RefObject<boolean>
}): void {
  const {
    satMapRef,
    geoContext,
    baseSatelliteZoom,
    fabricViewportZoom,
    devices,
    fovData,
    showFovCones,
    selectedDeviceId,
    hiddenCategories,
    hiddenPpfZones,
    fovDisplayMode,
    isDraggingFovRef,
  } = opts

  const polygonsRef = useRef<GPolygon[]>([])

  useEffect(() => {
    if (isDraggingFovRef.current) return

    for (const p of polygonsRef.current) {
      try {
        p.setMap(null)
      } catch { /* ignore */ }
    }
    polygonsRef.current = []

    if (!geoContext) return

    let cancelled = false

    void (async () => {
      const map = await waitForMap(satMapRef, 5000)
      const gm = getGoogleMaps()
      if (cancelled || !map || !gm) return
      if (isDraggingFovRef.current) return

      const effectiveGoogleZoom =
        baseSatelliteZoom + Math.log2(Math.max(0.001, fabricViewportZoom))
      /** Map stays at `baseSatelliteZoom`; CSS matrix matches Fabric zoom. Scale radius vs align-at-Z_eff. */
      const radiusScale = Math.max(0.001, fabricViewportZoom)
      const scalePx = geoContext.scalePxPerFt

      const created: GPolygon[] = []

      for (const [devId, data] of fovData) {
        const dev = devices.find((d) => d.id === devId)
        if (!dev) continue
        if (!showFovCones && devId !== selectedDeviceId) continue
        if (hiddenCategories?.has(dev.category)) continue

        const { lat: camLat, lng: camLng } = canvasPixelsToLatLng(
          dev.position_x,
          dev.position_y,
          geoContext,
        )

        const sensorRotations =
          data.sensorAngles && data.sensorAngles.length > 1
            ? data.sensorAngles
            : [dev.rotation || 0]

        const isMulti = sensorRotations.length > 1

        for (let sIdx = 0; sIdx < sensorRotations.length; sIdx++) {
          const sensorRotDeg = sensorRotations[sIdx]
          const imagerData = data.perImagerData?.[sIdx]
          const effectiveTiers = imagerData?.tiers || data.tiers
          const effectiveHFov = imagerData?.hFov ?? data.hFov

          for (let t = 0; t < effectiveTiers.length; t++) {
            const tier = effectiveTiers[t]
            const r =
              alignMapConeRadiusFeet(
                tier.distanceFt,
                scalePx,
                effectiveGoogleZoom,
                camLat,
              ) * radiusScale
            if (r < 0.5) continue

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
              path = generateCirclePolygon(camLat, camLng, r, 48)
            } else {
              path = generateFovConePolygon({
                lat: camLat,
                lng: camLng,
                rotationDeg: sensorRotDeg,
                hFovDeg: effectiveHFov,
                radiusFt: r,
                steps: Math.max(24, Math.min(48, Math.round(effectiveHFov))),
              })
            }
            if (path.length < 3) continue

            const poly = new gm.Polygon({
              paths: path,
              fillColor,
              fillOpacity: gradOpacity * 0.85,
              strokeColor: t === 0 ? fillColor : 'transparent',
              strokeOpacity: t === 0 ? 0.55 : 0,
              strokeWeight: t === 0 ? 2 : 0,
              map,
              clickable: false,
              zIndex: isMulti ? 1 + sIdx : 1,
            })
            created.push(poly)
          }
        }

        // PTZ: faint pan-range circle on map (matches canvas pan circle intent)
        if (dev.category === 'ptz') {
          const panR =
            alignMapConeRadiusFeet(
              data.tiers[0]?.distanceFt || 30,
              scalePx,
              effectiveGoogleZoom,
              camLat,
            ) * radiusScale
          if (panR > 2) {
            const ring = generateCirclePolygon(camLat, camLng, panR, 48)
            if (ring.length >= 3) {
              const poly = new gm.Polygon({
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
              created.push(poly)
            }
          }
        }
      }

      if (cancelled) {
        for (const p of created) {
          try {
            p.setMap(null)
          } catch { /* ignore */ }
        }
        return
      }
      polygonsRef.current = created
    })()

    return () => {
      cancelled = true
      for (const p of polygonsRef.current) {
        try {
          p.setMap(null)
        } catch { /* ignore */ }
      }
      polygonsRef.current = []
    }
  }, [
    geoContext,
    baseSatelliteZoom,
    fabricViewportZoom,
    devices,
    fovData,
    showFovCones,
    selectedDeviceId,
    hiddenCategories,
    hiddenPpfZones,
    fovDisplayMode,
    satMapRef,
    isDraggingFovRef,
  ])
}
