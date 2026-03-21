'use client'

import { useEffect, useRef, useState } from 'react'

interface SatelliteMapProps {
  lat: number
  lng: number
  zoom: number
  opacity?: number
  hidden?: boolean
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

export function SatelliteMap({ lat, lng, zoom, opacity = 0.6, hidden = false }: SatelliteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const [error, setError] = useState<string | null>(null)

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || hidden) return
    let cancelled = false

    async function init() {
      try {
        if (!apiKeyCache) {
          const res = await fetch('/api/org/maps-key')
          if (!res.ok) { setError('Failed to load Maps API key'); return }
          const json = await res.json()
          apiKeyCache = json.key
        }
        if (cancelled || !mapRef.current || !apiKeyCache) return

        await loadMapsScript(apiKeyCache)
        if (cancelled || !mapRef.current) return

        const gm = (window as unknown as { google: { maps: { Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown } } }).google
        if (!gm?.maps?.Map) { setError('Google Maps API not available'); return }

        if (mapInstanceRef.current) {
          const m = mapInstanceRef.current as { setCenter: (c: { lat: number; lng: number }) => void; setZoom: (z: number) => void }
          m.setCenter({ lat, lng })
          m.setZoom(zoom)
          return
        }

        const map = new gm.maps.Map(mapRef.current, {
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

        mapInstanceRef.current = map
      } catch (err) {
        console.error('Google Maps init failed:', err)
        if (!cancelled) setError('Maps failed to load')
      }
    }

    void init()
    return () => { cancelled = true }
  }, [hidden, lat, lng, zoom])

  // Update center/zoom when props change
  useEffect(() => {
    const map = mapInstanceRef.current as { setCenter: (c: { lat: number; lng: number }) => void; setZoom: (z: number) => void } | null
    if (!map) return
    map.setCenter({ lat, lng })
    map.setZoom(zoom)
  }, [lat, lng, zoom])

  if (error) return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />

  return (
    <div
      ref={mapRef}
      style={{
        position: 'absolute',
        inset: 0,
        opacity: hidden ? 0 : opacity,
        pointerEvents: 'none',
        zIndex: 0,
        display: hidden ? 'none' : 'block',
      }}
    />
  )
}
