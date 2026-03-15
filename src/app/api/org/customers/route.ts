import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const CRM_ALLOWED_ROLES = [
  'GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER',
  'MANAGER', 'OPERATIONS', 'SALES_ISR', 'SALES_OSR',
  'PRESALES', 'PROJECT_MANAGER', 'TECH_SUP',
]

async function verifyOrgCRM() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('id, role, org_id, is_global_admin')
    .eq('auth_id', user.id)
    .single()
  if (!dbUser || !dbUser.org_id) return null
  if (!CRM_ALLOWED_ROLES.includes(dbUser.role)) return null
  return dbUser
}

async function nextCustomerNumber(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const { count } = await admin
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
  const next = (count ?? 0) + 1
  return `CU-${String(next).padStart(6, '0')}`
}

export async function GET() {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
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
  const customerNumber = await nextCustomerNumber(admin, caller.org_id)

  const { data, error } = await admin.from('customers').insert({
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
  }).select().single()

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
    'name', 'official_business_name', 'customer_type', 'tier', 'status',
    'contact_name', 'contact_email', 'contact_phone', 'address', 'state',
    'telephone', 'primary_website', 'territory', 'region', 'region_state',
    'payment_address', 'payment_city', 'payment_state', 'payment_zip',
    'setup_required', 'setup_complete', 'onboarding_status',
    'referral_source', 'pain_points', 'success_metric_goal',
    'contract_start_date', 'contract_renewal_date', 'current_tech_stack',
    'w9_received', 'doc_signed_contract', 'doc_licenses',
    'tin_ein', 'payment_terms', 'accepted_payment_methods',
    'late_fee_policy', 'invoicing_contact', 'site_access_notes',
    'tax_exempt', 'emergency_contact', 'service_states', 'notes',
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
