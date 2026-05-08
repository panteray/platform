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

  // 3. Load floor plans, devices, cables, infrastructure, photos
  const [{ data: fps }, { data: devices }, { data: cables }, { data: infras }, { data: photos }] = await Promise.all([
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
    admin
      .from('survey_cables')
      .select('*')
      .eq('survey_id', id)
      .eq('org_id', dbUser.org_id),
    admin
      .from('survey_infrastructure')
      .select('*')
      .eq('survey_id', id)
      .eq('org_id', dbUser.org_id),
    admin
      .from('survey_photos')
      .select('id, device_id, infra_id, storage_url, caption, lat, lng, taken_at')
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

  // 6. Copy devices — group photos by device first so they ride along in properties
  const photosByDevice = new Map<string, Array<{ url: string; caption: string | null; lat: number | null; lng: number | null; taken_at: string | null }>>()
  for (const p of photos ?? []) {
    if (!p.device_id) continue
    const arr = photosByDevice.get(p.device_id) ?? []
    arr.push({ url: p.storage_url, caption: p.caption, lat: p.lat, lng: p.lng, taken_at: p.taken_at })
    photosByDevice.set(p.device_id, arr)
  }

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
        alert_destination: d.alert_destination,
        integration_method: d.integration_method,
        relay_output: d.relay_output,
        power_source: d.power_source,
        photos: photosByDevice.get(d.id) ?? [],
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

  // 7. Copy cables — survey polyline (lat/lng or px) → design waypoints {x,y}
  let cablesCopied = 0
  if (cables && cables.length > 0) {
    const cableRows = cables.map((c) => {
      const waypoints = Array.isArray(c.polyline)
        ? (c.polyline as unknown[]).map((pt) => Array.isArray(pt) ? { x: Number(pt[0]) || 0, y: Number(pt[1]) || 0 } : { x: 0, y: 0 })
        : []
      const slack = c.slack_pct ?? 0
      const length = c.length_ft ?? 0
      return {
        org_id: dbUser.org_id,
        design_id: design.id,
        area_id: c.floor_plan_id
          ? fpToArea.get(c.floor_plan_id) ?? fpToArea.get('__default__') ?? null
          : fpToArea.get('__default__') ?? null,
        cable_type: c.cable_type || 'cat6',
        label: c.label || null,
        waypoints,
        length_ft: length,
        slack_pct: slack,
        total_length_ft: length * (1 + slack / 100),
        service_loop_ft: 0,
        from_device_id: null,
        to_device_id: null,
        mdf_idf_id: null,
        color_hex: c.color_hex,
      }
    })
    const { count: cCount } = await admin
      .from('design_cables')
      .insert(cableRows, { count: 'exact' })
    cablesCopied = cCount ?? cableRows.length
  }

  // 8. Copy MDF/IDF infrastructure — only mdf/idf rows map cleanly to design_mdf_idf
  let infraCopied = 0
  if (infras && infras.length > 0) {
    const mdfRows = infras
      .filter((i) => i.type === 'mdf' || i.type === 'idf')
      .map((i) => ({
        org_id: dbUser.org_id,
        design_id: design.id,
        area_id: i.floor_plan_id
          ? fpToArea.get(i.floor_plan_id) ?? fpToArea.get('__default__') ?? null
          : fpToArea.get('__default__') ?? null,
        name: i.name || (i.type === 'mdf' ? 'MDF' : 'IDF'),
        position_x: 0,
        position_y: 0,
        color_hex: null,
        service_loop_ft: 0,
        location_description: i.location || i.mdf_idf_locations || null,
        notes: i.notes,
      }))
    if (mdfRows.length > 0) {
      const { count: iCount } = await admin
        .from('design_mdf_idf')
        .insert(mdfRows, { count: 'exact' })
      infraCopied = iCount ?? mdfRows.length
    }
  }

  // 9. Count photos that rode along inside device properties
  const photosAttached = Array.from(photosByDevice.values()).reduce((n, arr) => n + arr.length, 0)

  return NextResponse.json({
    design_id: design.id,
    areas_created: fpToArea.size || 1,
    devices_copied: copied,
    cables_copied: cablesCopied,
    infrastructure_copied: infraCopied,
    photos_attached: photosAttached,
  })
}
