import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const areaId = request.nextUrl.searchParams.get('area_id')
  const admin = createAdminClient()

  const { data: design } = await admin
    .from('designs')
    .select('id')
    .eq('id', designId)
    .eq('org_id', user.org_id)
    .single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  let query = admin
    .from('design_wifi_aps')
    .select('*')
    .eq('design_id', designId)
    .order('created_at', { ascending: true })

  if (areaId) query = query.eq('area_id', areaId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ wifi_aps: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const admin = createAdminClient()

  const { data: design } = await admin
    .from('designs')
    .select('id')
    .eq('id', designId)
    .eq('org_id', user.org_id)
    .single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const allowed = [
    'area_id', 'canvas_id', 'ap_model', 'vendor', 'band', 'channel',
    'channel_width', 'tx_power_dbm', 'antenna_gain_dbi', 'mount_height_ft',
    'environment', 'position_x', 'position_y', 'label', 'color_hex', 'notes',
  ]
  const insert: Record<string, unknown> = {
    design_id: designId,
    org_id: user.org_id,
  }
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('design_wifi_aps')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ wifi_ap: data }, { status: 201 })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const apId = request.nextUrl.searchParams.get('ap_id')
  if (!apId) return NextResponse.json({ error: 'ap_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: design } = await admin
    .from('designs')
    .select('id')
    .eq('id', designId)
    .eq('org_id', user.org_id)
    .single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const allowed = [
    'area_id', 'canvas_id', 'ap_model', 'vendor', 'band', 'channel',
    'channel_width', 'tx_power_dbm', 'antenna_gain_dbi', 'mount_height_ft',
    'environment', 'position_x', 'position_y', 'label', 'color_hex', 'notes',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('design_wifi_aps')
    .update(update)
    .eq('id', apId)
    .eq('design_id', designId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ wifi_ap: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const apId = request.nextUrl.searchParams.get('ap_id')
  if (!apId) return NextResponse.json({ error: 'ap_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: design } = await admin
    .from('designs')
    .select('id')
    .eq('id', designId)
    .eq('org_id', user.org_id)
    .single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  const { error } = await admin
    .from('design_wifi_aps')
    .delete()
    .eq('id', apId)
    .eq('design_id', designId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
