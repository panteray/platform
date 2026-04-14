import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

async function recalcSubtotal(admin: ReturnType<typeof createAdminClient>, invoiceId: string, orgId: string) {
  const { data: lines } = await admin
    .from('invoice_line_items')
    .select('line_total')
    .eq('invoice_id', invoiceId)
    .eq('org_id', orgId)
  const subtotal = (lines ?? []).reduce((s, l) => s + Number(l.line_total ?? 0), 0)
  const { data: inv } = await admin
    .from('invoices')
    .select('tax_rate')
    .eq('id', invoiceId)
    .single()
  const taxRate = Number(inv?.tax_rate ?? 0)
  const tax = +(subtotal * taxRate).toFixed(2)
  await admin
    .from('invoices')
    .update({ subtotal, tax_amount: tax, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('org_id', orgId)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('invoice_line_items')
    .insert({
      invoice_id: id,
      org_id: dbUser.org_id,
      description: body.description,
      quantity: body.quantity ?? 1,
      unit_price: body.unit_price ?? 0,
      source_type: body.source_type ?? 'OTHER',
      source_ref_id: body.source_ref_id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await recalcSubtotal(admin, id, dbUser.org_id)

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  const lineId = req.nextUrl.searchParams.get('line_id')
  if (!lineId) return NextResponse.json({ error: 'line_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('invoice_line_items')
    .delete()
    .eq('id', lineId)
    .eq('invoice_id', id)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await recalcSubtotal(admin, id, dbUser.org_id)

  return NextResponse.json({ ok: true })
}
