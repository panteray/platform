import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { calculateSolar } from '@/lib/calculators'
import { fetchGoogleSolarBuildingInsights, toFiniteNumber } from '@/lib/google-solar'

interface SolarRouteBody {
  cameraWatts?: number
  systemVoltage?: 12 | 24
  autonomyDays?: number
  peakSunHours?: number
  latitude?: number
  longitude?: number
  requiredQuality?: 'HIGH' | 'MEDIUM' | 'LOW' | 'BASE'
}

export async function POST(req: NextRequest) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: SolarRouteBody
  try {
    body = (await req.json()) as SolarRouteBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const cameraWatts = toFiniteNumber(body.cameraWatts)
  const autonomyDays = toFiniteNumber(body.autonomyDays)
  const peakSunHoursFromBody = toFiniteNumber(body.peakSunHours)
  const latitude = toFiniteNumber(body.latitude)
  const longitude = toFiniteNumber(body.longitude)
  const systemVoltage = body.systemVoltage === 24 ? 24 : body.systemVoltage === 12 ? 12 : null

  if (!cameraWatts || cameraWatts <= 0) {
    return NextResponse.json({ error: 'cameraWatts must be a number > 0' }, { status: 400 })
  }
  if (!autonomyDays || autonomyDays <= 0) {
    return NextResponse.json({ error: 'autonomyDays must be a number > 0' }, { status: 400 })
  }
  if (!systemVoltage) {
    return NextResponse.json({ error: 'systemVoltage must be 12 or 24' }, { status: 400 })
  }

  const hasLatLng = latitude != null && longitude != null
  let googleSolar: Awaited<ReturnType<typeof fetchGoogleSolarBuildingInsights>> | null = null
  let solarLookupWarning: string | null = null

  if (hasLatLng) {
    try {
      googleSolar = await fetchGoogleSolarBuildingInsights({
        latitude,
        longitude,
        requiredQuality: body.requiredQuality ?? 'MEDIUM',
      })
    } catch (error) {
      solarLookupWarning = error instanceof Error ? error.message : 'Google Solar lookup failed.'
    }
  }

  const peakSunHours = peakSunHoursFromBody ?? googleSolar?.peakSunHours ?? null

  if (!peakSunHours || peakSunHours <= 0) {
    const detail = hasLatLng
      ? 'No valid peak sun hours from manual input or Google Solar data.'
      : 'Provide either peakSunHours, or latitude+longitude for Google Solar lookup.'
    return NextResponse.json({ error: detail }, { status: 400 })
  }

  const result = calculateSolar({
    cameraWatts,
    systemVoltage,
    autonomyDays,
    peakSunHours,
    latitude: latitude ?? undefined,
  })

  const warnings = [...result.warnings]
  if (solarLookupWarning && peakSunHoursFromBody) {
    warnings.push(`Using manual peakSunHours. ${solarLookupWarning}`)
  }

  return NextResponse.json({
    ...result,
    warnings,
    peakSunHoursUsed: peakSunHours,
    peakSunHoursSource: peakSunHoursFromBody ? 'manual' : googleSolar ? 'google_solar' : 'manual',
    googleSolar,
  })
}
