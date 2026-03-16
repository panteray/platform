import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
async function nextMfrNumber(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const { data } = await admin.from('manufacturers').select('manufacturer_number').eq('org_id', orgId).order('manufacturer_number', { ascending: false }).limit(1)
  const last = data?.[0]?.manufacturer_number
  const num = last ? parseInt(last.replace('MFR-', ''), 10) + 1 : 1
  return `MFR-${String(num).padStart(6, '0')}`
}

export async function GET() {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  const { data, error } = await admin.from('manufacturers').select('*').eq('org_id', caller.org_id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const admin = createAdminClient()
  const mfrNumber = await nextMfrNumber(admin, caller.org_id)
  const { data, error } = await admin.from('manufacturers').insert({
    org_id: caller.org_id, manufacturer_number: mfrNumber,
    name: body.name, official_business_name: body.official_business_name ?? null,
    product_category: body.product_category ?? null, contact_name: body.contact_name ?? null,
    contact_email: body.contact_email ?? null, contact_phone: body.contact_phone ?? null,
    address: body.address ?? null, state: body.state ?? null, region_state: body.region_state ?? null,
    notes: body.notes ?? null, created_by: caller.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await admin.from('audit_log').insert({ org_id: caller.org_id, user_id: caller.id, action: 'manufacturer.created', entity_type: 'manufacturer', entity_id: data.id, details: { manufacturer_number: mfrNumber } })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const admin = createAdminClient()
  const { data: target } = await admin.from('manufacturers').select('org_id').eq('id', body.id).single()
  if (!target || target.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })
  const updateData: Record<string, unknown> = {}
  const fields = [
    'name', 'official_business_name', 'entity_type', 'status', 'product_category',
    'contact_name', 'contact_email', 'contact_phone', 'website', 'primary_website',
    'support_email', 'address', 'city', 'state', 'zip', 'region', 'region_state',
    'is_ndaa_compliant', 'rma_contact_name', 'rma_policy', 'rma_support_phone',
    'rma_portal_link', 'warranty_policy_link', 'support_portal_login',
    'org_procurement_lead', 'preferred_manufacturer', 'api_integration_available',
    'price_list_uploaded', 'lead_time_avg_days', 'standard_shipping_method',
    'shipping_account_number', 'last_price_update_date', 'payment_terms',
    'credit_limit', 'discount_tier', 'partner_level', 'partner_discount_pct',
    'tin_ein', 'accepted_payment_methods', 'late_fee_policy', 'invoicing_contact',
    'e_verified', 'w9_received', 'doc_signed_contract', 'doc_licenses',
    'onboarding_status', 'onboarding_health_score', 'overall_score', 'onboarded_by',
    'disciplines', 'service_states', 'last_audit_date', 'audit_note', 'notes',
  ]
  for (const f of fields) { if (body[f] !== undefined) updateData[f] = body[f] }
  const { data, error } = await admin.from('manufacturers').update(updateData).eq('id', body.id).select().single()
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
  const { data: target } = await admin.from('manufacturers').select('org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })
  const { error } = await admin.from('manufacturers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await admin.from('audit_log').insert({ org_id: caller.org_id, user_id: caller.id, action: 'manufacturer.deleted', entity_type: 'manufacturer', entity_id: id, details: {} })
  return NextResponse.json({ success: true })
}
