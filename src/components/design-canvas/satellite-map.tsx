'use client'

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, memo } from 'react'

interface SatelliteMapProps {
  lat: number
  lng: number
  zoom: number
  opacity?: number
  hidden?: boolean
  /** Fired once after the map instance exists and `idle` + resize run (parent can sync viewport). */
  onMapReady?: () => void
}

/** Drive the map with API center/zoom only — no CSS transform on the map host (that freezes tile updates). */
export interface GeoViewportSync {
  centerLat: number
  centerLng: number
  googleZoom: number
}

export interface SatelliteMapHandle {
  syncZoom: (googleZoom: number) => void
  panBy: (dxPx: number, dyPx: number) => void
  /**
   * Live satellite: `setCenter` + `setZoom` so Maps loads/refreshes tiles. Do not use CSS matrix on the map tree.
   */
  syncToGeoViewport: (v: GeoViewportSync) => void
  relayout: () => void
  getMap: () => MapInstance | null
}

let apiKeyCache: string | null = null
let scriptLoaded = false
let scriptLoading = false
let scriptCallbacks: Array<() => void> = []

function loadMapsScript(apiKey: string): Promise<void> {
  if (scriptLoaded) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (scriptLoading) {
      scriptCallbacks.push(resolve)
      return
    }
    scriptLoading = true
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => {
      scriptLoaded = true
      scriptLoading = false
      resolve()
      scriptCallbacks.forEach(cb => cb())
      scriptCallbacks = []
    }
    script.onerror = () => {
      scriptLoading = false
      reject(new Error('Google Maps script failed to load'))
    }
    document.head.appendChild(script)
  })
}

type MapInstance = {
  setCenter: (c: { lat: number; lng: number }) => void
  setZoom: (z: number) => void
  getCenter: () => { lat: () => number; lng: () => number }
  getZoom: () => number
  panBy: (x: number, y: number) => void
  getDiv: () => HTMLElement
}

const SatelliteMapInner = forwardRef<SatelliteMapHandle, SatelliteMapProps>(
  function SatelliteMap({ lat, lng, zoom, opacity = 0.6, hidden = false, onMapReady }, ref) {
    const rootRef = useRef<HTMLDivElement>(null)
    const mapHostRef = useRef<HTMLDivElement>(null)
    const mapInitLockRef = useRef(false)
    const mapInstanceRef = useRef<MapInstance | null>(null)
    const [error, setError] = useState<string | null>(null)
    const originRef = useRef({ lat, lng, zoom })

    const triggerMapResize = () => {
      const map = mapInstanceRef.current
      const gmaps = (window as unknown as { google?: { maps?: { event?: { trigger: (inst: unknown, ev: string) => void } } } }).google?.maps
      if (map && gmaps?.event) gmaps.event.trigger(map, 'resize')
    }

    useImperativeHandle(ref, () => ({
      syncZoom(googleZoom: number) {
        const map = mapInstanceRef.current
        if (map) map.setZoom(googleZoom)
      },
      panBy(dxPx: number, dyPx: number) {
        const map = mapInstanceRef.current
        if (map) map.panBy(dxPx, dyPx)
      },
      syncToGeoViewport(v: GeoViewportSync) {
        const map = mapInstanceRef.current
        if (!map) return
        map.setCenter({ lat: v.centerLat, lng: v.centerLng })
        map.setZoom(Math.max(1, Math.min(22, v.googleZoom)))
      },
      relayout: () => {
        triggerMapResize()
      },
      getMap() {
        return mapInstanceRef.current
      },
    }))

    useEffect(() => {
      if (hidden || !rootRef.current) return
      let cancelled = false
      let resizeObserver: ResizeObserver | null = null

      async function init() {
        if (mapInitLockRef.current || mapInstanceRef.current) return
        const host = mapHostRef.current
        if (!host) return
        const br = host.getBoundingClientRect()
        if (br.width < 4 || br.height < 4) return

        try {
          if (!apiKeyCache) {
            const res = await fetch('/api/org/maps-key')
            if (!res.ok) { if (!cancelled) setError('Failed to load Maps API key'); return }
            const json = await res.json()
            apiKeyCache = json.key
          }
          if (cancelled || !mapHostRef.current || !apiKeyCache) return

          await loadMapsScript(apiKeyCache)
          if (cancelled || !mapHostRef.current) return

          const gm = (window as unknown as { google: { maps: { Map: new (el: HTMLElement, opts: Record<string, unknown>) => MapInstance; event: { trigger: (m: unknown, ev: string) => void; addListenerOnce?: (m: unknown, ev: string, fn: () => void) => void } } } }).google
          if (!gm?.maps?.Map) { if (!cancelled) setError('Google Maps API not available'); return }

          mapInitLockRef.current = true
          const map = new gm.maps.Map(mapHostRef.current, {
            center: { lat, lng },
            zoom,
            mapTypeId: 'satellite',
            disableDefaultUI: true,
            gestureHandling: 'none',
            keyboardShortcuts: false,
            draggable: false,
            zoomControl: false,
            scrollwheel: false,
            disableDoubleClickZoom: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: [
              { elementType: 'labels', stylers: [{ visibility: 'off' }] },
              { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
              { featureType: 'poi', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'off' }] },
              { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            ],
          })

          if (cancelled) {
            mapInitLockRef.current = false
            return
          }
          mapInstanceRef.current = map
          originRef.current = { lat, lng, zoom }
          mapInitLockRef.current = false

          if (typeof gm.maps.event.addListenerOnce === 'function') {
            gm.maps.event.addListenerOnce(map, 'idle', () => {
              if (cancelled) return
              triggerMapResize()
              onMapReady?.()
            })
          } else {
            requestAnimationFrame(() => {
              if (!cancelled) {
                triggerMapResize()
                onMapReady?.()
              }
            })
          }

          if (mapHostRef.current && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
              triggerMapResize()
            })
            resizeObserver.observe(mapHostRef.current)
          }
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!cancelled) triggerMapResize()
            })
          })
        } catch (err) {
          console.error('Google Maps init failed:', err)
          if (!cancelled) setError('Maps failed to load')
          mapInitLockRef.current = false
        }
      }

      const tryInit = () => {
        if (cancelled || mapInstanceRef.current) return
        void init()
      }

      const ro = new ResizeObserver(() => {
        tryInit()
      })
      ro.observe(rootRef.current)
      tryInit()

      return () => {
        cancelled = true
        ro.disconnect()
        resizeObserver?.disconnect()
        mapInstanceRef.current = null
        mapInitLockRef.current = false
        const host = mapHostRef.current
        if (host) host.innerHTML = ''
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single init; props synced in next effect
    }, [hidden])

    useEffect(() => {
      const map = mapInstanceRef.current
      if (!map) return
      map.setCenter({ lat, lng })
      map.setZoom(zoom)
      originRef.current = { lat, lng, zoom }
    }, [lat, lng, zoom])

    return (
      <div
        ref={rootRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          display: hidden ? 'none' : 'block',
          opacity: hidden ? 0 : error ? 0 : opacity,
        }}
      >
        <div
          ref={mapHostRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            minWidth: 0,
            minHeight: 0,
          }}
        />
      </div>
    )
  }
)

export const SatelliteMap = memo(SatelliteMapInner)
