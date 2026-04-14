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
