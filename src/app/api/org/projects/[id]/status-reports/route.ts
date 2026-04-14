import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('status_reports')
    .select('*, author:users!status_reports_created_by_fkey(id, first_name, last_name)')
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .order('report_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Auto-pull snapshot data
  const [raidRes, installRes, milestoneRes, coRes] = await Promise.all([
    admin.from('raid_items').select('id, type, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
    admin.from('install_items').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
    admin.from('project_milestones').select('id, title, completed_at').eq('project_id', projectId).eq('org_id', dbUser.org_id),
    admin.from('change_orders').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
  ])

  const raids = raidRes.data ?? []
  const items = installRes.data ?? []
  const milestones = milestoneRes.data ?? []
  const cos = coRes.data ?? []

  const snapshot = {
    open_risks: raids.filter(r => r.type === 'RISK' && !['resolved', 'closed'].includes(r.status)).length,
    open_issues: raids.filter(r => r.type === 'ISSUE' && !['resolved', 'closed'].includes(r.status)).length,
    open_actions: raids.filter(r => r.type === 'ACTION' && !['resolved', 'closed'].includes(r.status)).length,
    total_install_items: items.length,
    installed_count: items.filter(i => i.status === 'installed').length,
    deviation_count: items.filter(i => i.status === 'deviation').length,
    install_progress_pct: items.length > 0
      ? Math.round((items.filter(i => i.status === 'installed' || i.status === 'deviation').length / items.length) * 100)
      : 0,
    milestones_total: milestones.length,
    milestones_completed: milestones.filter(m => m.completed_at).length,
    open_change_orders: cos.filter(c => c.status !== 'closed').length,
  }

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    created_by: dbUser.id,
    snapshot,
  }

  const allowed = ['report_date', 'overall_status', 'summary', 'accomplishments', 'next_steps', 'blockers']
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('status_reports')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
