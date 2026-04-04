import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Camera subcategories that the frontend sends but aren't in the DB enum
const CAMERA_SUBCATS = new Set(['dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'])

// GET /api/org/designs/[id]/devices?area_id=xxx
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const areaId = request.nextUrl.searchParams.get('area_id')

  const admin = createAdminClient()

  // Verify design belongs to user's org
  const { data: design } = await admin
    .from('designs')
    .select('id')
    .eq('id', designId)
    .eq('org_id', user.org_id)
    .single()

  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  let query = admin
    .from('design_devices')
    .select('*')
    .eq('design_id', designId)
    .order('created_at', { ascending: true })

  if (areaId) {
    query = query.eq('area_id', areaId)
  }

  const { data: rawDevices, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const devices = (rawDevices ?? []) as Record<string, unknown>[]

  // Enrich with library specs (no FK constraint, so separate query)
  const libraryIds = devices
    .map((d) => d.device_library_item_id as string | null)
    .filter((id): id is string => !!id)

  if (libraryIds.length > 0) {
    const { data: libraryItems } = await admin
      .from('device_library_items')
      .select('id, vendor, model, partnumber, resolution, fps, poe_standard, wattage, ndaa_compliant, specs, focal_length, focal_type, aov, form, ir, imager_count, multi_imager_type, codecs, super_low_light, environment, subcategory, fisheye_view')
      .in('id', [...new Set(libraryIds)])

    if (libraryItems) {
      const libMap = new Map(
        libraryItems.map((li: Record<string, unknown>) => [li.id as string, li])
      )
      for (const d of devices) {
        const libItem = libMap.get(d.device_library_item_id as string)
        if (!libItem) continue

        // Start with JSONB specs as base
        const libSpecs = (libItem.specs && typeof libItem.specs === 'object'
          ? libItem.specs
          : {}) as Record<string, unknown>

        // Merge top-level catalog fields so Device Specs section is always populated
        const catalogFields: Record<string, unknown> = {}
        if (libItem.vendor) catalogFields.vendor = libItem.vendor
        if (libItem.model) catalogFields.model = libItem.model
        if (libItem.partnumber) catalogFields.partnumber = libItem.partnumber
        if (libItem.poe_standard) catalogFields.poe_standard = libItem.poe_standard
        if (libItem.wattage != null) catalogFields.wattage = libItem.wattage
        if (libItem.ndaa_compliant != null) catalogFields.ndaa_compliant = libItem.ndaa_compliant
        if (libItem.resolution) {
          catalogFields.resolution = libItem.resolution
          const resStr = libItem.resolution as string
          // Try WxH format first
          const [w, h] = resStr.split('x').map(Number)
          if (w && h) {
            catalogFields.resolution_w = w; catalogFields.resolution_h = h
          } else {
            // Parse common resolution strings (4MP, 4K, 1080p, etc.)
            const res = resStr.toLowerCase().replace(/\s/g, '')
            const mpMatch = res.match(/^([\d.]+)mp/)
            const pMatch = res.match(/^(\d+)p$/)
            if (res.includes('4k') || res.includes('uhd')) {
              catalogFields.resolution_w = 3840; catalogFields.resolution_h = 2160
            } else if (res.includes('8k')) {
              catalogFields.resolution_w = 7680; catalogFields.resolution_h = 4320
            } else if (pMatch) {
              const pH = parseInt(pMatch[1], 10)
              catalogFields.resolution_h = pH
              catalogFields.resolution_w = Math.round(pH * 16 / 9)
            } else if (mpMatch) {
              const mp = parseFloat(mpMatch[1])
              const mpToPixels: Record<string, [number, number]> = {
                '1.3': [1280, 960], '2': [1920, 1080], '3': [2048, 1536],
                '4': [2560, 1440], '5': [2592, 1944], '6': [3072, 2048],
                '8': [3840, 2160], '10': [3648, 2736], '12': [4000, 3000],
                '12.5': [4000, 3000], '16': [4608, 3456], '20': [5120, 3840],
                '32': [6528, 4896],
              }
              const exact = mpToPixels[String(mp)]
              if (exact) {
                catalogFields.resolution_w = exact[0]; catalogFields.resolution_h = exact[1]
              } else {
                const totalPx = mp * 1_000_000
                const rW = Math.round(Math.sqrt(totalPx * (4 / 3)))
                catalogFields.resolution_w = rW; catalogFields.resolution_h = Math.round(rW * 3 / 4)
              }
            }
          }
        }
        if (libItem.fps) {
          const fpsNum = parseInt(libItem.fps as string, 10)
          if (fpsNum) catalogFields.fps = fpsNum
        }

        // Optics fields — parse focal_length range strings (e.g. "3.1mm - 8.9mm" → 3.1)
        if (libItem.focal_length) {
          const flStr = String(libItem.focal_length)
          const flNum = parseFloat(flStr)
          if (flNum > 0) catalogFields.focal_length = flNum
          catalogFields.focal_type = libItem.focal_type || (flStr.includes('-') ? 'Variable' : 'Fixed')
        }
        if (libItem.aov) {
          catalogFields.aov = libItem.aov
          // Parse AOV range (e.g. "29° - 83°") → use wide end as default fov_angle
          const aovStr = String(libItem.aov)
          const aovNums = aovStr.match(/[\d.]+/g)?.map(Number).filter(n => n > 0) ?? []
          if (aovNums.length > 0) {
            // Use the widest angle as default FOV
            const wideAngle = Math.max(...aovNums)
            if (wideAngle > 0 && wideAngle <= 360) catalogFields.fov_angle_from_aov = wideAngle
          }
        }
        if (libItem.form) catalogFields.form = libItem.form
        if (libItem.ir) catalogFields.ir = libItem.ir
        if (libItem.imager_count) catalogFields.imager_count = libItem.imager_count
        if (libItem.multi_imager_type) catalogFields.multi_imager_type = libItem.multi_imager_type
        if (libItem.codecs) catalogFields.codecs = libItem.codecs
        if (libItem.super_low_light != null) catalogFields.super_low_light = libItem.super_low_light
        if (libItem.environment) catalogFields.environment = libItem.environment
        if (libItem.subcategory) catalogFields.sub_category = libItem.subcategory
        if (libItem.fisheye_view) catalogFields.fisheye_view = libItem.fisheye_view
        // Default sensor dimensions if library doesn't provide them
        if (!catalogFields.sensor_w && !libSpecs.sensor_w) {
          catalogFields.sensor_w = 5.14
          catalogFields.sensor_h = 3.86
        }

        // Priority: device's own properties > catalog top-level > library specs JSON
        const deviceProps = (d.properties ?? {}) as Record<string, unknown>
        d.properties = { ...libSpecs, ...catalogFields, ...deviceProps }
      }
    }
  }

  // Restore effective subcategory from properties.sub_category → category
  for (const d of devices) {
    const props = (d.properties ?? {}) as Record<string, unknown>
    if (props.sub_category && typeof props.sub_category === 'string') {
      d.category = props.sub_category
    }
  }

  return NextResponse.json({ devices })
}

// POST /api/org/designs/[id]/devices
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify design belongs to user's org
  const { data: design } = await admin
    .from('designs')
    .select('id')
    .eq('id', designId)
    .eq('org_id', user.org_id)
    .single()

  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  // Auto-generate label if not provided
  let label = body.label as string | undefined
  if (!label) {
    const prefix = (body.label_prefix as string) || 'DEV'
    const { count } = await admin
      .from('design_devices')
      .select('id', { count: 'exact', head: true })
      .eq('design_id', designId)
      .ilike('label', `${prefix}-%`)

    const num = (count ?? 0) + 1
    label = `${prefix}-${String(num).padStart(3, '0')}`
  }

  // Map camera subcategories to the valid DB enum 'cctv'
  let dbCategory = (body.category as string) || 'other'
  let properties = (body.properties as Record<string, unknown>) || {}
  if (CAMERA_SUBCATS.has(dbCategory)) {
    properties = { ...properties, sub_category: dbCategory }
    dbCategory = 'cctv'
  }

  const { data: device, error } = await admin
    .from('design_devices')
    .insert({
      org_id: user.org_id,
      design_id: designId,
      area_id: body.area_id || null,
      canvas_id: body.canvas_id || null,
      device_library_item_id: body.device_library_item_id || null,
      category: dbCategory,
      label,
      position_x: body.position_x ?? 0,
      position_y: body.position_y ?? 0,
      status: body.status || 'new',
      condition: body.condition || null,
      mount_type: body.mount_type || null,
      color_hex: body.color_hex || null,
      rotation: body.rotation ?? 0,
      properties,
      asset_type: body.asset_type || 'capital',
      billing_type: body.billing_type || 'one_time',
      recurring_cost: body.recurring_cost ?? 0,
      zone_id: body.zone_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Restore effective subcategory for frontend
  const result = device as Record<string, unknown>
  const deviceProps = (result.properties ?? {}) as Record<string, unknown>
  if (deviceProps.sub_category && typeof deviceProps.sub_category === 'string') {
    result.category = deviceProps.sub_category
  }

  return NextResponse.json({ device: result }, { status: 201 })
}

// DELETE /api/org/designs/[id]/devices?device_id=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const deviceId = request.nextUrl.searchParams.get('device_id')
  if (!deviceId) return NextResponse.json({ error: 'device_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify design belongs to user's org
  const { data: design } = await admin
    .from('designs')
    .select('id')
    .eq('id', designId)
    .eq('org_id', user.org_id)
    .single()

  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  const { error } = await admin
    .from('design_devices')
    .delete()
    .eq('id', deviceId)
    .eq('design_id', designId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
