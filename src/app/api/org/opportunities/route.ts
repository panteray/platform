import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

const OPP_CREATE_ROLES = ['GLOBAL_ADMIN','GLOBAL_MANAGER','ORG_ADMIN','ORG_MANAGER','MANAGER','SALES_ISR','SALES_OSR']

async function nextOppNumber(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const { data } = await admin.from('opportunities').select('opp_number').eq('org_id', orgId).order('opp_number', { ascending: false }).limit(1)
  const last = data?.[0]?.opp_number
  const num = last ? parseInt(last.replace('OPP-', ''), 10) + 1 : 1
  return `OPP-${String(num).padStart(6, '0')}`
}

export async function GET() {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  const { data, error } = await admin.from('opportunities').select('*, customers(id, name, customer_type, contact_name, contact_email, contact_phone, address, state, territory, region, region_state)').eq('org_id', caller.org_id).order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller || !OPP_CREATE_ROLES.includes(caller.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const admin = createAdminClient()
  const oppNumber = body.opp_number?.trim() || await nextOppNumber(admin, caller.org_id)
  const status = body.status || 'NEW'

  const insertData: Record<string, unknown> = {
    org_id: caller.org_id, opp_number: oppNumber, status,
    opp_type: body.opp_type || null, customer_id: body.customer_id || null,
    customer_vertical: body.customer_vertical || null, project_name: body.project_name || null,
    system_name: body.system_name || null, install_address: body.install_address || null,
    state: body.state || null, campus_bldg_rm: body.campus_bldg_rm || null,
    multiple_locations: body.multiple_locations || null, multiple_location_notes: body.multiple_location_notes || null,
    territory: body.territory || null, project_description: body.project_description || null,
    notes: body.notes || null, request_type: body.request_type || null,
    labor_requirement: body.labor_requirement || null, quote_expected_date: body.quote_expected_date || null,
    assigned_isr_id: body.assigned_isr_id || null, assigned_osr_id: body.assigned_osr_id || null,
    assigned_presales_id: body.assigned_presales_id || null,
    poc_name: body.poc_name || null, poc_phone: body.poc_phone || null, poc_email: body.poc_email || null,
    disciplines: Array.isArray(body.disciplines) ? body.disciplines : [],
    created_by: caller.id,
  }

  const { data: opp, error } = await admin.from('opportunities').insert(insertData).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Initial status history entry
  const { error: histErr } = await admin.from('opp_status_history').insert({ opp_id: opp.id, org_id: caller.org_id, previous_status: null, new_status: status, changed_by: caller.id })
  if (histErr) console.error('Failed to create status history:', histErr.message)

  // Auto-create huddle thread
  const { error: huddleErr } = await admin.from('opp_huddle_threads').insert({ org_id: caller.org_id, opp_id: opp.id }).select().maybeSingle()
  if (huddleErr) console.error('Failed to create huddle thread:', huddleErr.message)

  // Auto-create opp vault for this OPP
  const { error: vaultErr } = await admin.from('opp_vault_documents').insert({
    opp_id: opp.id, org_id: caller.org_id, name: 'Opp Vault Created',
    document_type: 'system', version: 0, status: 'active',
    metadata: { auto_created: true, created_at: new Date().toISOString() },
    created_by: caller.id,
  })
  if (vaultErr) console.error('Failed to create vault:', vaultErr.message)

  const { error: auditErr } = await admin.from('audit_log').insert({ org_id: caller.org_id, user_id: caller.id, action: 'opportunity.created', entity_type: 'opportunity', entity_id: opp.id, details: { opp_number: oppNumber } })
  if (auditErr) console.error('Failed to create audit log:', auditErr.message)

  return NextResponse.json(opp, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller || !['GLOBAL_ADMIN','ORG_ADMIN','ORG_MANAGER'].includes(caller.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const admin = createAdminClient()
  const { data: target } = await admin.from('opportunities').select('org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })
  const { error } = await admin.from('opportunities').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await admin.from('audit_log').insert({ org_id: caller.org_id, user_id: caller.id, action: 'opportunity.deleted', entity_type: 'opportunity', entity_id: id, details: {} })
  return NextResponse.json({ success: true })
}
