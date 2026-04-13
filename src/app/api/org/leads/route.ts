import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyLeadCrud, verifyLeadRead } from '@/lib/auth'

async function nextLeadNumber(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const { data } = await admin
    .from('leads')
    .select('lead_number')
    .eq('org_id', orgId)
    .order('lead_number', { ascending: false })
    .limit(1)
  const last = data?.[0]?.lead_number
  const num = last ? parseInt(last.replace('LD-', ''), 10) + 1 : 1
  return `LD-${String(num).padStart(6, '0')}`
}

export async function GET(request: NextRequest) {
  const caller = await verifyLeadRead()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const { data, error } = await admin
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('org_id', caller.org_id)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  }

  const { data, error } = await admin
    .from('leads')
    .select('*')
    .eq('org_id', caller.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  let attempt = 0
  let data, error, leadNumber
  while (attempt < 5) {
    leadNumber = await nextLeadNumber(admin, caller.org_id)
    const result = await admin.from('leads').insert({
      org_id: caller.org_id,
      lead_number: leadNumber,
      status: 'NEW',
      source: body.source ?? null,
      source_detail: body.source_detail ?? null,
      company_name: body.company_name ?? null,
      contact_first_name: body.contact_first_name,
      contact_last_name: body.contact_last_name,
      contact_title: body.contact_title ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
      contact_mobile: body.contact_mobile ?? null,
      address: body.address ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      primary_website: body.primary_website ?? null,
      vertical: body.vertical ?? null,
      interest_divisions: body.interest_divisions ?? null,
      estimated_value: body.estimated_value ?? null,
      priority: body.priority ?? 'WARM',
      score: body.score ?? null,
      assigned_to: body.assigned_to ?? caller.id,
      referred_by: body.referred_by ?? null,
      pain_points: body.pain_points ?? null,
      notes: body.notes ?? null,
      created_by: caller.id,
    }).select().single()
    data = result.data
    error = result.error
    if (!error || !error.message.includes('unique')) break
    attempt++
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'lead.created',
    entity_type: 'lead',
    entity_id: data.id,
    details: { lead_number: leadNumber },
  })

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const admin = createAdminClient()

  const { data: target } = await admin.from('leads').select('org_id').eq('id', body.id).single()
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
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

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
