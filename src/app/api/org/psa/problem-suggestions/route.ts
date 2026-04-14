import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

/**
 * GET — list pending suggestions (auto-recomputes from recent incidents).
 * Threshold: 3+ INCIDENT tickets within 30 days, same category + customer.
 */
export async function GET() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  const admin = createAdminClient()

  // Recompute suggestions from last 30 days of INCIDENT tickets
  const sinceIso = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: tickets, error: tErr } = await admin
    .from('psa_tickets')
    .select('id, customer_id, category, created_at')
    .eq('org_id', dbUser.org_id)
    .eq('ticket_type', 'INCIDENT')
    .gte('created_at', sinceIso)

  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

  // Group by customer_id + category
  type T = { id: string; customer_id: string | null; category: string | null; created_at: string }
  const groups = new Map<string, T[]>()
  for (const t of (tickets as T[] | null ?? [])) {
    if (!t.category || !t.customer_id) continue
    const key = `${t.customer_id}|${t.category}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  // Find any group >=3 not already an accepted/pending suggestion
  const { data: existing } = await admin
    .from('psa_problem_suggestions')
    .select('customer_id, category, status')
    .eq('org_id', dbUser.org_id)
    .in('status', ['pending', 'accepted'])

  type Ex = { customer_id: string | null; category: string; status: string }
  const existingKeys = new Set((existing as Ex[] | null ?? []).map(e => `${e.customer_id}|${e.category}`))

  const inserts: Array<Record<string, unknown>> = []
  for (const [key, ticketsInGroup] of groups) {
    if (ticketsInGroup.length < 3) continue
    if (existingKeys.has(key)) continue
    const [customerId, category] = key.split('|')
    inserts.push({
      org_id: dbUser.org_id,
      customer_id: customerId,
      category,
      incident_count: ticketsInGroup.length,
      window_days: 30,
      sample_ticket_ids: ticketsInGroup.slice(0, 10).map(t => t.id),
    })
  }

  if (inserts.length > 0) {
    await admin.from('psa_problem_suggestions').insert(inserts)
  }

  // Return pending suggestions
  const { data, error } = await admin
    .from('psa_problem_suggestions')
    .select('*, customer:customers(id, name)')
    .eq('org_id', dbUser.org_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: { id?: string; status?: 'accepted' | 'dismissed'; problem_id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.id || !body.status) return NextResponse.json({ error: 'id, status required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_problem_suggestions')
    .update({
      status: body.status,
      problem_id: body.problem_id ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
