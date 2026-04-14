import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: contract, error } = await admin
    .from('service_contracts')
    .select('*, customer:customers(id, name)')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const [linesRes, eventsRes, invoicesRes] = await Promise.all([
    admin.from('contract_line_items').select('*').eq('contract_id', id).eq('org_id', dbUser.org_id).order('created_at'),
    admin.from('contract_events').select('*').eq('contract_id', id).eq('org_id', dbUser.org_id).order('created_at', { ascending: false }),
    admin.from('invoices').select('id, invoice_number, status, total, issued_at').eq('source_contract_id', id).eq('org_id', dbUser.org_id).order('issued_at', { ascending: false }),
  ])

  return NextResponse.json({
    ...contract,
    line_items: linesRes.data ?? [],
    events: eventsRes.data ?? [],
    invoices: invoicesRes.data ?? [],
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = [
    'name', 'status', 'billing_model', 'billing_cycle', 'start_date', 'end_date',
    'auto_renew', 'renewal_notice_days', 'annual_escalation_pct', 'next_bill_date',
    'block_hours_total', 'block_rollover_type', 'block_rollover_cap', 'overage_rate', 'notes',
  ]
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]

  const admin = createAdminClient()

  // Log status changes
  if (body.status) {
    const { data: cur } = await admin
      .from('service_contracts')
      .select('status')
      .eq('id', id)
      .eq('org_id', dbUser.org_id)
      .single()

    if (cur && cur.status !== body.status) {
      const eventTypeMap: Record<string, string> = {
        ACTIVE: 'ACTIVATED',
        CANCELLED: 'CANCELLED',
        PAUSED: 'PAUSED',
        RENEWED: 'RENEWED',
      }
      const evtType = eventTypeMap[body.status as string]
      if (evtType) {
        await admin.from('contract_events').insert({
          contract_id: id,
          org_id: dbUser.org_id,
          event_type: evtType,
          details: { from: cur.status, to: body.status },
          created_by: dbUser.id,
        })
      }
    }
  }

  const { data, error } = await admin
    .from('service_contracts')
    .update(update)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.ORG_ADMIN))
    return NextResponse.json({ error: 'Org Admin role required' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('service_contracts').delete().eq('id', id).eq('org_id', dbUser.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
