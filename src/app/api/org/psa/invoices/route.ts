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
  const overdueOnly = req.nextUrl.searchParams.get('overdue') === '1'

  const admin = createAdminClient()
  let query = admin
    .from('invoices')
    .select('*, customer:customers(id, name)')
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (customerId) query = query.eq('customer_id', customerId)
  if (overdueOnly) {
    const today = new Date().toISOString().slice(0, 10)
    query = query.lt('due_date', today).not('status', 'in', '(PAID,VOID,WRITTEN_OFF)')
  }

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

  if (!body.customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const termsDays = (body.payment_terms_days as number | undefined) ?? 30
  const issued = (body.issued_at as string | undefined) ?? new Date().toISOString().slice(0, 10)
  const due = (body.due_date as string | undefined) ?? new Date(Date.now() + termsDays * 86400000).toISOString().slice(0, 10)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('invoices')
    .insert({
      org_id: dbUser.org_id,
      customer_id: body.customer_id,
      source: body.source ?? 'MANUAL',
      source_ticket_id: body.source_ticket_id ?? null,
      source_project_id: body.source_project_id ?? null,
      source_contract_id: body.source_contract_id ?? null,
      issued_at: issued,
      due_date: due,
      payment_terms_days: termsDays,
      subtotal: body.subtotal ?? 0,
      tax_rate: body.tax_rate ?? 0,
      tax_amount: body.tax_amount ?? 0,
      notes: body.notes ?? null,
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
