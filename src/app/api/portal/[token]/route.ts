import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dbError } from '@/lib/api-utils'

/** GET /api/portal/:token — public token-gated read of OPP documents */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  // Validate token
  const { data: portalToken, error } = await admin
    .from('customer_portal_tokens')
    .select('*, customers(id, name, contact_name, contact_email), opportunities(id, opp_number, project_name, quote_amount, order_amount)')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (error || !portalToken) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  // Check expiry
  if (new Date(portalToken.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
  }

  const permissions: string[] = portalToken.permissions || []
  const oppId = portalToken.opp_id
  const result: Record<string, unknown> = {
    customer: portalToken.customers,
    opportunity: portalToken.opportunities,
    permissions,
    accepted: !!portalToken.accepted_at,
    accepted_at: portalToken.accepted_at,
  }

  // Fetch permitted documents
  if (permissions.includes('view_sow')) {
    const { data: sow } = await admin
      .from('opp_sow')
      .select('*')
      .eq('opp_id', oppId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    result.sow = sow
  }

  if (permissions.includes('view_hardware_schedule')) {
    const { data: hwItems } = await admin
      .from('hardware_schedule_items')
      .select('*')
      .eq('opp_id', oppId)
      .order('line_number')
    result.hardware_schedule = hwItems
  }

  if (permissions.includes('view_quote')) {
    const opp = portalToken.opportunities as Record<string, unknown> | null
    result.quote = {
      quote_amount: opp?.quote_amount || null,
      order_amount: opp?.order_amount || null,
    }
  }

  return NextResponse.json(result)
}

/** POST /api/portal/:token — customer acceptance (e-signature) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await req.json()
  const admin = createAdminClient()

  // Validate token
  const { data: portalToken, error } = await admin
    .from('customer_portal_tokens')
    .select('id, opp_id, org_id, is_active, expires_at, accepted_at')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (error || !portalToken) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  if (new Date(portalToken.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
  }

  if (portalToken.accepted_at) {
    return NextResponse.json({ error: 'Already accepted' }, { status: 400 })
  }

  if (!body.name || !body.email) {
    return NextResponse.json({ error: 'Name and email required for acceptance' }, { status: 422 })
  }

  // Record acceptance
  const { data: updated, error: updateErr } = await admin
    .from('customer_portal_tokens')
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by_name: body.name,
      accepted_by_email: body.email,
      signature_data: body.signature || null,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      user_agent: req.headers.get('user-agent') || null,
    })
    .eq('id', portalToken.id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: dbError(updateErr) }, { status: 500 })

  // Update OPP: set po_received_at, trigger status consideration
  await admin
    .from('opportunities')
    .update({
      po_received_at: new Date().toISOString(),
    })
    .eq('id', portalToken.opp_id)
    .eq('org_id', portalToken.org_id)

  // Audit
  await admin.from('audit_logs').insert({
    org_id: portalToken.org_id,
    user_id: null,
    action: 'portal.accepted',
    entity_type: 'customer_portal_token',
    entity_id: portalToken.id,
    details: {
      opp_id: portalToken.opp_id,
      accepted_by_name: body.name,
      accepted_by_email: body.email,
    },
  })

  return NextResponse.json({ accepted: true, accepted_at: updated.accepted_at })
}
