import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

const PN_PM_ROLES = ['GLOBAL_ADMIN','ORG_ADMIN','ORG_MANAGER']

const GENERAL_FIELDS = [
  'opp_number','opp_type','customer_id','customer_vertical','project_name','system_name',
  'install_address','state','campus_bldg_rm','multiple_locations','multiple_location_notes',
  'territory','project_description','notes','request_type','labor_requirement',
  'quote_expected_date','assigned_isr_id','assigned_osr_id','assigned_presales_id','assigned_pm_id','subcontractor_id',
  'po_number','poc_name','poc_phone','poc_email','disciplines','project_number',
  'vertical','erate','program_requirements','risk_score','opp_grade','complexity_rating',
  'quoting_process_status','quoting_status_group','quoting_status','quoting_date_done',
  'quote_sent_date','quote_number','quote_amount','ready_for_quoting',
  'date_received','date_committed','date_due','approx_install_date','date_scheduled',
  'survey_date','survey_date_done','design_date_done','design_status',
  'order_amount','equip_cost','labor_cost_customer','labor_cost_material','labor_cost_only',
  'misc_bom','misc_labor','lift_rental','programming_cost_customer','programming_cost_material',
  'ssc_cost_customer','ssc_cost_material','contingency','sub_quote_amount',
  'sub_cost_parts_labor','hts_tech_cost','job_materials_cost','misc_job_costs',
  'shipping_cost','project_balance','internal_services_estimate',
  'three_pl','ship_status','actual_equip_delivery_date','delivery_aging','warehouse_shipping',
  'ssc_yn','ssc_status','ssc_term_date','ssc_duration','ssc_forced','ssc_charged','ssc_finance_invoice',
  'block_hours_approved','block_hours_used','warranty_90day',
  'tkt_number','service_status','field_service_status','issue','work_performed',
  'labor_hours','travel_hours','invoice_status','service_coordinator_notes',
  'sub_project_type','sub_service_call','sub_order_number','sub_labor_cost','sub_material_cost',
  'sub_approval_req','sub_pm_approval','sub_comments','sub_attn',
  'decline_reason','on_hold_reason','kill_flag','reminder_request',
  'reason_quote_not_approved','inv_processed','project_closed','satisfaction_survey_sent',
  'outcome','lost_reason','payment_agreement_signed_at','payment_terms',
  'ship_hold_cleared_at','customer_intro_sent_at',
]

const ADMIN_ONLY_FIELDS = ['pn_assigned_at','po_received_at']

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()

  const { data: opp, error } = await admin
    .from('opportunities')
    .select('*, customers(id, name, customer_type, contact_name, contact_email, contact_phone, address, state, territory, region, region_state)')
    .eq('id', id)
    .eq('org_id', caller.org_id)
    .single()

  if (error || !opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(opp)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: target } = await admin.from('opportunities').select('org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  const update: Record<string, unknown> = {}
  for (const f of GENERAL_FIELDS) { if (f in body) update[f] = body[f] }
  for (const f of ADMIN_ONLY_FIELDS) {
    if (f in body) {
      if (!PN_PM_ROLES.includes(caller.role)) return NextResponse.json({ error: `Only admins can set ${f}` }, { status: 403 })
      update[f] = body[f]
    }
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })

  const { data: opp, error } = await admin.from('opportunities').update(update).eq('id', id).select('*, customers(id, name, customer_type, contact_name, contact_email, contact_phone, address, state, territory, region, region_state)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ opportunity: opp })
}
