'use client'

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, memo } from 'react'

interface SatelliteMapProps {
  lat: number
  lng: number
  zoom: number
  opacity?: number
  hidden?: boolean
  /** Fired once after the map instance exists and `idle` + resize run (parent can sync Fabric viewport). */
  onMapReady?: () => void
}

export interface SatelliteMapHandle {
  syncZoom: (googleZoom: number) => void
  panBy: (dxPx: number, dyPx: number) => void
  /**
   * Sync Fabric viewport to the satellite layer. `vpt` = Fabric `viewportTransform` (6 values).
   * Applied as one CSS `matrix()` on a wrapper; map internal zoom stays the area `satellite_zoom` only.
   */
  syncTransform: (vpt: number[], canvasWidth: number, canvasHeight: number) => void
  /** Call after container resizes (e.g. flex layout) so Google remeasures the map node. */
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
    /** Root — observed so we only construct `google.maps.Map` once this has non-zero size (avoids tiny-tile bug). */
    const rootRef = useRef<HTMLDivElement>(null)
    /**
     * Wrapper: Fabric `viewportTransform` applied here as a single CSS matrix (scale + translate).
     * Do not split into map.setZoom(log2) + left/top — tx/ty are coupled to scale in Fabric and that caused
     * the basemap to drift to corners when zooming.
     */
    const transformLayerRef = useRef<HTMLDivElement>(null)
    /** Host for `new google.maps.Map()` — not the transformed node (Maps measures this div). */
    const mapHostRef = useRef<HTMLDivElement>(null)
    const mapInitLockRef = useRef(false)
    const mapInstanceRef = useRef<MapInstance | null>(null)
    const [error, setError] = useState<string | null>(null)
    // Store initial config so we can compute offsets during pan sync
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
      syncTransform(vpt: number[], _canvasWidth: number, _canvasHeight: number) {
        if (!mapInstanceRef.current) return
        const tl = transformLayerRef.current
        if (tl) {
          const a = vpt[0] ?? 1
          const b = vpt[1] ?? 0
          const c = vpt[2] ?? 0
          const d = vpt[3] ?? 1
          const e = vpt[4] ?? 0
          const f = vpt[5] ?? 0
          tl.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`
          tl.style.transformOrigin = '0 0'
        }
      },
      relayout: () => {
        triggerMapResize()
      },
      getMap() {
        return mapInstanceRef.current
      },
    }))

    // Initialize map once the root has real dimensions — if `new Map` runs at 0×0, tiles stay a small patch forever.
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
            gestureHandling: 'none',  // Canvas handles all interactions
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

    // Update center/zoom when props change (after map instance exists)
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
          ref={transformLayerRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            transformOrigin: '0 0',
          }}
        >
          <div
            ref={mapHostRef}
            style={{
              width: '100%',
              height: '100%',
              minWidth: 0,
              minHeight: 0,
            }}
          />
        </div>
      </div>
    )
  }
)

/** Memoized: parent re-renders often; avoid React reconciling against Google-injected DOM inside the map div. */
export const SatelliteMap = memo(SatelliteMapInner)
