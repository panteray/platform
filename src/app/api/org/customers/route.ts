import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
async function nextCustomerNumber(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const { data } = await admin
    .from('customers')
    .select('customer_number')
    .eq('org_id', orgId)
    .order('customer_number', { ascending: false })
    .limit(1)
  const last = data?.[0]?.customer_number
  const num = last ? parseInt(last.replace('CU-', ''), 10) + 1 : 1
  return `CU-${String(num).padStart(6, '0')}`
}

export async function GET(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  // Single record fetch
  if (id) {
    const { data, error } = await admin
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('org_id', caller.org_id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  }

  // Full list fetch
  const { data, error } = await admin
    .from('customers')
    .select('*')
    .eq('org_id', caller.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()
  let attempt = 0;
  let data, error, customerNumber;
  // Retry up to 5 times if unique constraint fails
  while (attempt < 5) {
    customerNumber = await nextCustomerNumber(admin, caller.org_id)
    ({ data, error } = await admin.from('customers').insert({
      org_id: caller.org_id,
      customer_number: customerNumber,
      name: body.name,
      official_business_name: body.official_business_name ?? null,
      customer_type: body.customer_type ?? null,
      tier: body.tier ?? null,
      contact_name: body.contact_name ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
      address: body.address ?? null,
      state: body.state ?? null,
      telephone: body.telephone ?? null,
      primary_website: body.primary_website ?? null,
      territory: body.territory ?? null,
      region: body.region ?? null,
      region_state: body.region_state ?? null,
      payment_terms: body.payment_terms ?? null,
      notes: body.notes ?? null,
      created_by: caller.id,
    }).select().single())
    if (!error || !error.message.includes('unique_customer_number')) break;
    attempt++;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Audit log
  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'customer.created',
    entity_type: 'customer',
    entity_id: data.id,
    details: { customer_number: customerNumber },
  })

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  // Verify customer is in caller's org
  const { data: target } = await admin.from('customers').select('org_id').eq('id', body.id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Customer not in your organization' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  const fields = [
    'name', 'official_business_name', 'entity_type', 'customer_type', 'tier', 'tier_priority', 'status',
    'contact_name', 'contact_email', 'contact_phone', 'address', 'state',
    'telephone', 'primary_website', 'territory', 'region', 'region_state',
    'payment_address', 'payment_city', 'payment_state', 'payment_zip',
    'setup_required', 'setup_complete', 'onboarding_status',
    'onboarding_health_score', 'overall_score', 'onboarded_by', 'target_go_live_date',
    'referral_source', 'pain_points', 'success_metric_goal',
    'contract_start_date', 'contract_renewal_date', 'current_tech_stack',
    'w9_received', 'doc_signed_contract', 'doc_licenses',
    'tin_ein', 'payment_terms', 'accepted_payment_methods',
    'late_fee_policy', 'invoicing_contact', 'site_access_notes',
    'tax_exempt', 'emergency_contact', 'service_states', 'notes',
    'mac_serial_inventory_link', 'last_audit_date', 'audit_note',
    'payment_behavior_score', 'response_time_score', 'delay_frequency_score',
    'ease_of_working_score', 'signature_timeframe_score',
  ]
  for (const f of fields) {
    if (body[f] !== undefined) updateData[f] = body[f]
  }

  const { data, error } = await admin.from('customers')
    .update(updateData)
    .eq('id', body.id)
    .select()
    .single()

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

  const { data: target } = await admin.from('customers').select('org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Customer not in your organization' }, { status: 403 })
  }

  const { error } = await admin.from('customers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'customer.deleted',
    entity_type: 'customer',
    entity_id: id,
    details: {},
  })

  return NextResponse.json({ success: true })
}
