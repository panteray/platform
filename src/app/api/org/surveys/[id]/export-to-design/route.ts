import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/**
 * G8: Survey → Design handoff.
 *
 * POST /api/org/surveys/:id/export-to-design
 *
 * Creates a new design linked to the same OPP as the survey. Copies each
 * survey floor plan → `design_areas`, each survey device → `design_devices`
 * with positions, labels, status, and notes preserved. Presales then
 * enriches with vendor library + FOV config in Design module.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // 1. Load survey
  const { data: survey, error: sErr } = await admin
    .from('surveys')
    .select('id, org_id, opp_id, site_name, status')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (sErr || !survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })

  // 2. Create design
  const { data: design, error: dErr } = await admin
    .from('designs')
    .insert({
      org_id: dbUser.org_id,
      opp_id: survey.opp_id,
      name: `${survey.site_name || 'Survey'} — Design`,
      status: 'ACTIVE',
      created_by: dbUser.id,
    })
    .select('id')
    .single()

  if (dErr || !design) {
    return NextResponse.json({ error: dErr?.message || 'Design create failed' }, { status: 500 })
  }

  // 3. Load floor plans + devices from survey
  const [{ data: fps }, { data: devices }] = await Promise.all([
    admin
      .from('survey_floor_plans')
      .select('id, name, mode, image_url, image_width, image_height, satellite_lat, satellite_lng, satellite_zoom, scale_px_per_ft, display_order')
      .eq('survey_id', id)
      .eq('org_id', dbUser.org_id)
      .order('display_order'),
    admin
      .from('survey_devices')
      .select('*')
      .eq('survey_id', id)
      .eq('org_id', dbUser.org_id),
  ])

  // 4. Create design_areas per floor plan — capture mapping fp.id → area.id
  const fpToArea = new Map<string, string>()
  if (fps && fps.length > 0) {
    for (const fp of fps) {
      const { data: area } = await admin
        .from('design_areas')
        .insert({
          design_id: design.id,
          org_id: dbUser.org_id,
          name: fp.name || 'Area',
          canvas_type: fp.mode === 'satellite' ? 'SATELLITE' : 'FLOOR_PLAN',
          sort_order: fp.display_order ?? 0,
          satellite_lat: fp.satellite_lat,
          satellite_lng: fp.satellite_lng,
          satellite_zoom: fp.satellite_zoom ?? 16,
          scale_calibration: fp.scale_px_per_ft,
        })
        .select('id')
        .single()
      if (area) {
        fpToArea.set(fp.id, area.id)
        // Copy floor plan image into design_floor_plans if present
        if (fp.image_url) {
          await admin.from('design_floor_plans').insert({
            design_id: design.id,
            area_id: area.id,
            file_url: fp.image_url,
            width: fp.image_width,
            height: fp.image_height,
            opacity: 1,
          })
        }
      }
    }
  } else {
    // At least one area required
    const { data: area } = await admin
      .from('design_areas')
      .insert({
        design_id: design.id,
        org_id: dbUser.org_id,
        name: 'Area A',
        canvas_type: 'FLOOR_PLAN',
        sort_order: 0,
        satellite_zoom: 16,
      })
      .select('id')
      .single()
    if (area) {
      // Map all devices to this area
      for (const fp of fps ?? []) fpToArea.set(fp.id, area.id)
      // Stash "default area" under empty key for devices with null floor_plan_id
      fpToArea.set('__default__', area.id)
    }
  }

  // 5. Map survey system_type → design category
  const mapCategory = (st: string): string => {
    switch (st) {
      case 'cctv': return 'cctv'
      case 'access_control': return 'access_control'
      case 'servers_nvr': return 'servers_nvr'
      case 'network': return 'network'
      case 'av': return 'av'
      case 'vape_environmental': return 'vape_environmental'
      default: return 'other'
    }
  }

  // 6. Copy devices
  let copied = 0
  if (devices && devices.length > 0) {
    const rows = devices.map((d) => ({
      org_id: dbUser.org_id,
      design_id: design.id,
      area_id: d.floor_plan_id
        ? fpToArea.get(d.floor_plan_id) ?? fpToArea.get('__default__') ?? null
        : fpToArea.get('__default__') ?? null,
      category: mapCategory(d.system_type),
      label: d.label || '',
      position_x: d.position_x ?? 0,
      position_y: d.position_y ?? 0,
      status: d.status === 'existing_keep' || d.status === 'existing_remove' ? 'existing' : 'new',
      condition: d.condition,
      mount_type: d.mount_type,
      color_hex: d.color_hex,
      rotation: d.fov_rotation ?? 0,
      properties: {
        survey_source_id: d.id,
        survey_device_type: d.device_type,
        vendor: d.vendor,
        model: d.model,
        resolution: d.resolution,
        mount_height_in: d.mount_height_in,
        cable_type: d.cable_type,
        cable_run_ft: d.cable_run_ft,
        fov_angle: d.fov_angle,
        notes: d.notes,
        existing_make_model: d.existing_make_model,
        location_description: d.location_description,
        detection_capabilities: d.detection_capabilities,
        door_config: d.door_config,
        wptp_pair_id: d.wptp_pair_id,
      },
    }))

    const { error: devErr, count } = await admin
      .from('design_devices')
      .insert(rows, { count: 'exact' })

    if (devErr) {
      await admin.from('designs').delete().eq('id', design.id)
      return NextResponse.json({ error: `Device copy failed: ${devErr.message}` }, { status: 500 })
    }
    copied = count ?? rows.length
  }

  return NextResponse.json({
    design_id: design.id,
    areas_created: fpToArea.size || 1,
    devices_copied: copied,
  })
}
