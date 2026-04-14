import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function loadToken(token: string) {
  const admin = createAdminClient()
  const { data: tokenRow } = await admin
    .from('customer_portal_tokens')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .eq('scope', 'CUSTOMER_ACCOUNT')
    .maybeSingle()
  if (!tokenRow) return { error: 'Invalid or expired token', status: 401 as const }
  if (new Date(tokenRow.expires_at) < new Date()) return { error: 'Token expired', status: 401 as const }
  return { tokenRow, admin }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await loadToken(token)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const { tokenRow, admin } = r

  const [ticketsRes, requestsRes] = await Promise.all([
    admin
      .from('psa_tickets')
      .select('id, ticket_number, title, status, priority, created_at, resolved_at')
      .eq('customer_id', tokenRow.customer_id)
      .eq('org_id', tokenRow.org_id)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('customer_portal_requests')
      .select('*')
      .eq('customer_id', tokenRow.customer_id)
      .eq('org_id', tokenRow.org_id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  return NextResponse.json({
    tickets: ticketsRes.data ?? [],
    requests: requestsRes.data ?? [],
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await loadToken(token)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const { tokenRow, admin } = r

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.subject) return NextResponse.json({ error: 'subject required' }, { status: 400 })

  const { data, error } = await admin
    .from('customer_portal_requests')
    .insert({
      org_id: tokenRow.org_id,
      customer_id: tokenRow.customer_id,
      token_id: tokenRow.id,
      type: body.type ?? 'TICKET',
      subject: body.subject,
      body: body.body ?? null,
      priority: body.priority ?? null,
      status: 'NEW',
      created_by_name: body.created_by_name ?? null,
      created_by_email: body.created_by_email ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
