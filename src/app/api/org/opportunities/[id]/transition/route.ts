import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { OppStatus, OPP_STATUS_ORDER, OPP_STATUS_TRANSITIONS } from '@/types/enums'

const MANAGER_ROLES = ['GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER', 'MANAGER']

/**
 * Approval gate definitions: which transitions require manager approval.
 * Key = target status, value = gate_type for the opp_approvals table.
 */
const APPROVAL_GATES: Partial<Record<OppStatus, string>> = {
  [OppStatus.SUBMITTED_FOR_QUOTE]: 'QUOTE_REVIEW',
  [OppStatus.SUBMITTED_TO_CUSTOMER]: 'SOW_REVIEW',
  [OppStatus.PROJECT]: 'PROJECT_KICKOFF',
  [OppStatus.SIGN_OFF]: 'SIGN_OFF',
}

/**
 * Required field validation: which fields must be set before advancing.
 * Returns error message or null if valid.
 */
function validateTransition(
  opp: Record<string, unknown>,
  target: OppStatus
): string | null {
  switch (target) {
    case OppStatus.ASSIGNED_TO_PRESALES:
      if (!opp.assigned_presales_id) return 'Presales engineer must be assigned before moving to ASSIGNED_TO_PRESALES'
      break
    case OppStatus.SURVEY:
      if (!opp.assigned_presales_id) return 'Presales engineer must be assigned before moving to SURVEY'
      if (!opp.customer_id) return 'Customer must be selected before moving to SURVEY'
      break
    case OppStatus.DESIGN:
      if (!opp.assigned_presales_id) return 'Presales engineer must be assigned before moving to DESIGN'
      break
    case OppStatus.SUBMITTED_FOR_QUOTE:
      if (!opp.customer_id) return 'Customer must be selected before submitting for quote'
      break
    case OppStatus.SUBMITTED_TO_CUSTOMER:
      if (!opp.quote_amount && !opp.order_amount) return 'Quote amount or order amount must be set before submitting to customer'
      break
    case OppStatus.PROJECT:
      if (!opp.po_number && !opp.po_received_at) return 'PO number or PO received date required before starting project'
      if (!opp.assigned_pm_id) return 'Project Manager must be assigned before starting project'
      break
    case OppStatus.INSTALL:
      if (!opp.assigned_pm_id) return 'Project Manager must be assigned before moving to install'
      break
    case OppStatus.COMPLETE:
      // No additional requirements — closeout flow handles this
      break
  }
  return null
}

async function verifyCaller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: dbUser } = await admin.from('users').select('id, role, org_id, is_global_admin').eq('auth_id', user.id).single()
  if (!dbUser || !dbUser.org_id) return null
  return dbUser
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const newStatus = body.new_status as OppStatus
  const skipApproval = body.skip_approval === true // managers can bypass
  if (!newStatus || !OPP_STATUS_ORDER.includes(newStatus)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  if (newStatus === 'ON_HOLD' && !body.on_hold_reason?.trim()) {
    return NextResponse.json({ error: 'on_hold_reason is required for ON_HOLD' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: opp, error: fetchErr } = await admin
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  if (opp.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  const previousStatus = opp.status as OppStatus

  // Validate transition is allowed by state machine
  const allowed = OPP_STATUS_TRANSITIONS[previousStatus] ?? []
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${previousStatus} to ${newStatus}` },
      { status: 400 }
    )
  }

  // Required-field validation
  const validationError = validateTransition(opp, newStatus)
  if (validationError) {
    return NextResponse.json({ error: validationError, validation: true }, { status: 422 })
  }

  // Approval gate check (managers can skip)
  const gateType = APPROVAL_GATES[newStatus]
  if (gateType && !MANAGER_ROLES.includes(caller.role) && !skipApproval) {
    // Check if there's an approved gate for this transition
    const { data: approval } = await admin
      .from('opp_approvals')
      .select('id, status')
      .eq('opp_id', id)
      .eq('gate_type', gateType)
      .eq('status', 'APPROVED')
      .order('reviewed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!approval) {
      return NextResponse.json(
        {
          error: `This transition requires manager approval (${gateType.replace(/_/g, ' ')})`,
          requires_approval: true,
          gate_type: gateType,
          target_status: newStatus,
        },
        { status: 403 }
      )
    }
  }

  const updateFields: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'ON_HOLD') updateFields.on_hold_reason = body.on_hold_reason?.trim() || null
  if (body.decline_reason?.trim()) updateFields.decline_reason = body.decline_reason.trim()

  const { error: updateErr } = await admin.from('opportunities').update(updateFields).eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  await admin.from('opp_status_history').insert({
    opp_id: id, org_id: caller.org_id, previous_status: previousStatus, new_status: newStatus,
    changed_by: caller.id, on_hold_reason: newStatus === 'ON_HOLD' ? (body.on_hold_reason?.trim() || null) : null,
    decline_reason: body.decline_reason?.trim() || null,
  })

  return NextResponse.json({ status: newStatus, previous_status: previousStatus })
}
