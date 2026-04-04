import { NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'

/**
 * SECURITY: This endpoint exposes the Google Maps API key to authenticated clients.
 * The key MUST be restricted in Google Cloud Console:
 *   1. Application restrictions → HTTP referrers → add production domain(s)
 *   2. API restrictions → restrict to Maps JavaScript API + Static Maps API only
 * Without these restrictions, the key can be extracted from network traffic and abused.
 */
export async function GET() {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.GOOGLE_MAPS_STATIC_KEY
  if (!key || key === 'PLACEHOLDER') {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 503 })
  }

  return NextResponse.json({ key })
}
