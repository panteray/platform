import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_ticket_notes')
    .select('*, author:users(id, first_name, last_name, email)')
    .eq('ticket_id', id)
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { body?: string; internal_only?: boolean }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.body || !body.body.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_ticket_notes')
    .insert({
      org_id: dbUser.org_id,
      ticket_id: id,
      author_id: dbUser.id,
      body: body.body,
      internal_only: body.internal_only ?? false,
    })
    .select('*, author:users(id, first_name, last_name, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark first response if not yet set
  await admin
    .from('psa_tickets')
    .update({ first_response_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .is('first_response_at', null)

  return NextResponse.json(data, { status: 201 })
}
