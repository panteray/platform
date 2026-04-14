import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  const userId = req.nextUrl.searchParams.get('user_id')
  const currentOnly = req.nextUrl.searchParams.get('current') === '1'

  const admin = createAdminClient()
  let query = admin
    .from('psa_user_rates')
    .select('*, user:users(id, first_name, last_name, email)')
    .eq('org_id', dbUser.org_id)
    .order('effective_from', { ascending: false })

  if (userId) query = query.eq('user_id', userId)
  if (currentOnly) query = query.is('effective_to', null)

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

  if (!body.user_id || body.internal_cost_rate == null || body.billable_rate == null) {
    return NextResponse.json({ error: 'user_id, internal_cost_rate, billable_rate required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const effectiveFrom = (body.effective_from as string) ?? new Date().toISOString().split('T')[0]

  // Close prior current rate for this user (set effective_to = new rate's effective_from - 1 day)
  const priorEnd = new Date(effectiveFrom)
  priorEnd.setDate(priorEnd.getDate() - 1)
  await admin
    .from('psa_user_rates')
    .update({ effective_to: priorEnd.toISOString().split('T')[0] })
    .eq('user_id', body.user_id)
    .eq('org_id', dbUser.org_id)
    .is('effective_to', null)

  const { data, error } = await admin
    .from('psa_user_rates')
    .insert({
      org_id: dbUser.org_id,
      user_id: body.user_id,
      internal_cost_rate: body.internal_cost_rate,
      billable_rate: body.billable_rate,
      effective_from: effectiveFrom,
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
