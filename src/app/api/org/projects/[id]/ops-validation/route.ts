import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
import { OppStatus } from '@/types/enums'

type AdminClient = ReturnType<typeof createAdminClient>

const CHECKS = ['sos_uploaded', 'sub_po', 'sub_invoice', 'customer_po', 'clean_sos'] as const
type Check = (typeof CHECKS)[number]
const NA_CAPABLE: Check[] = ['sub_po', 'sub_invoice']

const CHECK_COLUMNS: Record<Check, { at: string; by: string }> = {
  sos_uploaded: { at: 'sos_uploaded_at', by: 'sos_uploaded_by' },
  sub_po: { at: 'sub_po_confirmed_at', by: 'sub_po_confirmed_by' },
  sub_invoice: { at: 'sub_invoice_confirmed_at', by: 'sub_invoice_confirmed_by' },
  customer_po: { at: 'customer_po_confirmed_at', by: 'customer_po_confirmed_by' },
  clean_sos: { at: 'clean_sos_confirmed_at', by: 'clean_sos_confirmed_by' },
}

async function getOrCreateRow(admin: AdminClient, orgId: string, projectId: string) {
  const { data: existing } = await admin
    .from('operational_validations')
    .select('*')
    .eq('project_id', projectId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (existing) return existing
  const { data: created, error } = await admin
    .from('operational_validations')
    .insert({ org_id: orgId, project_id: projectId })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return created
}

function allChecksPass(row: Record<string, unknown>): boolean {
  return Boolean(
    row.sos_uploaded_at &&
    (row.sub_po_confirmed_at || row.sub_po_na) &&
    (row.sub_invoice_confirmed_at || row.sub_invoice_na) &&
    row.customer_po_confirmed_at &&
    row.clean_sos_confirmed_at
  )
}

async function transitionOpp(admin: AdminClient, orgId: string, oppId: string, from: OppStatus, to: OppStatus, userId: string) {
  const { data: opp } = await admin.from('opportunities').select('status').eq('id', oppId).single()
  if (opp?.status !== from) return
  await admin.from('opportunities').update({ status: to }).eq('id', oppId)
  await admin.from('opp_status_history').insert({
    opp_id: oppId, org_id: orgId, previous_status: from, new_status: to, changed_by: userId,
  })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: project, error: pErr } = await admin
    .from('projects')
    .select('id, org_id, opp_id, status')
    .eq('id', projectId)
    .single()
  if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  let row
  try {
    row = await getOrCreateRow(admin, caller.org_id, projectId)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }

  // Live context for the Ops reviewer
  const [sosRes, subsRes, invoicesRes, oppRes] = await Promise.all([
    admin.from('sign_off_sheets').select('id, status, customer_signed_at, pm_signed_at, gate_install_complete, gate_co_closed, gate_qc_passed').eq('project_id', projectId).eq('org_id', caller.org_id).order('created_at', { ascending: false }).limit(1),
    admin.from('sub_assignments').select('id, status, po_number, po_amount, invoiced_amount, paid_amount').eq('project_id', projectId).eq('org_id', caller.org_id),
    admin.from('invoices').select('id, invoice_number, status, total, amount_paid, due_date, paid_at').eq('source_project_id', projectId).eq('org_id', caller.org_id),
    project.opp_id
      ? admin.from('opportunities').select('id, status, po_number, outcome').eq('id', project.opp_id).single()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    validation: row,
    project_status: project.status,
    context: {
      sos: sosRes.data?.[0] ?? null,
      sub_assignments: subsRes.data ?? [],
      invoices: invoicesRes.data ?? [],
      opp: oppRes.data ?? null,
    },
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { check?: string; na?: boolean; action?: string; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: project, error: pErr } = await admin
    .from('projects')
    .select('id, org_id, opp_id, status')
    .eq('id', projectId)
    .single()
  if (pErr || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (project.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  let row
  try {
    row = await getOrCreateRow(admin, caller.org_id, projectId)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  const now = new Date().toISOString()

  if (body.check) {
    const check = body.check as Check
    if (!CHECKS.includes(check)) {
      return NextResponse.json({ error: `check must be one of: ${CHECKS.join(', ')}` }, { status: 400 })
    }
    if (body.na === true) {
      if (!NA_CAPABLE.includes(check)) {
        return NextResponse.json({ error: `${check} cannot be marked N/A` }, { status: 400 })
      }
      update[`${check}_na`] = true
    } else {
      update[CHECK_COLUMNS[check].at] = now
      update[CHECK_COLUMNS[check].by] = caller.id
      if (NA_CAPABLE.includes(check)) update[`${check}_na`] = false
    }
  } else if (body.action === 'payment_received') {
    if (!row.validated_at && !allChecksPass(row)) {
      return NextResponse.json({ error: 'All validation checks must pass before recording payment' }, { status: 400 })
    }
    if (row.payment_received_at) {
      return NextResponse.json({ error: 'Payment already recorded' }, { status: 409 })
    }
    update.payment_received_at = now
    update.payment_received_by = caller.id
  } else if (body.action === 'close') {
    if (!row.payment_received_at) {
      return NextResponse.json({ error: 'Payment must be received before closing' }, { status: 400 })
    }
    if (row.closed_at) {
      return NextResponse.json({ error: 'Already closed' }, { status: 409 })
    }
    update.closed_at = now
  } else if (typeof body.notes === 'string') {
    update.notes = body.notes.trim() || null
  } else {
    return NextResponse.json({ error: 'Provide check, action, or notes' }, { status: 400 })
  }

  const { data: updated, error: uErr } = await admin
    .from('operational_validations')
    .update(update)
    .eq('id', row.id)
    .select('*')
    .single()
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 })

  // Post-update side effects
  let finalRow = updated

  // All 5 checks now pass and not yet validated -> stamp + opp COMPLETE
  if (body.check && !updated.validated_at && allChecksPass(updated)) {
    const { data: stamped } = await admin
      .from('operational_validations')
      .update({ validated_at: now })
      .eq('id', row.id)
      .select('*')
      .single()
    if (stamped) finalRow = stamped
    if (project.opp_id) {
      await transitionOpp(admin, caller.org_id, project.opp_id, OppStatus.OPERATIONAL_VALIDATION, OppStatus.COMPLETE, caller.id)
    }
  }

  // Payment received -> project operational_closure + opp OPERATIONAL_CLOSURE
  if (body.action === 'payment_received') {
    await admin.from('projects').update({ status: 'operational_closure' }).eq('id', projectId)
    if (project.opp_id) {
      await transitionOpp(admin, caller.org_id, project.opp_id, OppStatus.COMPLETE, OppStatus.OPERATIONAL_CLOSURE, caller.id)
    }
  }

  // Close -> opp CLOSED
  if (body.action === 'close' && project.opp_id) {
    await transitionOpp(admin, caller.org_id, project.opp_id, OppStatus.OPERATIONAL_CLOSURE, OppStatus.CLOSED, caller.id)
  }

  return NextResponse.json(finalRow)
}
