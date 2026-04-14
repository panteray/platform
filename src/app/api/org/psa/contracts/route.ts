import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status')
  const customerId = req.nextUrl.searchParams.get('customer_id')

  const admin = createAdminClient()
  let query = admin
    .from('service_contracts')
    .select('*, customer:customers(id, name)')
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (customerId) query = query.eq('customer_id', customerId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.customer_id || !body.name || !body.billing_model || !body.start_date) {
    return NextResponse.json({ error: 'customer_id, name, billing_model, start_date required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('service_contracts')
    .insert({
      org_id: dbUser.org_id,
      customer_id: body.customer_id,
      name: body.name,
      billing_model: body.billing_model,
      billing_cycle: body.billing_cycle ?? 'MONTHLY',
      start_date: body.start_date,
      end_date: body.end_date ?? null,
      auto_renew: body.auto_renew ?? true,
      renewal_notice_days: body.renewal_notice_days ?? 30,
      annual_escalation_pct: body.annual_escalation_pct ?? 0,
      next_bill_date: body.next_bill_date ?? body.start_date,
      block_hours_total: body.block_hours_total ?? null,
      block_rollover_type: body.block_rollover_type ?? 'NONE',
      block_rollover_cap: body.block_rollover_cap ?? null,
      overage_rate: body.overage_rate ?? null,
      notes: body.notes ?? null,
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('contract_events').insert({
    contract_id: data.id,
    org_id: dbUser.org_id,
    event_type: 'CREATED',
    created_by: dbUser.id,
  })

  return NextResponse.json(data, { status: 201 })
}
