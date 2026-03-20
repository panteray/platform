import { NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'

/**
 * Diagnostic endpoint: tests whether GOOGLE_MAPS_STATIC_KEY works for the Static Maps API.
 * Returns a JSON report — does NOT return the key itself.
 * DELETE THIS FILE after diagnosis.
 */
export async function GET() {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.GOOGLE_MAPS_STATIC_KEY
  const report: Record<string, unknown> = {
    keyExists: !!key,
    keyLength: key?.length ?? 0,
    keyPrefix: key?.slice(0, 6) ?? null,
  }

  if (!key || key === 'PLACEHOLDER') {
    report.verdict = 'NO_KEY'
    return NextResponse.json(report)
  }

  // Test 1: Geocoding API (we know this works from Location button)
  try {
    const geoParams = new URLSearchParams({ address: '1600 Amphitheatre Parkway, Mountain View, CA', key })
    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${geoParams}`)
    const geoJson = await geoRes.json()
    report.geocodeStatus = geoRes.status
    report.geocodeApiStatus = geoJson.status
    report.geocodeWorks = geoJson.status === 'OK'
    if (geoJson.error_message) report.geocodeError = geoJson.error_message
  } catch (err) {
    report.geocodeWorks = false
    report.geocodeError = String(err)
  }

  // Test 2: Static Maps API (the actual satellite tiles)
  try {
    const mapParams = new URLSearchParams({
      center: '30.4583,-90.1026',
      zoom: '19',
      size: '256x256',
      maptype: 'satellite',
      key,
    })
    const mapRes = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${mapParams}`)
    const contentType = mapRes.headers.get('content-type') ?? 'unknown'
    const body = await mapRes.arrayBuffer()
    
    report.staticMapStatus = mapRes.status
    report.staticMapContentType = contentType
    report.staticMapSize = body.byteLength
    report.staticMapIsImage = contentType.startsWith('image/')
    report.staticMapWorks = contentType.startsWith('image/') && body.byteLength > 1000

    // If it returned JSON or HTML instead of an image, capture the error
    if (!contentType.startsWith('image/') && body.byteLength < 5000) {
      report.staticMapBody = new TextDecoder().decode(body).slice(0, 500)
    }
  } catch (err) {
    report.staticMapWorks = false
    report.staticMapError = String(err)
  }

  // Test 3: Static Maps with scale=2 (what satellite tiles actually use)
  try {
    const mapParams = new URLSearchParams({
      center: '30.4583,-90.1026',
      zoom: '19',
      size: '640x640',
      maptype: 'satellite',
      scale: '2',
      key,
    })
    const mapRes = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${mapParams}`)
    const contentType = mapRes.headers.get('content-type') ?? 'unknown'
    const body = await mapRes.arrayBuffer()
    
    report.scaledTileStatus = mapRes.status
    report.scaledTileContentType = contentType
    report.scaledTileSize = body.byteLength
    report.scaledTileWorks = contentType.startsWith('image/') && body.byteLength > 5000

    if (!contentType.startsWith('image/') && body.byteLength < 5000) {
      report.scaledTileBody = new TextDecoder().decode(body).slice(0, 500)
    }
  } catch (err) {
    report.scaledTileWorks = false
    report.scaledTileError = String(err)
  }

  // Verdict
  if (report.staticMapWorks && report.scaledTileWorks) {
    report.verdict = 'ALL_WORKING'
  } else if (report.geocodeWorks && !report.staticMapWorks) {
    report.verdict = 'STATIC_MAPS_API_NOT_ENABLED — Geocoding works but Static Maps does not. Enable "Maps Static API" in Google Cloud Console > APIs & Services > Library.'
  } else if (!report.geocodeWorks && !report.staticMapWorks) {
    report.verdict = 'KEY_INVALID_OR_RESTRICTED — Neither API works. Check key restrictions in Google Cloud Console.'
  } else {
    report.verdict = 'PARTIAL — Check individual test results above.'
  }

  return NextResponse.json(report, { status: 200 })
}
