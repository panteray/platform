import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customerId = req.nextUrl.searchParams.get('customer_id')
  const projectId = req.nextUrl.searchParams.get('project_id')
  const status = req.nextUrl.searchParams.get('status')
  const warrantyExpiring = req.nextUrl.searchParams.get('warranty_expiring')

  const admin = createAdminClient()

  let query = admin
    .from('assets')
    .select('*, customer:customers(id, name), project:projects(id, pn, name)')
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (customerId) query = query.eq('customer_id', customerId)
  if (projectId) query = query.eq('project_id', projectId)
  if (status) query = query.eq('status', status)
  if (warrantyExpiring) {
    const days = parseInt(warrantyExpiring) || 90
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    query = query.lte('warranty_expires_at', cutoff).gte('warranty_expires_at', new Date().toISOString().split('T')[0])
  }

  const { data, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.label) return NextResponse.json({ error: 'label required' }, { status: 400 })

  const admin = createAdminClient()
  const allowed = [
    'project_id', 'install_item_id', 'device_id', 'customer_id', 'site_id',
    'asset_tag', 'label', 'category', 'vendor', 'model', 'serial_number',
    'mac_address', 'status', 'install_date', 'warranty_start', 'warranty_expires_at',
    'eol_date', 'firmware_version', 'ip_address', 'location_notes',
    'position_x', 'position_y', 'photos', 'specs', 'notes',
  ]
  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    created_by: dbUser.id,
  }
  for (const k of allowed) if (body[k] !== undefined) insert[k] = body[k]

  const { data, error } = await admin.from('assets').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log lifecycle event
  await admin.from('asset_lifecycle_events').insert({
    org_id: dbUser.org_id,
    asset_id: data.id,
    event_type: 'installed',
    details: { source: 'manual_create' },
    user_id: dbUser.id,
  })

  return NextResponse.json(data, { status: 201 })
}
