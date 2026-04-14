import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.description) return NextResponse.json({ error: 'description required' }, { status: 400 })

  const qty = Number(body.quantity ?? 1)
  const rate = Number(body.unit_rate ?? 0)
  const monthly = qty * rate

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contract_line_items')
    .insert({
      contract_id: id,
      org_id: dbUser.org_id,
      description: body.description,
      asset_id: body.asset_id ?? null,
      quantity: qty,
      unit_rate: rate,
      monthly_amount: +monthly.toFixed(2),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
    .from('contract_line_items')
    .delete()
    .eq('id', lineId)
    .eq('contract_id', id)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
