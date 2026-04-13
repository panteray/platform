import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyLeadRead, verifyLeadCrud } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyLeadRead()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('org_id', caller.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const { data: target } = await admin.from('leads').select('org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Lead not in your organization' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  const fields = [
    'source', 'source_detail', 'company_name',
    'contact_first_name', 'contact_last_name', 'contact_title',
    'contact_email', 'contact_phone', 'contact_mobile',
    'address', 'city', 'state', 'zip', 'primary_website',
    'vertical', 'interest_divisions', 'estimated_value',
    'priority', 'score', 'assigned_to', 'referred_by',
    'pain_points', 'notes', 'archive_reason',
  ]
  for (const f of fields) {
    if (body[f] !== undefined) updateData[f] = body[f]
  }

  const { data, error } = await admin.from('leads')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: target } = await admin.from('leads').select('org_id').eq('id', id).single()
  if (!target || target.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Lead not in your organization' }, { status: 403 })
  }

  const { error } = await admin.from('leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'lead.deleted',
    entity_type: 'lead',
    entity_id: id,
    details: {},
  })

  return NextResponse.json({ success: true })
}
