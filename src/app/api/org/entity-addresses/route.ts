import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
export async function GET(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entity_type')
  const entityId = searchParams.get('entity_id')
  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('entity_addresses')
    .select('*')
    .eq('org_id', caller.org_id)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  const { data, error } = await admin.from('entity_addresses').insert({
    org_id: caller.org_id,
    entity_type: body.entity_type,
    entity_id: body.entity_id,
    label: body.label ?? 'Primary',
    address: body.address ?? null,
    city: body.city ?? null,
    state: body.state ?? null,
    zip: body.zip ?? null,
    is_primary: body.is_primary ?? false,
    notes: body.notes ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  const { data: target } = await admin.from('entity_addresses').select('org_id').eq('id', body.id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Address not in your organization' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  for (const f of ['label', 'address', 'city', 'state', 'zip', 'is_primary', 'notes']) {
    if (body[f] !== undefined) updateData[f] = body[f]
  }

  const { data, error } = await admin.from('entity_addresses').update(updateData).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin.from('entity_addresses').select('org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Address not in your organization' }, { status: 403 })
  }

  const { error } = await admin.from('entity_addresses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
