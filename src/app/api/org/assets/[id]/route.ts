import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('assets')
    .select('*, customer:customers(id, name), project:projects(id, pn, name), install_item:install_items(id, label)')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Get current asset for status change detection
  const { data: current } = await admin
    .from('assets')
    .select('status, firmware_version')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (!current) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  const allowed = [
    'asset_tag', 'label', 'category', 'vendor', 'model', 'serial_number',
    'mac_address', 'status', 'install_date', 'warranty_start', 'warranty_expires_at',
    'eol_date', 'retired_at', 'firmware_version', 'ip_address', 'location_notes',
    'position_x', 'position_y', 'photos', 'specs', 'notes',
  ]
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]

  const { data, error } = await admin
    .from('assets')
    .update(update)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log lifecycle events on meaningful changes
  const events: Array<{ event_type: string; details: Record<string, unknown> }> = []
  if (body.status && body.status !== current.status) {
    const statusToEvent: Record<string, string> = {
      retired: 'retired',
      rma: 'rma_initiated',
      replaced: 'replaced',
      active: 'reactivated',
    }
    const eventType = statusToEvent[body.status as string]
    if (eventType) {
      events.push({ event_type: eventType, details: { from: current.status, to: body.status } })
    }
  }
  if (body.firmware_version && body.firmware_version !== current.firmware_version) {
    events.push({
      event_type: 'firmware_updated',
      details: { from: current.firmware_version, to: body.firmware_version },
    })
    // Also log firmware history
    await admin.from('asset_firmware_history').insert({
      org_id: dbUser.org_id,
      asset_id: id,
      version: body.firmware_version,
      previous_version: current.firmware_version,
      updated_by: dbUser.id,
    })
  }

  for (const ev of events) {
    await admin.from('asset_lifecycle_events').insert({
      org_id: dbUser.org_id,
      asset_id: id,
      event_type: ev.event_type,
      details: ev.details,
      user_id: dbUser.id,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  // Soft retire
  const { data, error } = await admin
    .from('assets')
    .update({ status: 'retired', retired_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('asset_lifecycle_events').insert({
    org_id: dbUser.org_id,
    asset_id: id,
    event_type: 'retired',
    details: { source: 'delete_endpoint' },
    user_id: dbUser.id,
  })

  return NextResponse.json(data)
}
