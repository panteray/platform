import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/org/designs/[id]/devices/[deviceId]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; deviceId: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId, deviceId } = await params
  const admin = createAdminClient()

  const { data: device, error } = await admin
    .from('design_devices')
    .select('*')
    .eq('id', deviceId)
    .eq('design_id', designId)
    .single()

  if (error || !device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  // Verify org
  if (device.org_id !== user.org_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  return NextResponse.json({ device })
}

// PATCH /api/org/designs/[id]/devices/[deviceId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; deviceId: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId, deviceId } = await params
  const body = await request.json()
  const admin = createAdminClient()

  // Verify device belongs to design in user's org
  const { data: existing } = await admin
    .from('design_devices')
    .select('id, org_id')
    .eq('id', deviceId)
    .eq('design_id', designId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  if (existing.org_id !== user.org_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  // Whitelist updatable fields
  const allowed: Record<string, unknown> = {}
  const fields = [
    'area_id', 'canvas_id', 'device_library_item_id', 'category',
    'label', 'position_x', 'position_y', 'status', 'condition',
    'mount_type', 'color_hex', 'rotation', 'properties', 'asset_type',
    'billing_type', 'recurring_cost', 'zone_id',
  ]

  for (const f of fields) {
    if (body[f] !== undefined) allowed[f] = body[f]
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No updatable fields' }, { status: 400 })
  }

  allowed.updated_at = new Date().toISOString()

  const { data: device, error } = await admin
    .from('design_devices')
    .update(allowed)
    .eq('id', deviceId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ device })
}
