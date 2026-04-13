'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useMapsApiKey } from '@/components/design-canvas/use-maps-api-key'
import { LeadStatusBadge } from './LeadStatusBadge'
import { LeadPriorityBadge } from './LeadPriorityBadge'
import type { Lead } from '@/types/database'
import Link from 'next/link'
import { MapPin, ExternalLink } from 'lucide-react'

interface LeadMapViewProps {
  leads: Lead[]
  loading: boolean
}

interface GeocodedLead {
  lead: Lead
  lat: number
  lng: number
}

const STATUS_MARKER_COLORS: Record<string, string> = {
  NEW: '#3b82f6',
  CONTACTED: '#a855f7',
  QUALIFYING: '#f59e0b',
  QUALIFIED: '#22c55e',
  CONVERTED: '#10b981',
  ARCHIVED: '#a1a1aa',
}

export function LeadMapView({ leads, loading }: LeadMapViewProps) {
  const apiKey = useMapsApiKey()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const [geocodedLeads, setGeocodedLeads] = useState<GeocodedLead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  // Load Google Maps script
  useEffect(() => {
    if (!apiKey) return
    if (typeof window !== 'undefined' && window.google?.maps) {
      setScriptLoaded(true)
      return
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existing) {
      existing.addEventListener('load', () => setScriptLoaded(true))
      if (window.google?.maps) setScriptLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,geocoding`
    script.async = true
    script.defer = true
    script.onload = () => setScriptLoaded(true)
    document.head.appendChild(script)
  }, [apiKey])

  // Geocode leads that have address data
  const geocodeLeads = useCallback(async () => {
    if (!scriptLoaded || !window.google?.maps) return
    const geocoder = new google.maps.Geocoder()
    const addressLeads = leads.filter((l) => l.city || l.address || l.state)

    if (addressLeads.length === 0) {
      setGeocodedLeads([])
      return
    }

    setGeocoding(true)
    const results: GeocodedLead[] = []

    for (const lead of addressLeads) {
      const parts = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean)
      if (parts.length === 0) continue

      try {
        const response = await geocoder.geocode({ address: parts.join(', ') })
        if (response.results[0]?.geometry?.location) {
          results.push({
            lead,
            lat: response.results[0].geometry.location.lat(),
            lng: response.results[0].geometry.location.lng(),
          })
        }
      } catch {
        // Skip leads that fail to geocode
      }
    }

    setGeocodedLeads(results)
    setGeocoding(false)
  }, [leads, scriptLoaded])

  useEffect(() => {
    geocodeLeads()
  }, [geocodeLeads])

  // Initialize map
  useEffect(() => {
    if (!scriptLoaded || !mapRef.current || mapInstanceRef.current) return

    // Default center: US center (Panteray service area)
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 32.5, lng: -90.0 },
      zoom: 6,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      mapId: 'leads-map',
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b9e' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      ],
    })
  }, [scriptLoaded])

  // Place markers
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !scriptLoaded) return

    // Clear existing markers
    markersRef.current.forEach((m) => (m.map = null))
    markersRef.current = []

    if (geocodedLeads.length === 0) return

    const bounds = new google.maps.LatLngBounds()

    for (const { lead, lat, lng } of geocodedLeads) {
      const color = STATUS_MARKER_COLORS[lead.status] ?? '#a1a1aa'

      // Create custom marker element
      const markerEl = document.createElement('div')
      markerEl.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%; border: 2px solid white;
        background-color: ${color}; cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3); transition: transform 0.15s;
        display: flex; align-items: center; justify-content: center;
      `
      markerEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>`
      markerEl.addEventListener('mouseenter', () => { markerEl.style.transform = 'scale(1.2)' })
      markerEl.addEventListener('mouseleave', () => { markerEl.style.transform = 'scale(1)' })

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat, lng },
        content: markerEl,
        title: `${lead.contact_first_name} ${lead.contact_last_name} — ${lead.company_name ?? ''}`,
      })

      marker.addListener('click', () => setSelectedLead(lead))

      markersRef.current.push(marker)
      bounds.extend({ lat, lng })
    }

    if (geocodedLeads.length > 1) {
      map.fitBounds(bounds, 60)
    } else if (geocodedLeads.length === 1) {
      map.setCenter({ lat: geocodedLeads[0].lat, lng: geocodedLeads[0].lng })
      map.setZoom(12)
    }
  }, [geocodedLeads, scriptLoaded])

  if (!apiKey) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-border bg-card">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    )
  }

  const leadsWithAddress = leads.filter((l) => l.city || l.address || l.state)
  const leadsWithoutAddress = leads.length - leadsWithAddress.length

  return (
    <div className="space-y-3">
      {/* Map container */}
      <div className="relative overflow-hidden rounded-lg border border-border">
        {(loading || geocoding) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading leads...' : 'Geocoding addresses...'}
            </p>
          </div>
        )}
        <div ref={mapRef} className="h-[500px] w-full" />

        {/* Stats overlay */}
        <div className="absolute top-3 left-3 z-10 rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-md">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" />
              <span className="font-semibold">{geocodedLeads.length}</span> mapped
            </span>
            {leadsWithoutAddress > 0 && (
              <span className="text-muted-foreground">
                {leadsWithoutAddress} without address
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Selected lead panel */}
      {selectedLead && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {selectedLead.contact_first_name} {selectedLead.contact_last_name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {selectedLead.lead_number}
                </span>
              </div>
              {selectedLead.company_name && (
                <p className="text-xs text-muted-foreground">{selectedLead.company_name}</p>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <LeadStatusBadge status={selectedLead.status} />
                <LeadPriorityBadge priority={selectedLead.priority} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {[selectedLead.address, selectedLead.city, selectedLead.state, selectedLead.zip]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {selectedLead.estimated_value != null && (
                <p className="mt-1 text-xs font-medium text-emerald-500">
                  ${Number(selectedLead.estimated_value).toLocaleString()}
                </p>
              )}
            </div>
            <Link
              href={`/org/leads/${selectedLead.id}`}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              View <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
