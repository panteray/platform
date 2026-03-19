import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { address?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const address = body.address?.trim()
  if (!address) return NextResponse.json({ error: 'Address is required' }, { status: 400 })

  const key = process.env.GOOGLE_MAPS_STATIC_KEY
  if (!key || key === 'PLACEHOLDER') {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 503 })
  }

  try {
    const params = new URLSearchParams({ address, key })
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`)
    if (!res.ok) {
      return NextResponse.json({ error: `Geocoding API error (${res.status})` }, { status: 502 })
    }

    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.length) {
      return NextResponse.json({ error: 'No results found for address', status: data.status }, { status: 404 })
    }

    const result = data.results[0]
    return NextResponse.json({
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
    })
  } catch (err) {
    console.error('Geocode error:', err)
    return NextResponse.json({ error: 'Geocoding request failed' }, { status: 500 })
  }
}
