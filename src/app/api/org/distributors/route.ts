import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
async function nextDistNumber(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const { data } = await admin.from('distributors').select('distributor_number').eq('org_id', orgId).order('distributor_number', { ascending: false }).limit(1)
  const last = data?.[0]?.distributor_number
  const num = last ? parseInt(last.replace('DT-', ''), 10) + 1 : 1
  return `DT-${String(num).padStart(6, '0')}`
}

export async function GET() {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  const { data, error } = await admin.from('distributors').select('*').eq('org_id', caller.org_id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const admin = createAdminClient()
  const distNumber = await nextDistNumber(admin, caller.org_id)
  const { data, error } = await admin.from('distributors').insert({
    org_id: caller.org_id, distributor_number: distNumber,
    name: body.name, account_number: body.account_number ?? null,
    rep_name: body.rep_name ?? null, rep_email: body.rep_email ?? null, rep_phone: body.rep_phone ?? null,
    website: body.website ?? null, address: body.address ?? null, state: body.state ?? null,
    region_state: body.region_state ?? null, notes: body.notes ?? null, created_by: caller.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await admin.from('audit_log').insert({ org_id: caller.org_id, user_id: caller.id, action: 'distributor.created', entity_type: 'distributor', entity_id: data.id, details: { distributor_number: distNumber } })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const admin = createAdminClient()
  const { data: target } = await admin.from('distributors').select('org_id').eq('id', body.id).single()
  if (!target || target.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })
  const updateData: Record<string, unknown> = {}
  const fields = ['name','account_number','rep_name','rep_email','rep_phone','website','portal_login','address','city','state','zip','region','region_state','payment_terms','shipping_methods','credit_limit','discount_tier','is_preferred','is_active','notes','status']
  for (const f of fields) { if (body[f] !== undefined) updateData[f] = body[f] }
  const { data, error } = await admin.from('distributors').update(updateData).eq('id', body.id).select().single()
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
  const { data: target } = await admin.from('distributors').select('org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })
  const { error } = await admin.from('distributors').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await admin.from('audit_log').insert({ org_id: caller.org_id, user_id: caller.id, action: 'distributor.deleted', entity_type: 'distributor', entity_id: id, details: {} })
  return NextResponse.json({ success: true })
}
