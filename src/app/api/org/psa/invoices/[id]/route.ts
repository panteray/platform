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
  const { data: invoice, error } = await admin
    .from('invoices')
    .select('*, customer:customers(id, name)')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const [linesRes, paymentsRes, remindersRes] = await Promise.all([
    admin.from('invoice_line_items').select('*').eq('invoice_id', id).eq('org_id', dbUser.org_id).order('created_at'),
    admin.from('invoice_payments').select('*').eq('invoice_id', id).eq('org_id', dbUser.org_id).order('paid_at', { ascending: false }),
    admin.from('invoice_reminders').select('*').eq('invoice_id', id).eq('org_id', dbUser.org_id).order('sent_at'),
  ])

  return NextResponse.json({
    ...invoice,
    line_items: linesRes.data ?? [],
    payments: paymentsRes.data ?? [],
    reminders: remindersRes.data ?? [],
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
    'customer_id', 'issued_at', 'due_date', 'payment_terms_days',
    'subtotal', 'tax_rate', 'tax_amount', 'late_fee_amount', 'notes', 'status',
  ]
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('invoices')
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
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  const admin = createAdminClient()
  // Only allow deletion of DRAFT invoices
  const { data: existing } = await admin
    .from('invoices')
    .select('status')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only DRAFT invoices can be deleted' }, { status: 400 })
  }

  const { error } = await admin.from('invoices').delete().eq('id', id).eq('org_id', dbUser.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
