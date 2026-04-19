import { createAdminClient } from '@/lib/supabase/admin'
import type { Vertical } from '@/lib/export-templates/site-requirements'

export interface AreaDeviceRow {
  id: string
  label: string
  category: string
  status: string
  mount_type: string | null
  position_x: number
  position_y: number
  rotation: number
  properties: Record<string, unknown>
  cableRunFt: number | null
  mdfName: string | null
}

export interface AreaRow {
  id: string
  name: string
  sort_order: number | null
  satellite_lat: number | null
  satellite_lng: number | null
  satellite_zoom: number
  scale_calibration: number | null
  devices: AreaDeviceRow[]
  mdfs: Array<{ id: string; name: string; position_x: number; position_y: number; location_description: string | null }>
  walls: Array<{ id: string; points: Array<{ x: number; y: number }>; color: string; wall_type: string }>
  totals: { new: number; ext: number; int: number; cables: number; cableFt: number }
}

export interface HardwareScheduleData {
  design: { id: string; name: string }
  opp: {
    id: string | null
    opp_number: string | null
    project_name: string | null
    system_name: string | null
    customer_name: string | null
    install_address: string | null
    state: string | null
    poc_name: string | null
    poc_phone: string | null
    poc_email: string | null
  } | null
  vertical: Vertical | null
  mapsKey: string
  areas: AreaRow[]
  materialsByArea: Array<{ areaName: string; lines: Array<{ qty: number; mpn: string; description: string; manufacturer: string }> }>
  totals: { newCameras: number; exterior: number; interior: number; cableFt: number; conduitFt: number; relocations: number }
  generatedAt: string
}

const EXT_CATEGORIES = new Set(['camera_outdoor', 'exterior'])

function normVertical(v: string | null): Vertical | null {
  if (!v) return null
  const s = v.toLowerCase()
  if (s.includes('k-12') || s.includes('k12') || s.includes('school')) return 'k12'
  if (s.includes('higher') || s.includes('university') || s.includes('college')) return 'hed'
  if (s.includes('med') || s.includes('health') || s.includes('hospital')) return 'med'
  if (s.includes('gov') || s.includes('federal') || s.includes('military')) return 'gov'
  if (['k12', 'hed', 'med', 'biz', 'gov'].includes(s)) return s as Vertical
  return 'biz'
}

export async function loadHardwareScheduleData(designId: string, orgId: string): Promise<HardwareScheduleData | null> {
  const admin = createAdminClient()

  const { data: design } = await admin
    .from('designs')
    .select('id, name, opp_id')
    .eq('id', designId).eq('org_id', orgId).single()
  if (!design) return null

  const [{ data: opp }, { data: areas }, { data: devices }, { data: cables }, { data: mdfs }, { data: walls }] = await Promise.all([
    design.opp_id
      ? admin.from('opportunities').select('id, opp_number, project_name, system_name, customer_name, install_address, state, poc_name, poc_phone, poc_email, vertical').eq('id', design.opp_id).single()
      : Promise.resolve({ data: null }),
    admin.from('design_areas').select('id, name, sort_order, satellite_lat, satellite_lng, satellite_zoom, scale_calibration').eq('design_id', designId).order('sort_order', { ascending: true, nullsFirst: false }),
    admin.from('design_devices').select('*').eq('design_id', designId),
    admin.from('design_cables').select('id, area_id, from_device_id, to_device_id, mdf_idf_id, total_length_ft').eq('design_id', designId),
    admin.from('design_mdf_idf').select('id, area_id, name, position_x, position_y, location_description').eq('design_id', designId),
    admin.from('design_walls').select('id, area_id, points, color, wall_type').eq('design_id', designId),
  ])

  const mdfById = new Map((mdfs ?? []).map(m => [m.id, m.name]))
  const cablesByDevice = new Map<string, { len: number; mdfName: string | null }>()
  for (const c of cables ?? []) {
    if (!c.from_device_id) continue
    const mdfName = c.mdf_idf_id ? (mdfById.get(c.mdf_idf_id) ?? null) : null
    const existing = cablesByDevice.get(c.from_device_id)
    const len = c.total_length_ft || 0
    if (!existing || len > existing.len) cablesByDevice.set(c.from_device_id, { len, mdfName })
  }

  const devicesByArea = new Map<string, typeof devices>()
  for (const d of devices ?? []) {
    const a = d.area_id ?? 'unassigned'
    const list = devicesByArea.get(a) ?? []
    list.push(d)
    devicesByArea.set(a, list)
  }

  const areaRows: AreaRow[] = (areas ?? []).map(a => {
    const areaDevices = devicesByArea.get(a.id) ?? []
    const areaCables = (cables ?? []).filter(c => c.area_id === a.id)
    const areaMdfs = (mdfs ?? []).filter(m => m.area_id === a.id).map(m => ({
      id: m.id, name: m.name, position_x: m.position_x, position_y: m.position_y, location_description: m.location_description,
    }))
    const areaWalls = (walls ?? []).filter(w => w.area_id === a.id).map(w => ({
      id: w.id,
      points: (w.points as Array<{ x: number; y: number }>) ?? [],
      color: w.color || '#f97316',
      wall_type: w.wall_type || 'exterior',
    }))

    let newCount = 0, extCount = 0, intCount = 0
    const rows: AreaDeviceRow[] = areaDevices.map(d => {
      const p = (d.properties ?? {}) as Record<string, unknown>
      if (d.status === 'new' || d.status === 'planned') newCount++
      if (EXT_CATEGORIES.has(d.category) || String(p.environment || '').toLowerCase() === 'outdoor') extCount++
      else intCount++
      const cable = cablesByDevice.get(d.id)
      return {
        id: d.id,
        label: d.label,
        category: d.category,
        status: d.status,
        mount_type: d.mount_type,
        position_x: d.position_x,
        position_y: d.position_y,
        rotation: d.rotation,
        properties: p,
        cableRunFt: cable?.len ?? null,
        mdfName: cable?.mdfName ?? null,
      }
    })

    const cableFtTotal = areaCables.reduce((s, c) => s + (c.total_length_ft || 0), 0)

    return {
      id: a.id,
      name: a.name,
      sort_order: a.sort_order,
      satellite_lat: a.satellite_lat,
      satellite_lng: a.satellite_lng,
      satellite_zoom: a.satellite_zoom || 18,
      scale_calibration: a.scale_calibration,
      devices: rows,
      mdfs: areaMdfs,
      walls: areaWalls,
      totals: { new: newCount, ext: extCount, int: intCount, cables: areaCables.length, cableFt: Math.round(cableFtTotal) },
    }
  })

  // Materials by area — group by MPN
  const materialsByArea = areaRows.map(a => {
    const groups = new Map<string, { qty: number; mpn: string; description: string; manufacturer: string }>()
    for (const d of a.devices) {
      const p = d.properties
      const mpn = String(p.partnumber || p.part_number || p.model || d.label || '')
      const mfr = String(p.manufacturer || p.vendor || '')
      const desc = String(p.description || d.label || '')
      const key = `${mfr}|${mpn}`
      const existing = groups.get(key)
      if (existing) existing.qty++
      else groups.set(key, { qty: 1, mpn, description: desc, manufacturer: mfr })
    }
    return { areaName: a.name, lines: Array.from(groups.values()) }
  })

  // Totals
  const totals = areaRows.reduce(
    (acc, a) => ({
      newCameras: acc.newCameras + a.totals.new,
      exterior: acc.exterior + a.totals.ext,
      interior: acc.interior + a.totals.int,
      cableFt: acc.cableFt + a.totals.cableFt,
      conduitFt: acc.conduitFt,
      relocations: acc.relocations + a.devices.filter(d => d.status === 'relocate').length,
    }),
    { newCameras: 0, exterior: 0, interior: 0, cableFt: 0, conduitFt: 0, relocations: 0 },
  )

  // Maps key (server-side)
  const mapsKey = process.env.GOOGLE_MAPS_STATIC_KEY || process.env.GOOGLE_MAPS_API_KEY || ''

  return {
    design: { id: design.id, name: design.name },
    opp: opp ? {
      id: opp.id,
      opp_number: opp.opp_number,
      project_name: opp.project_name,
      system_name: opp.system_name,
      customer_name: opp.customer_name,
      install_address: opp.install_address,
      state: opp.state,
      poc_name: opp.poc_name,
      poc_phone: opp.poc_phone,
      poc_email: opp.poc_email,
    } : null,
    vertical: normVertical(opp?.vertical ?? null),
    mapsKey,
    areas: areaRows,
    materialsByArea,
    totals,
    generatedAt: new Date().toISOString(),
  }
}
