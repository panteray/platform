import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const TARGET_FIELDS = [
  'form', 'resolution', 'fps', 'poe_standard', 'wattage', 'ndaa_compliant',
  'ir', 'super_low_light', 'focal_length', 'focal_type', 'aov',
  'imager_count', 'multi_imager_type', 'codecs', 'fisheye_view', 'environment',
]

const SELECT_COLS = 'id, vendor, model, form, resolution, fps, poe_standard, wattage, ndaa_compliant, ir, super_low_light, focal_length, focal_type, aov, imager_count, multi_imager_type, codecs, fisheye_view, environment'

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

  // Get all devices (org + global) — paginate past Supabase 1000 row limit
  const allData: Record<string, unknown>[] = []
  let offset = 0
  const batchSize = 1000
  while (true) {
    const { data, error } = await admin
      .from('device_library_items')
      .select(SELECT_COLS)
      .or(`org_id.is.null,org_id.eq.${orgId}`)
      .order('vendor', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!data || data.length === 0) break
    allData.push(...data)
    if (data.length < batchSize) break
    offset += batchSize
  }

  // Group by manufacturer, identify which need enrichment
  const grouped: Record<string, {
    total: number
    needs_enrichment: number
    devices: { id: string; model: string; missing: string[] }[]
  }> = {}

  for (const item of allData) {
    const mfr = (item.vendor as string) || 'Unknown'
    if (!grouped[mfr]) {
      grouped[mfr] = { total: 0, needs_enrichment: 0, devices: [] }
    }
    grouped[mfr].total++

    const missing = TARGET_FIELDS.filter((f) => isMissing(item[f]))
    if (missing.length > 0) {
      grouped[mfr].needs_enrichment++
      grouped[mfr].devices.push({ id: item.id as string, model: item.model as string, missing })
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

  // Fetch devices (org + global)
  const { data: devices, error: fetchErr } = await admin
    .from('device_library_items')
    .select(SELECT_COLS)
    .in('id', body.device_ids)
    .or(`org_id.is.null,org_id.eq.${orgId}`)

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
      existing_fl: d.focal_length,
      existing_codecs: d.codecs,
      existing_ir: d.ir,
      existing_fps: d.fps,
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
Format: [{"model":"EXACT_MODEL","form":"...","resolution":"...","fps":"...","poe_standard":"...","wattage":"...","ndaa_compliant":"...","ir":"...","super_low_light":"...","focal_length":"...","focal_type":"...","aov":"...","imager_count":"...","multi_imager_type":"...","codecs":"...","fisheye_view":"...","environment":"..."}]

Rules:
- form: "Dome"|"Bullet"|"Turret"|"PTZ"|"Box"|"Fisheye"|"Multi-Sensor"|"Cube"|"Covert"
- resolution: pixel dimensions "1920x1080" or megapixel "2MP", "4MP", "8MP"
- fps: max framerate as string "30" or "60"
- poe_standard: "PoE"|"PoE+"|"PoE++"|"12VDC"|"24VAC"
- wattage: max power in watts as number string "12.5"
- ndaa_compliant: "Yes"|"No"
- environment: "Indoor"|"Outdoor"|"Both" (Bullet → always Outdoor; -E suffix → Outdoor; -I suffix → Indoor)
- focal_length: "2.8mm" fixed or "2.8mm - 12mm" varifocal range
- focal_type: "Fixed"|"Varifocal"
- aov: horizontal field of view "97°" or "30° - 91°" range
- super_low_light: "Yes" if starlight/extreme-low-light capable, else "No"
- codecs: "H.264, H.265, MJPEG" (H.265 on cameras manufactured ~2016+)
- ir: IR distance "30m" or "No"
- imager_count: number of sensors "1", "2", "4"
- multi_imager_type: "Single"|"Dual"|"Quad"|"Panoramic" (only if imager_count > 1)
- fisheye_view: dewarped FOV degrees or omit

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

    const device = devices.find(
      (d) => d.model === result.model || d.model.toUpperCase() === result.model.toUpperCase()
    )
    if (!device) continue

    const updates: Record<string, unknown> = {}

    if (result.form && isMissing(device.form)) updates.form = result.form
    if (result.resolution && isMissing(device.resolution)) updates.resolution = result.resolution
    if (result.fps && isMissing(device.fps)) updates.fps = result.fps
    if (result.poe_standard && isMissing(device.poe_standard)) updates.poe_standard = result.poe_standard
    if (result.wattage && isMissing(device.wattage)) updates.wattage = parseFloat(result.wattage) || null
    if (result.ndaa_compliant && isMissing(device.ndaa_compliant)) updates.ndaa_compliant = result.ndaa_compliant.toLowerCase() === 'yes'
    if (result.environment && isMissing(device.environment)) updates.environment = result.environment
    if (result.focal_length && isMissing(device.focal_length)) updates.focal_length = result.focal_length
    if (result.focal_type && isMissing(device.focal_type)) updates.focal_type = result.focal_type
    if (result.aov && isMissing(device.aov)) updates.aov = result.aov
    if (result.super_low_light && isMissing(device.super_low_light)) updates.super_low_light = result.super_low_light.toLowerCase() === 'yes'
    if (result.codecs && isMissing(device.codecs)) updates.codecs = result.codecs
    if (result.ir && isMissing(device.ir)) updates.ir = result.ir
    if (result.imager_count && isMissing(device.imager_count)) updates.imager_count = parseInt(result.imager_count, 10) || null
    if (result.multi_imager_type && isMissing(device.multi_imager_type)) updates.multi_imager_type = result.multi_imager_type
    if (result.fisheye_view && isMissing(device.fisheye_view)) updates.fisheye_view = result.fisheye_view

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
