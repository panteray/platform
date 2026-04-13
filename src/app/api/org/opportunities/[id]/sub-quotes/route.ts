import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

const MANAGER_ROLES = ['GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER', 'MANAGER', 'OPERATIONS']

/** GET /api/org/opportunities/:id/sub-quotes — list quotes with sub name */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('opp_sub_quotes')
    .select('*, subcontractors(id, name, contact_name, contact_email, contact_phone, hourly_rate, day_rate)')
    .eq('opp_id', id)
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** POST /api/org/opportunities/:id/sub-quotes — create quote / send RFP */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const admin = createAdminClient()

  if (!body.sub_id) return NextResponse.json({ error: 'sub_id required' }, { status: 400 })

  // Check for existing active quote from same sub
  const { data: existing } = await admin
    .from('opp_sub_quotes')
    .select('id, status')
    .eq('opp_id', id)
    .eq('sub_id', body.sub_id)
    .eq('org_id', dbUser.org_id)
    .in('status', ['draft', 'rfp_sent', 'quoted'])
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Active quote already exists for this subcontractor' }, { status: 409 })
  }

  const status = body.send_rfp ? 'rfp_sent' : 'draft'

  const { data, error } = await admin
    .from('opp_sub_quotes')
    .insert({
      org_id: dbUser.org_id,
      opp_id: id,
      sub_id: body.sub_id,
      status,
      rfp_notes: body.rfp_notes || null,
      rfp_sent_at: body.send_rfp ? new Date().toISOString() : null,
      created_by: dbUser.id,
    })
    .select('*, subcontractors(id, name, contact_name, contact_email, contact_phone, hourly_rate, day_rate)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit
  await admin.from('audit_logs').insert({
    org_id: dbUser.org_id,
    user_id: dbUser.id,
    action: body.send_rfp ? 'sub_quote.rfp_sent' : 'sub_quote.created',
    entity_type: 'opp_sub_quote',
    entity_id: data.id,
    details: { opp_id: id, sub_id: body.sub_id },
  })

  return NextResponse.json(data, { status: 201 })
}

/** PATCH /api/org/opportunities/:id/sub-quotes?quote_id=... */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const quoteId = req.nextUrl.searchParams.get('quote_id')
  if (!quoteId) return NextResponse.json({ error: 'quote_id required' }, { status: 400 })

  const body = await req.json()
  const admin = createAdminClient()

  const updates: Record<string, unknown> = {}

  // Status transitions
  if (body.status) {
    updates.status = body.status

    if (body.status === 'rfp_sent') {
      updates.rfp_sent_at = new Date().toISOString()
    }
    if (body.status === 'quoted') {
      updates.quote_received_at = new Date().toISOString()
    }
    if (body.status === 'accepted') {
      // Only managers can accept
      if (!MANAGER_ROLES.includes(dbUser.role)) {
        return NextResponse.json({ error: 'Only managers can accept quotes' }, { status: 403 })
      }
      updates.accepted_at = new Date().toISOString()
      updates.accepted_by = dbUser.id
    }
    if (body.status === 'rejected') {
      updates.decline_reason = body.decline_reason || null
    }
  }

  // Quote data fields
  const allowed = [
    'rfp_notes', 'labor_hours', 'labor_amount', 'material_amount',
    'total_amount', 'quote_doc_url', 'valid_until', 'decline_reason',
  ]
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await admin
    .from('opp_sub_quotes')
    .update(updates)
    .eq('id', quoteId)
    .eq('org_id', dbUser.org_id)
    .select('*, subcontractors(id, name, contact_name, contact_email, contact_phone, hourly_rate, day_rate)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If accepted, update OPP sub_quote_amount
  if (body.status === 'accepted' && data.total_amount) {
    const oppId = (data as Record<string, unknown>).opp_id as string
    await admin
      .from('opportunities')
      .update({ sub_quote_amount: data.total_amount })
      .eq('id', oppId)
      .eq('org_id', dbUser.org_id)
  }

  return NextResponse.json(data)
}

/** DELETE /api/org/opportunities/:id/sub-quotes?quote_id=... */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params
  const quoteId = req.nextUrl.searchParams.get('quote_id')
  if (!quoteId) return NextResponse.json({ error: 'quote_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Only allow deleting draft quotes
  const { data: quote } = await admin
    .from('opp_sub_quotes')
    .select('status')
    .eq('id', quoteId)
    .eq('org_id', dbUser.org_id)
    .single()

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (quote.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft quotes can be deleted' }, { status: 400 })
  }

  const { error } = await admin
    .from('opp_sub_quotes')
    .delete()
    .eq('id', quoteId)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
