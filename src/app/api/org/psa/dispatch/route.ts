import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
  const techId = req.nextUrl.searchParams.get('tech_id')
  const status = req.nextUrl.searchParams.get('status')

  const admin = createAdminClient()
  let query = admin
    .from('psa_dispatch_assignments')
    .select(`
      *,
      ticket:psa_tickets(id, ticket_number, title, priority, status, vertical, customer_id, customer:customers(id, name)),
      tech:users!psa_dispatch_assignments_tech_id_fkey(id, first_name, last_name, email)
    `)
    .eq('org_id', dbUser.org_id)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_start', { ascending: true, nullsFirst: true })

  if (date) query = query.eq('scheduled_date', date)
  if (techId) query = query.eq('tech_id', techId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.ticket_id || !body.tech_id || !body.scheduled_date) {
    return NextResponse.json({ error: 'ticket_id, tech_id, scheduled_date required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check for double-booking (overlapping window on same tech + date)
  if (body.scheduled_start && body.scheduled_end) {
    const { data: overlaps } = await admin
      .from('psa_dispatch_assignments')
      .select('id, ticket_id')
      .eq('org_id', dbUser.org_id)
      .eq('tech_id', body.tech_id)
      .eq('scheduled_date', body.scheduled_date)
      .neq('status', 'cancelled')
      .or(`scheduled_start.lte.${body.scheduled_end},scheduled_end.gte.${body.scheduled_start}`)

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json({
        error: 'Tech is already booked during this window',
        conflicts: overlaps,
      }, { status: 409 })
    }
  }

  const { data, error } = await admin
    .from('psa_dispatch_assignments')
    .insert({
      org_id: dbUser.org_id,
      ticket_id: body.ticket_id,
      tech_id: body.tech_id,
      scheduled_date: body.scheduled_date,
      scheduled_start: body.scheduled_start ?? null,
      scheduled_end: body.scheduled_end ?? null,
      status: 'scheduled',
      notes: body.notes ?? null,
      travel_notes: body.travel_notes ?? null,
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cascade: assign ticket to tech + set ticket status to SCHEDULED
  await admin
    .from('psa_tickets')
    .update({
      assigned_to: body.tech_id,
      status: 'SCHEDULED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.ticket_id)
    .eq('org_id', dbUser.org_id)

  return NextResponse.json(data, { status: 201 })
}
