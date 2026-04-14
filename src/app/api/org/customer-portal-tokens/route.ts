import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
import { randomBytes } from 'crypto'

export async function GET(req: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const customerId = url.searchParams.get('customer_id')
  const scope = url.searchParams.get('scope') ?? 'CUSTOMER_ACCOUNT'

  const admin = createAdminClient()
  let q = admin
    .from('customer_portal_tokens')
    .select('*, customer:customers(id, name)')
    .eq('org_id', caller.org_id)
    .eq('scope', scope)
    .order('created_at', { ascending: false })

  if (customerId) q = q.eq('customer_id', customerId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const expiresAt = body.expires_at as string | undefined
    ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  const token = randomBytes(32).toString('hex')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('customer_portal_tokens')
    .insert({
      org_id: caller.org_id,
      customer_id: body.customer_id,
      opp_id: null,
      scope: 'CUSTOMER_ACCOUNT',
      token,
      permissions: body.permissions ?? ['view_invoices', 'view_tickets', 'view_assets', 'submit_request'],
      expires_at: expiresAt,
      created_by: caller.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
