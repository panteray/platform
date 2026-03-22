import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Join device_library_items to enrich device properties with library specs
  let query = admin
    .from('design_devices')
    .select('*, device_library_items(specs)')
    .eq('design_id', designId)
    .order('created_at', { ascending: true })

  if (areaId) {
    query = query.eq('area_id', areaId)
  }

  const { data: devices, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Merge library specs into properties (device props take precedence)
  const enriched = (devices ?? []).map((d: Record<string, unknown>) => {
    const librarySpecs = (d.device_library_items as Record<string, unknown> | null)?.specs as Record<string, unknown> | null
    if (librarySpecs && typeof librarySpecs === 'object') {
      const deviceProps = (d.properties ?? {}) as Record<string, unknown>
      d.properties = { ...librarySpecs, ...deviceProps }
    }
    // Remove the join artifact from the response
    delete d.device_library_items
    return d
  })

  return NextResponse.json({ devices: enriched })
}

// POST /api/org/designs/[id]/devices
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const body = await request.json()

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
  let label = body.label
  if (!label) {
    const prefix = body.label_prefix || 'DEV'
    const { count } = await admin
      .from('design_devices')
      .select('id', { count: 'exact', head: true })
      .eq('design_id', designId)
      .ilike('label', `${prefix}-%`)

    const num = (count ?? 0) + 1
    label = `${prefix}-${String(num).padStart(3, '0')}`
  }

  const { data: device, error } = await admin
    .from('design_devices')
    .insert({
      org_id: user.org_id,
      design_id: designId,
      area_id: body.area_id || null,
      canvas_id: body.canvas_id || null,
      device_library_item_id: body.device_library_item_id || null,
      category: body.category || 'other',
      label,
      position_x: body.position_x ?? 0,
      position_y: body.position_y ?? 0,
      status: body.status || 'new',
      condition: body.condition || null,
      mount_type: body.mount_type || null,
      color_hex: body.color_hex || null,
      rotation: body.rotation ?? 0,
      properties: body.properties || {},
      asset_type: body.asset_type || 'capital',
      billing_type: body.billing_type || 'one_time',
      recurring_cost: body.recurring_cost ?? 0,
      zone_id: body.zone_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ device }, { status: 201 })
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
