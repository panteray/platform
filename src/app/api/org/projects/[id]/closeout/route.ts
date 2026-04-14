import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  // Get SOS + gate status
  const [sosRes, installRes, coRes, qcRes] = await Promise.all([
    admin.from('sign_off_sheets').select('*').eq('project_id', projectId).eq('org_id', dbUser.org_id).order('created_at', { ascending: false }).limit(1),
    admin.from('install_items').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
    admin.from('change_orders').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id).neq('status', 'closed'),
    admin.from('qc_checklists').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
  ])

  const items = installRes.data ?? []
  const allInstalled = items.length > 0 && items.every(i => i.status === 'installed' || i.status === 'deviation')
  const openCOs = (coRes.data ?? []).length
  const qcLists = qcRes.data ?? []
  const allQcPassed = qcLists.length > 0 && qcLists.every(q => q.status === 'approved')

  return NextResponse.json({
    sos: sosRes.data?.[0] ?? null,
    gates: {
      install_complete: allInstalled,
      all_co_closed: openCOs === 0,
      qc_passed: allQcPassed,
      install_count: items.length,
      installed_count: items.filter(i => i.status === 'installed' || i.status === 'deviation').length,
      open_co_count: openCOs,
      qc_count: qcLists.length,
      qc_approved_count: qcLists.filter(q => q.status === 'approved').length,
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Verify gates
  const [installRes, coRes, qcRes] = await Promise.all([
    admin.from('install_items').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
    admin.from('change_orders').select('id').eq('project_id', projectId).eq('org_id', dbUser.org_id).neq('status', 'closed'),
    admin.from('qc_checklists').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
  ])

  const items = installRes.data ?? []
  const allInstalled = items.length > 0 && items.every(i => i.status === 'installed' || i.status === 'deviation')
  const openCOs = (coRes.data ?? []).length
  const qcLists = qcRes.data ?? []
  const allQcPassed = qcLists.length === 0 || qcLists.every(q => q.status === 'approved')

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    created_by: dbUser.id,
    gate_install_complete: allInstalled,
    gate_co_closed: openCOs === 0,
    gate_qc_passed: allQcPassed,
  }

  const allowed = [
    'scope_summary', 'customer_name', 'customer_title', 'customer_sig_data',
    'customer_signed_at', 'sub_name', 'sub_sig_data', 'sub_signed_at',
    'pm_name', 'pm_sig_data', 'pm_signed_at', 'status', 'notes', 'photos',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('sign_off_sheets')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
