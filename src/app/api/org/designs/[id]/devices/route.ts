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
      .select('id, specs')
      .in('id', [...new Set(libraryIds)])

    if (libraryItems) {
      const specsMap = new Map(
        libraryItems.map((li: { id: string; specs: Record<string, unknown> | null }) => [li.id, li.specs])
      )
      for (const d of devices) {
        const libSpecs = specsMap.get(d.device_library_item_id as string)
        if (libSpecs && typeof libSpecs === 'object') {
          const deviceProps = (d.properties ?? {}) as Record<string, unknown>
          d.properties = { ...libSpecs, ...deviceProps }
        }
      }
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
