import { NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'

export async function GET() {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.GOOGLE_MAPS_STATIC_KEY
  if (!key || key === 'PLACEHOLDER') {
    return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 503 })
  }

  return NextResponse.json({ key })
}
