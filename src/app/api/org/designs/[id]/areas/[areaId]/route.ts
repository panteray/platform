import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDesignAccess } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { areaId } = await params
  const admin = createAdminClient()

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = ['name', 'canvas_type', 'scale_calibration', 'infrastructure_observations',
    'satellite_lat', 'satellite_lng', 'satellite_zoom', 'sort_order']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('design_areas')
    .update(updates)
    .eq('id', areaId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ area: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId, areaId } = await params
  const admin = createAdminClient()

  // Delete child objects first
  await admin.from('design_devices').delete().eq('area_id', areaId)
  await admin.from('design_cables').delete().eq('area_id', areaId)
  await admin.from('design_mdf_idf').delete().eq('area_id', areaId)
  await admin.from('design_floor_plans').delete().eq('area_id', areaId)
  await admin.from('door_configs').delete().eq('area_id', areaId)

  const { error } = await admin
    .from('design_areas')
    .delete()
    .eq('id', areaId)
    .eq('design_id', designId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ deleted: true })
}
