import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('asset_maintenance')
    .select('*')
    .eq('asset_id', id)
    .eq('org_id', dbUser.org_id)
    .order('scheduled_at', { ascending: false, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  const admin = createAdminClient()
  const allowed = ['type', 'scheduled_at', 'completed_at', 'completed_by', 'technician_notes', 'cost', 'parts_used', 'photos']
  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    asset_id: id,
    created_by: dbUser.id,
  }
  for (const k of allowed) if (body[k] !== undefined) insert[k] = body[k]

  const { data, error } = await admin.from('asset_maintenance').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const maintenanceId = body.maintenance_id as string
  if (!maintenanceId) return NextResponse.json({ error: 'maintenance_id required' }, { status: 400 })

  const admin = createAdminClient()
  const allowed = ['scheduled_at', 'completed_at', 'completed_by', 'technician_notes', 'cost', 'parts_used', 'photos']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]

  const { data, error } = await admin
    .from('asset_maintenance')
    .update(update)
    .eq('id', maintenanceId)
    .eq('asset_id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If newly completed, log lifecycle event
  if (body.completed_at) {
    await admin.from('asset_lifecycle_events').insert({
      org_id: dbUser.org_id,
      asset_id: id,
      event_type: 'serviced',
      details: { maintenance_id: maintenanceId, type: data.type },
      user_id: dbUser.id,
    })
  }

  return NextResponse.json(data)
}
