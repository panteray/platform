import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_time_entries')
    .select('*, user:users(id, first_name, last_name)')
    .eq('ticket_id', id)
    .eq('org_id', dbUser.org_id)
    .order('entry_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const hours = parseFloat(body.hours as string)
  if (!hours || hours <= 0) return NextResponse.json({ error: 'hours required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_time_entries')
    .insert({
      org_id: dbUser.org_id,
      ticket_id: id,
      user_id: dbUser.id,
      hours,
      description: body.description ?? null,
      billable: body.billable ?? true,
      rate: body.rate ?? null,
      entry_date: body.entry_date ?? new Date().toISOString().split('T')[0],
    })
    .select('*, user:users(id, first_name, last_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
