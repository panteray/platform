import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// 17-state transition map
const STATUS_TRANSITIONS: Record<string, string[]> = {
  rfp_sent: ['quoted'],
  quoted: ['quote_review'],
  quote_review: ['quote_accepted', 'rfp_sent'], // can re-bid
  quote_accepted: ['po_issued'],
  po_issued: ['po_acknowledged'],
  po_acknowledged: ['mobilizing'],
  mobilizing: ['on_site'],
  on_site: ['in_progress', 'blocked'],
  in_progress: ['blocked', 'daily_report_pending', 'qc_pending'],
  blocked: ['in_progress'],
  daily_report_pending: ['in_progress', 'qc_pending'],
  qc_pending: ['punch_list', 'punch_complete'],
  punch_list: ['punch_complete'],
  punch_complete: ['invoice_pending'],
  invoice_pending: ['invoice_received'],
  invoice_received: ['subcontractor_complete'],
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('sub_assignments')
    .select('*, sub:subcontractors(id, name, primary_contact_name, primary_contact_email), pm:users!sub_assignments_pm_assignee_id_fkey(id, first_name, last_name)')
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.sub_id) return NextResponse.json({ error: 'sub_id required' }, { status: 400 })

  const admin = createAdminClient()

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    sub_id: body.sub_id,
    created_by: dbUser.id,
    rfp_sent_at: new Date().toISOString(),
  }

  const allowed = [
    'status', 'scope', 'deliverables', 'po_number', 'po_amount',
    'start_date', 'target_end_date', 'opp_sub_quote_id', 'pm_assignee_id', 'notes',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('sub_assignments')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const assignmentId = req.nextUrl.searchParams.get('assignment_id')
  if (!assignmentId) return NextResponse.json({ error: 'assignment_id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Validate status transition
  if (body.status) {
    const { data: current } = await admin
      .from('sub_assignments')
      .select('status')
      .eq('id', assignmentId)
      .eq('project_id', projectId)
      .eq('org_id', dbUser.org_id)
      .single()

    if (!current) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

    const allowed = STATUS_TRANSITIONS[current.status] ?? []
    if (!allowed.includes(body.status as string)) {
      return NextResponse.json({
        error: `Cannot transition from ${current.status} to ${body.status}. Allowed: ${allowed.join(', ') || 'terminal state'}`,
      }, { status: 400 })
    }

    // Auto-set timestamps
    const now = new Date().toISOString()
    switch (body.status) {
      case 'quoted': body.quoted_at = now; break
      case 'po_issued': body.po_issued_at = now; break
      case 'mobilizing': body.mobilized_at = now; break
      case 'subcontractor_complete':
        body.completed_at = now
        body.actual_end_date = body.actual_end_date ?? new Date().toISOString().split('T')[0]
        break
    }
  }

  const updateAllowed = [
    'status', 'scope', 'deliverables', 'po_number', 'po_amount',
    'invoiced_amount', 'paid_amount', 'start_date', 'target_end_date',
    'actual_end_date', 'pm_assignee_id', 'notes', 'blockers',
    'rfp_sent_at', 'quoted_at', 'po_issued_at', 'mobilized_at', 'completed_at',
  ]

  const update: Record<string, unknown> = {}
  for (const key of updateAllowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  const { data, error } = await admin
    .from('sub_assignments')
    .update(update)
    .eq('id', assignmentId)
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
