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

  let body: { hours?: number; ticket_id?: string; notes?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (typeof body.hours !== 'number' || body.hours <= 0) {
    return NextResponse.json({ error: 'hours must be a positive number' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: contract, error } = await admin
    .from('service_contracts')
    .select('billing_model, block_hours_total, block_hours_used, status')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error || !contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  if (contract.billing_model !== 'BLOCK_TIME') {
    return NextResponse.json({ error: 'Contract is not a BLOCK_TIME contract' }, { status: 400 })
  }
  if (contract.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Contract is not ACTIVE' }, { status: 400 })
  }

  const used = Number(contract.block_hours_used ?? 0) + body.hours

  await admin
    .from('service_contracts')
    .update({ block_hours_used: used, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', dbUser.org_id)

  await admin.from('contract_events').insert({
    contract_id: id,
    org_id: dbUser.org_id,
    event_type: 'BLOCK_DEBIT',
    details: { hours: body.hours, ticket_id: body.ticket_id ?? null, notes: body.notes ?? null, hours_used_after: used },
    created_by: dbUser.id,
  })

  const total = Number(contract.block_hours_total ?? 0)
  const remaining = total - used
  return NextResponse.json({ block_hours_used: used, block_hours_total: total, remaining })
}
