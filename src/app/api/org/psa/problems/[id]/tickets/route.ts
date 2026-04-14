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

  let body: { ticket_id?: string; ticket_ids?: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const ticketIds = body.ticket_ids ?? (body.ticket_id ? [body.ticket_id] : [])
  if (ticketIds.length === 0) return NextResponse.json({ error: 'ticket_id or ticket_ids required' }, { status: 400 })

  const admin = createAdminClient()
  const rows = ticketIds.map(ticketId => ({
    problem_id: id,
    ticket_id: ticketId,
    org_id: dbUser.org_id,
    linked_by: dbUser.id,
  }))

  const { data, error } = await admin
    .from('psa_problem_tickets')
    .upsert(rows, { onConflict: 'problem_id,ticket_id' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  const ticketId = req.nextUrl.searchParams.get('ticket_id')
  if (!ticketId) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('psa_problem_tickets')
    .delete()
    .eq('problem_id', id)
    .eq('ticket_id', ticketId)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
