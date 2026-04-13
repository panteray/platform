import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const APPROVER_ROLES = ['GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER', 'MANAGER']

async function verifyCaller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('id, role, org_id')
    .eq('auth_id', user.id)
    .single()
  if (!dbUser?.org_id) return null
  return dbUser
}

/**
 * GET /api/org/opportunities/[id]/approval
 * List approval requests for an opportunity.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const caller = await verifyCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify opp belongs to org
  const { data: opp } = await admin
    .from('opportunities')
    .select('id')
    .eq('id', id)
    .eq('org_id', caller.org_id)
    .single()
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: approvals, error } = await admin
    .from('opp_approvals')
    .select('*')
    .eq('opp_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve user names
  const userIds = new Set<string>()
  for (const a of approvals ?? []) {
    if (a.requested_by) userIds.add(a.requested_by)
    if (a.approved_by) userIds.add(a.approved_by)
  }
  const userMap = new Map<string, string>()
  if (userIds.size > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, first_name, last_name')
      .in('id', [...userIds])
    for (const u of users ?? []) {
      userMap.set(u.id, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unknown')
    }
  }

  const enriched = (approvals ?? []).map((a) => ({
    ...a,
    requested_by_name: a.requested_by ? userMap.get(a.requested_by) ?? 'Unknown' : null,
    approved_by_name: a.approved_by ? userMap.get(a.approved_by) ?? 'Unknown' : null,
  }))

  return NextResponse.json(enriched)
}

/**
 * POST /api/org/opportunities/[id]/approval
 * Request an approval gate.
 * Body: { gate_type, target_status, request_notes? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const caller = await verifyCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { gate_type, target_status, request_notes } = body

  if (!gate_type) return NextResponse.json({ error: 'gate_type is required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify opp belongs to org
  const { data: opp } = await admin
    .from('opportunities')
    .select('id, org_id')
    .eq('id', id)
    .eq('org_id', caller.org_id)
    .single()
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check for existing pending approval of same type
  const { data: existing } = await admin
    .from('opp_approvals')
    .select('id')
    .eq('opp_id', id)
    .eq('gate_type', gate_type)
    .eq('status', 'PENDING')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A pending approval of this type already exists' },
      { status: 409 }
    )
  }

  const { data: approval, error } = await admin
    .from('opp_approvals')
    .insert({
      org_id: caller.org_id,
      opp_id: id,
      gate_type,
      target_status: target_status ?? null,
      requested_by: caller.id,
      request_notes: request_notes?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'opp_approval.requested',
    entity_type: 'opportunity',
    entity_id: id,
    details: { gate_type, target_status, approval_id: approval.id },
  })

  return NextResponse.json(approval, { status: 201 })
}

/**
 * PATCH /api/org/opportunities/[id]/approval
 * Approve or reject a pending approval.
 * Body: { approval_id, action: 'APPROVED' | 'REJECTED', review_notes? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const caller = await verifyCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only approver roles can approve/reject
  if (!APPROVER_ROLES.includes(caller.role)) {
    return NextResponse.json({ error: 'Only managers can approve/reject' }, { status: 403 })
  }

  const body = await req.json()
  const { approval_id, action, review_notes } = body

  if (!approval_id || !['APPROVED', 'REJECTED'].includes(action)) {
    return NextResponse.json({ error: 'approval_id and action (APPROVED|REJECTED) required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify approval belongs to this opp and org
  const { data: approval } = await admin
    .from('opp_approvals')
    .select('id, opp_id, org_id, status, gate_type, target_status')
    .eq('id', approval_id)
    .eq('opp_id', id)
    .single()

  if (!approval || approval.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
  }

  if (approval.status !== 'PENDING') {
    return NextResponse.json({ error: 'Approval is no longer pending' }, { status: 409 })
  }

  const { data: updated, error } = await admin
    .from('opp_approvals')
    .update({
      status: action,
      approved_by: caller.id,
      review_notes: review_notes?.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', approval_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If approved and has target_status, auto-transition the OPP
  if (action === 'APPROVED' && approval.target_status) {
    const { data: opp } = await admin
      .from('opportunities')
      .select('status')
      .eq('id', id)
      .single()

    if (opp) {
      await admin
        .from('opportunities')
        .update({ status: approval.target_status })
        .eq('id', id)

      await admin.from('opp_status_history').insert({
        opp_id: id,
        org_id: caller.org_id,
        previous_status: opp.status,
        new_status: approval.target_status,
        changed_by: caller.id,
      })
    }
  }

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: `opp_approval.${action.toLowerCase()}`,
    entity_type: 'opportunity',
    entity_id: id,
    details: { approval_id, gate_type: approval.gate_type, review_notes },
  })

  return NextResponse.json(updated)
}
