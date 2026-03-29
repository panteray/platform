import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const TARGET_FIELDS = [
  'super_low_light', 'focal_length', 'focal_type', 'aov', 'codecs', 'environment', 'ir',
]

function isMissing(val: unknown): boolean {
  if (val == null) return true
  const s = String(val).trim()
  return s === '' || s === 'N/A'
}

export async function GET(_req: NextRequest) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = dbUser.org_id
  const admin = createAdminClient()

  // Get all org devices
  const { data, error } = await admin
    .from('device_library_items')
    .select('id, vendor, model, form, resolution, ir, super_low_light, focal_length, focal_type, aov, codecs, environment')
    .eq('org_id', orgId)
    .order('vendor', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Group by manufacturer, identify which need enrichment
  const grouped: Record<string, {
    total: number
    needs_enrichment: number
    devices: { id: string; model: string; missing: string[] }[]
  }> = {}

  for (const item of data ?? []) {
    const mfr = item.vendor || 'Unknown'
    if (!grouped[mfr]) {
      grouped[mfr] = { total: 0, needs_enrichment: 0, devices: [] }
    }
    grouped[mfr].total++

    const missing = TARGET_FIELDS.filter((f) => isMissing(item[f as keyof typeof item]))
    if (missing.length > 0) {
      grouped[mfr].needs_enrichment++
      grouped[mfr].devices.push({ id: item.id, model: item.model, missing })
    }
  }

  return NextResponse.json({ manufacturers: grouped })
}

export async function POST(req: NextRequest) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const orgId = dbUser.org_id
  const admin = createAdminClient()

  let body: { device_ids: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.device_ids?.length) {
    return NextResponse.json({ error: 'device_ids required' }, { status: 400 })
  }

  // Fetch devices
  const { data: devices, error: fetchErr } = await admin
    .from('device_library_items')
    .select('id, vendor, model, form, resolution, ir, super_low_light, focal_length, focal_type, aov, codecs, environment')
    .in('id', body.device_ids)
    .eq('org_id', orgId)

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 400 })
  }

  if (!devices?.length) {
    return NextResponse.json({ error: 'No devices found' }, { status: 404 })
  }

  // Build payload for Claude
  const payload = devices.map((d) => {
    const missing = TARGET_FIELDS.filter((f) => isMissing(d[f as keyof typeof d]))
    return {
      id: d.id,
      model: d.model,
      manufacturer: d.vendor,
      form_factor: d.form,
      resolution: d.resolution,
      ir: d.ir,
      existing_fl: d.focal_length,
      existing_codecs: d.codecs,
      missing,
    }
  })

  // Call Anthropic API
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Security camera specifications expert. Fill missing specs using training knowledge of these exact models.

Return ONLY valid JSON array, no markdown.
Format: [{"model":"EXACT_MODEL","environment":"...","focal_length":"...","focal_type":"...","aov":"...","super_low_light":"...","codecs":"...","ir":"..."}]

Rules:
- environment: "Indoor"|"Outdoor"|"Both" (Bullet form_factor → always Outdoor; -E suffix → Outdoor; -I suffix → Indoor)
- focal_length: "2.8mm" fixed or "2.8mm - 12mm" varifocal range
- focal_type: "Fixed"|"Varifocal"
- aov: horizontal field of view "97°" or "30° - 91°" range
- super_low_light: "Yes" if starlight/extreme-low-light capable, else "No"
- codecs: "H.264, H.265, MJPEG" (H.265 on cameras manufactured ~2016+)
- ir: "30m" or "No"

Only include fields in each camera's "missing" array. Omit fields you're not confident about.

${JSON.stringify(payload)}`,
      }],
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    return NextResponse.json({ error: `Anthropic API error: ${resp.status} ${errText}` }, { status: 502 })
  }

  const apiResult = await resp.json()
  if (apiResult.error) {
    return NextResponse.json({ error: apiResult.error.message }, { status: 502 })
  }

  const txt = apiResult.content?.[0]?.text ?? ''
  const jsonMatch = txt.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'No JSON array in API response' }, { status: 502 })
  }

  let results: Record<string, string>[]
  try {
    results = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Failed to parse API response JSON' }, { status: 502 })
  }

  // Apply results to DB
  let updated = 0
  for (const result of results) {
    if (!result?.model) continue

    // Find matching device
    const device = devices.find(
      (d) => d.model === result.model || d.model.toUpperCase() === result.model.toUpperCase()
    )
    if (!device) continue

    const updates: Record<string, unknown> = {}

    if (result.environment && isMissing(device.environment)) {
      updates.environment = result.environment
    }
    if (result.focal_length && isMissing(device.focal_length)) {
      updates.focal_length = result.focal_length
    }
    if (result.focal_type && isMissing(device.focal_type)) {
      updates.focal_type = result.focal_type
    }
    if (result.aov && isMissing(device.aov)) {
      updates.aov = result.aov
    }
    if (result.super_low_light && isMissing(device.super_low_light)) {
      updates.super_low_light = result.super_low_light.toLowerCase() === 'yes'
    }
    if (result.codecs && isMissing(device.codecs)) {
      updates.codecs = result.codecs
    }
    if (result.ir && isMissing(device.ir)) {
      updates.ir = result.ir
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      await admin
        .from('device_library_items')
        .update(updates)
        .eq('id', device.id)
      updated++
    }
  }

  return NextResponse.json({
    processed: results.length,
    updated,
  })
}
