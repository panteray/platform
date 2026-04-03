'use client'

import { useEffect, useRef, useState, useImperativeHandle, forwardRef, memo } from 'react'

interface SatelliteMapProps {
  lat: number
  lng: number
  zoom: number
  opacity?: number
  hidden?: boolean
}

export interface SatelliteMapHandle {
  syncZoom: (googleZoom: number) => void
  panBy: (dxPx: number, dyPx: number) => void
  /**
   * Sync Fabric viewport to the satellite layer. `vpt` = [scale, 0, 0, scale, panX, panY].
   * Applies CSS translate only; zoom follows Fabric via `map.setZoom(baseZoom + log2(scale))` — do not
   * also CSS-scale the map div (double zoom shrinks the basemap to a small patch).
   */
  syncTransform: (vpt: number[], canvasWidth: number, canvasHeight: number) => void
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
  function SatelliteMap({ lat, lng, zoom, opacity = 0.6, hidden = false }, ref) {
    /** Host for `new google.maps.Map()` — must NOT have CSS transform (breaks tile layout → tiny map patch). */
    const mapRef = useRef<HTMLDivElement>(null)
    /** Parent layer: Fabric pan applied here only. */
    const panLayerRef = useRef<HTMLDivElement>(null)
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
        const map = mapInstanceRef.current
        if (!map) return
        const fabricZoom = vpt[0]
        const panX = vpt[4]
        const panY = vpt[5]

        const googleZoom = originRef.current.zoom + Math.log2(fabricZoom)
        map.setZoom(Math.max(1, Math.min(22, googleZoom)))

        const panEl = panLayerRef.current
        if (panEl) {
          panEl.style.transform = `translate(${panX}px, ${panY}px)`
          panEl.style.transformOrigin = '0 0'
        }
      },
      getMap() {
        return mapInstanceRef.current
      },
    }))

    // Initialize map once per mount. Do not depend on lat/lng/zoom: Google injects DOM into this node;
    // re-running init when props change caused React insertBefore conflicts with the Maps runtime.
    // Center/zoom updates: separate effect below.
    useEffect(() => {
      if (!mapRef.current || hidden) return
      const el = mapRef.current
      let cancelled = false
      let resizeObserver: ResizeObserver | null = null

      async function init() {
        try {
          if (!apiKeyCache) {
            const res = await fetch('/api/org/maps-key')
            if (!res.ok) { if (!cancelled) setError('Failed to load Maps API key'); return }
            const json = await res.json()
            apiKeyCache = json.key
          }
          if (cancelled || !mapRef.current || !apiKeyCache) return

          await loadMapsScript(apiKeyCache)
          if (cancelled || !mapRef.current) return

          const gm = (window as unknown as { google: { maps: { Map: new (el: HTMLElement, opts: Record<string, unknown>) => MapInstance } } }).google
          if (!gm?.maps?.Map) { if (!cancelled) setError('Google Maps API not available'); return }

          const map = new gm.maps.Map(mapRef.current, {
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

          if (cancelled) return
          mapInstanceRef.current = map
          originRef.current = { lat, lng, zoom }

          if (cancelled) return
          if (mapRef.current && typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
              triggerMapResize()
            })
            resizeObserver.observe(mapRef.current)
          }
          // Map measures its node on init; if flex layout wasn't final yet, tiles stay a small patch until resize.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (!cancelled) triggerMapResize()
            })
          })
        } catch (err) {
          console.error('Google Maps init failed:', err)
          if (!cancelled) setError('Maps failed to load')
        }
      }

      void init()
      return () => {
        cancelled = true
        resizeObserver?.disconnect()
        mapInstanceRef.current = null
        el.innerHTML = ''
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
          ref={panLayerRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            transform: 'translate(0px, 0px)',
            transformOrigin: '0 0',
          }}
        >
          <div
            ref={mapRef}
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
