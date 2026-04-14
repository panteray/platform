import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

/**
 * G7: Post-Incident Report (PIR).
 *
 * P1/P2 tickets require a completed PIR before they can transition
 * COMPLETED → RESOLVED (enforced as closeout gate G10). This endpoint lets
 * the PM / assigned tech fill in the PIR fields and mark it complete.
 */

const PIR_FIELDS = ['pir_root_cause', 'pir_timeline', 'pir_lessons_learned', 'pir_action_items'] as const

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_tickets')
    .select('id, priority, status, pir_completed_at, pir_root_cause, pir_timeline, pir_lessons_learned, pir_action_items')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER)) {
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Verify ticket exists and belongs to caller's org
  const { data: ticket, error: tErr } = await admin
    .from('psa_tickets')
    .select('id, priority')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (tErr || !ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const f of PIR_FIELDS) {
    if (body[f] !== undefined) update[f] = body[f]
  }

  // Explicit complete/uncomplete toggle
  if (body.complete === true) {
    update.pir_completed_at = new Date().toISOString()
  } else if (body.complete === false) {
    update.pir_completed_at = null
  }

  const { data, error } = await admin
    .from('psa_tickets')
    .update(update)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select('id, priority, pir_completed_at, pir_root_cause, pir_timeline, pir_lessons_learned, pir_action_items')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
