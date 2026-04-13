import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

/** GET /api/org/opportunities/:id/portal — list portal tokens for this OPP */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('customer_portal_tokens')
    .select('*, customers(id, name, contact_name, contact_email)')
    .eq('opp_id', id)
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/org/opportunities/:id/portal — generate portal token */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()

  // Verify OPP has a customer
  const { data: opp } = await admin
    .from('opportunities')
    .select('customer_id')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (!opp?.customer_id) {
    return NextResponse.json({ error: 'OPP must have a customer before generating portal link' }, { status: 422 })
  }

  const permissions = body.permissions || ['view_sow', 'view_quote', 'view_hardware_schedule']
  const expiresInDays = body.expires_in_days || 30

  const { data, error } = await admin
    .from('customer_portal_tokens')
    .insert({
      org_id: dbUser.org_id,
      opp_id: id,
      customer_id: opp.customer_id,
      permissions,
      expires_at: new Date(Date.now() + expiresInDays * 86400000).toISOString(),
      created_by: dbUser.id,
    })
    .select('*, customers(id, name, contact_name, contact_email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit
  await admin.from('audit_logs').insert({
    org_id: dbUser.org_id,
    user_id: dbUser.id,
    action: 'portal.token_created',
    entity_type: 'customer_portal_token',
    entity_id: data.id,
    details: { opp_id: id, customer_id: opp.customer_id, permissions },
  })

  return NextResponse.json(data, { status: 201 })
}

/** PATCH /api/org/opportunities/:id/portal?token_id=... — deactivate token */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const tokenId = req.nextUrl.searchParams.get('token_id')
  if (!tokenId) return NextResponse.json({ error: 'token_id required' }, { status: 400 })

  const body = await req.json()
  const admin = createAdminClient()

  const updates: Record<string, unknown> = {}
  if ('is_active' in body) updates.is_active = body.is_active

  const { data, error } = await admin
    .from('customer_portal_tokens')
    .update(updates)
    .eq('id', tokenId)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
