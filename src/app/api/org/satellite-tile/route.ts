import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const zoom = searchParams.get('zoom') ?? '19'
  const width = searchParams.get('width') ?? '1280'
  const height = searchParams.get('height') ?? '1280'

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const key = process.env.GOOGLE_MAPS_STATIC_KEY
  if (!key || key === 'PLACEHOLDER') {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 503 })
  }

  // Clamp dimensions to Google Static Maps limits (max 640x640 for free, 2048x2048 for premium)
  const w = Math.min(Math.max(1, parseInt(width, 10) || 1280), 2048)
  const h = Math.min(Math.max(1, parseInt(height, 10) || 1280), 2048)
  const z = Math.min(Math.max(1, parseInt(zoom, 10) || 19), 21)

  try {
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: String(z),
      size: `${w}x${h}`,
      maptype: 'satellite',
      scale: '2',
      key,
    })

    const res = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`)
    if (!res.ok) {
      return NextResponse.json({ error: `Static Maps API error (${res.status})` }, { status: 502 })
    }

    // Google returns HTTP 200 even for errors — validate content-type is actually an image
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      const body = await res.text()
      console.error('Google Static Maps returned non-image:', contentType, body.slice(0, 500))
      return NextResponse.json({ error: `Static Maps returned ${contentType} instead of image — check API key restrictions` }, { status: 502 })
    }

    const imageBuffer = await res.arrayBuffer()

    // Reject suspiciously small responses (Google error tiles are often < 1KB)
    if (imageBuffer.byteLength < 1000) {
      console.error('Google Static Maps returned tiny response:', imageBuffer.byteLength, 'bytes')
      return NextResponse.json({ error: `Static Maps returned ${imageBuffer.byteLength} byte image — likely an error tile` }, { status: 502 })
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('Satellite tile error:', err)
    return NextResponse.json({ error: 'Satellite tile request failed' }, { status: 500 })
  }
}
