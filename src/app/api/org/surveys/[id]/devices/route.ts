import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/** GET /api/org/surveys/:id/devices */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('survey_devices')
    .select('*')
    .eq('survey_id', id)
    .eq('org_id', dbUser.org_id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/org/surveys/:id/devices — create device */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('survey_devices')
    .insert({
      survey_id: id,
      floor_plan_id: body.floor_plan_id || null,
      org_id: dbUser.org_id,
      system_type: body.system_type || 'cctv',
      device_type: body.device_type || 'camera_fixed',
      label: body.label || '',
      status: body.status || 'new',
      condition: body.condition || 'unknown',
      existing_make_model: body.existing_make_model || null,
      location_description: body.location_description || null,
      vendor: body.vendor || null,
      model: body.model || null,
      resolution: body.resolution || null,
      mount_type: body.mount_type || null,
      mount_height_in: body.mount_height_in || null,
      cable_type: body.cable_type || null,
      cable_run_ft: body.cable_run_ft || null,
      color_hex: body.color_hex || null,
      fov_angle: body.fov_angle || 90,
      fov_rotation: body.fov_rotation || 0,
      notes: body.notes || null,
      position_x: body.position_x ?? 0,
      position_y: body.position_y ?? 0,
      detection_capabilities: body.detection_capabilities || {},
      alert_destination: body.alert_destination || null,
      integration_method: body.integration_method || null,
      relay_output: body.relay_output || null,
      power_source: body.power_source || null,
      door_config: body.door_config || {},
      wptp_pair_id: body.wptp_pair_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

/** PATCH /api/org/surveys/:id/devices?device_id=... — update device */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const deviceId = req.nextUrl.searchParams.get('device_id')
  if (!deviceId) return NextResponse.json({ error: 'device_id required' }, { status: 400 })

  const body = await req.json()
  const admin = createAdminClient()

  const allowed = [
    'floor_plan_id', 'system_type', 'device_type', 'label', 'status', 'condition',
    'existing_make_model', 'location_description', 'vendor', 'model', 'resolution',
    'mount_type', 'mount_height_in', 'cable_type', 'cable_run_ft', 'color_hex',
    'fov_angle', 'fov_rotation', 'notes', 'position_x', 'position_y',
    'detection_capabilities', 'alert_destination', 'integration_method',
    'relay_output', 'power_source', 'door_config', 'wptp_pair_id',
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await admin
    .from('survey_devices')
    .update(updates)
    .eq('id', deviceId)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** DELETE /api/org/surveys/:id/devices?device_id=... */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const deviceId = req.nextUrl.searchParams.get('device_id')
  if (!deviceId) return NextResponse.json({ error: 'device_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('survey_devices')
    .delete()
    .eq('id', deviceId)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
