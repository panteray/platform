import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('projects')
    .select(`
      *,
      pm:users!projects_pm_id_fkey(id, first_name, last_name, email),
      customer:customers!projects_customer_id_fkey(id, name, contact_name, contact_email),
      opportunity:opportunities!projects_opp_id_fkey(id, opp_number, project_name, status),
      project_team(id, user_id, role, users(id, first_name, last_name, email)),
      project_milestones(id, title, target_date, completed_at, sort_order),
      project_tasks(count),
      install_items(count),
      daily_reports(count)
    `)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Verify project belongs to org
  const { data: existing } = await admin
    .from('projects')
    .select('id')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const allowed = [
    'name', 'pm_id', 'status', 'risk_score', 'risk_level', 'contingency_pct',
    'site_address', 'site_city', 'site_state', 'site_zip', 'site_notes',
    'start_date', 'target_end_date', 'actual_end_date', 'budget_amount', 'customer_id',
    // Identity / routing
    'pm_comments', 'project_type', 'vertical', 'date_submitted',
    'order_number', 'order_date', 'customer_number', 'campus_building_room', 'install_address',
    // Status
    'ship_status', 'operation_status', 'signoff_status', 'closeout_status',
    // Dates / aging
    'approx_install_date', 'tentative_date', 'confirmed_scheduled_date',
    'est_completion_date', 'actual_equip_delivery_date', 'equip_paid_date',
    // RMA / invoicing
    'rma_processing_date', 'rma_number', 'invoice_received_date', 'invoice_number',
    'invoice_processed_date', 'sos_sent_date', 'sos_received_date', 'quote_received', 'po_sent',
    // Personnel
    'resource_coordinator_id', 'resource_coordinator_text',
    'technical_supervisor_id', 'technical_supervisor_text',
    'lead_tech_id', 'lead_tech_text', 'technicians_text',
    'outside_pm_id', 'outside_pm_text',
    'pm_mentor_id', 'pm_mentor_text',
    'service_coordinator_id', 'service_coordinator_text',
    'inside_sales_id', 'inside_sales_text',
    'outside_sales_id', 'outside_sales_text',
    'subcontractor_labor_id', 'subcontractor_labor_text',
    'subcontractor_programming_id', 'subcontractor_programming_text',
    // POC
    'poc_name', 'poc_phone', 'poc_email',
    // Program / contract
    'erate', 'program_requirements', 'warranty_90_day', 'contract_type',
    'multiple_install_lines', 'multiple_program_lines',
    // SSC
    'ssc_term_date', 'ssc_renewal_number',
    'ssc_block_hours_approved', 'ssc_block_hours_used', 'ssc_block_hours_remaining',
    'ssc_active', 'ssc_status', 'ssc_duration', 'ssc_forced', 'ssc_charged',
    'ssc_to_finance_invoice', 'satisfaction_survey_sent',
    // Financials
    'order_amount', 'equipment_cost', 'labor_customer_cost', 'labor_cost_only',
    'misc_bom', 'misc_labor', 'lift_rental',
    'programming_customer_cost', 'programming_material_cost',
    'ssc_customer_cost', 'ssc_material_cost',
    'contingency_amount', 'sub_quote_amount', 'sub_cost_parts_labor',
    'hts_technician_cost', 'job_materials_cost', 'misc_job_costs',
    'shipping_cost', 'project_balance',
    // Shipping
    'shipping_company',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('projects')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Only allow deleting planning-status projects
  const { data: existing } = await admin
    .from('projects')
    .select('id, status')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (existing.status !== 'planning') {
    return NextResponse.json({ error: 'Only planning-status projects can be deleted' }, { status: 400 })
  }

  const { error } = await admin.from('projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
