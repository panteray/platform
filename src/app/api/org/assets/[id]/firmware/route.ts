import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('asset_firmware_history')
    .select('*')
    .eq('asset_id', id)
    .eq('org_id', dbUser.org_id)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.version) return NextResponse.json({ error: 'version required' }, { status: 400 })

  const admin = createAdminClient()

  // Get current firmware version
  const { data: asset } = await admin
    .from('assets')
    .select('firmware_version')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  const { data, error } = await admin
    .from('asset_firmware_history')
    .insert({
      org_id: dbUser.org_id,
      asset_id: id,
      version: body.version,
      previous_version: asset.firmware_version,
      updated_by: dbUser.id,
      notes: body.notes ?? null,
      cve_fixes: body.cve_fixes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update asset's current firmware_version
  await admin
    .from('assets')
    .update({ firmware_version: body.version, updated_at: new Date().toISOString() })
    .eq('id', id)

  // Log lifecycle event
  await admin.from('asset_lifecycle_events').insert({
    org_id: dbUser.org_id,
    asset_id: id,
    event_type: 'firmware_updated',
    details: { from: asset.firmware_version, to: body.version, cve_fixes: body.cve_fixes },
    user_id: dbUser.id,
  })

  return NextResponse.json(data, { status: 201 })
}
