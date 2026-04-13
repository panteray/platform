import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyLeadCrud, verifyLeadRead } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyLeadRead()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: leadId } = await params
  const admin = createAdminClient()

  // Verify lead belongs to caller's org
  const { data: lead } = await admin.from('leads').select('org_id').eq('id', leadId).single()
  if (!lead || lead.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('lead_interactions')
    .select('*')
    .eq('lead_id', leadId)
    .eq('org_id', caller.org_id)
    .order('interaction_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: leadId } = await params
  const body = await request.json()
  const admin = createAdminClient()

  // Verify lead belongs to caller's org
  const { data: lead } = await admin.from('leads').select('org_id').eq('id', leadId).single()
  if (!lead || lead.org_id !== caller.org_id) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const { data, error } = await admin.from('lead_interactions').insert({
    org_id: caller.org_id,
    lead_id: leadId,
    type: body.type,
    direction: body.direction ?? null,
    subject: body.subject ?? null,
    body: body.body ?? null,
    outcome: body.outcome ?? null,
    interaction_date: body.interaction_date ?? new Date().toISOString(),
    duration_minutes: body.duration_minutes ?? null,
    follow_up_date: body.follow_up_date ?? null,
    follow_up_note: body.follow_up_note ?? null,
    created_by: caller.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await admin.from('audit_log').insert({
    org_id: caller.org_id,
    user_id: caller.id,
    action: 'lead_interaction.created',
    entity_type: 'lead_interaction',
    entity_id: data.id,
    details: { lead_id: leadId, type: body.type },
  })

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await verifyLeadCrud()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: leadId } = await params
  const { searchParams } = new URL(request.url)
  const interactionId = searchParams.get('interactionId')
  if (!interactionId) return NextResponse.json({ error: 'Missing interactionId' }, { status: 400 })

  const admin = createAdminClient()

  // Verify interaction belongs to this lead in caller's org
  const { data: interaction } = await admin
    .from('lead_interactions')
    .select('org_id, lead_id')
    .eq('id', interactionId)
    .single()

  if (!interaction || interaction.org_id !== caller.org_id || interaction.lead_id !== leadId) {
    return NextResponse.json({ error: 'Interaction not found' }, { status: 404 })
  }

  const { error } = await admin.from('lead_interactions').delete().eq('id', interactionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
