import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
async function nextSubNumber(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const { data } = await admin
    .from('subcontractors')
    .select('sub_number')
    .eq('org_id', orgId)
    .order('sub_number', { ascending: false })
    .limit(1)
  const last = data?.[0]?.sub_number
  const num = last ? parseInt(last.replace('SC-', ''), 10) + 1 : 1
  return `SC-${String(num).padStart(6, '0')}`
}

export async function GET() {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('subcontractors')
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
  let data, error, subNumber;
  // Retry up to 5 times if unique constraint fails
  while (attempt < 5) {
    subNumber = await nextSubNumber(admin, caller.org_id)
    ({ data, error } = await admin.from('subcontractors').insert({
      org_id: caller.org_id,
      sub_number: subNumber,
      name: body.name,
      official_business_name: body.official_business_name ?? null,
      type: body.type ?? null,
      contact_name: body.contact_name ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
      address: body.address ?? null,
      state: body.state ?? null,
      region_state: body.region_state ?? null,
      notes: body.notes ?? null,
      created_by: caller.id,
    }).select().single())
    if (!error || !error.message.includes('unique_sub_number')) break;
    attempt++;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'subcontractor.created',
    entity_type: 'subcontractor',
    entity_id: data.id,
    details: { sub_number: subNumber },
  })

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  const { data: target } = await admin.from('subcontractors').select('org_id').eq('id', body.id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Subcontractor not in your organization' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  const fields = [
    'name', 'official_business_name', 'entity_type', 'type', 'status',
    'contact_name', 'contact_email', 'contact_phone', 'po_email',
    'address', 'state', 'territory', 'region', 'region_state', 'org_contact',
    'license_number', 'setup_required', 'setup_complete',
    'onboarding_status', 'onboarding_health_score', 'overall_score', 'onboarded_by',
    'e_verified', 'w9_received', 'insurance_certs', 'sub_agreement_signed',
    'doc_signed_contract', 'doc_licenses', 'coi_expiration_date',
    'workers_comp_expiry', 'general_liability_expiry', 'background_check_status',
    'safety_rating_emr', 'approval_av_manager', 'approval_net_manager',
    'approval_sec_manager', 'experience_skills_certs', 'certified_brands',
    'government_labor_provider', 'gov_labor_categories', 'gov_labor_states',
    'hourly_rate', 'day_rate', 'tin_ein', 'payment_terms',
    'accepted_payment_methods', 'late_fee_policy', 'invoicing_contact',
    'payment_address', 'payment_city', 'payment_state', 'payment_zip',
    'preferred_toolset', 'is_preferred', 'is_active',
    'timeliness_score', 'qc_pass_rate', 'rework_count',
    'report_cadence_score', 'daily_task_completion', 'revisit_count',
    'service_states', 'last_audit_date', 'audit_note', 'notes',
  ]
  for (const f of fields) {
    if (body[f] !== undefined) updateData[f] = body[f]
  }

  const { data, error } = await admin.from('subcontractors')
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
  const { data: target } = await admin.from('subcontractors').select('org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Subcontractor not in your organization' }, { status: 403 })
  }

  const { error } = await admin.from('subcontractors').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'subcontractor.deleted',
    entity_type: 'subcontractor',
    entity_id: id,
    details: {},
  })

  return NextResponse.json({ success: true })
}
