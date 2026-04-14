import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: ticket, error } = await admin
    .from('psa_tickets')
    .select('*, customer:customers(id, name), asset:assets(id, label, vendor, model, serial_number), assignee:users!psa_tickets_assigned_to_fkey(id, first_name, last_name, email), job_type:psa_job_type_config(id, name, require_photos)')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Fetch related records in parallel
  const [notesRes, timeRes, partsRes, photosRes, statusLogRes] = await Promise.all([
    admin.from('psa_ticket_notes').select('*, author:users(id, first_name, last_name, email)').eq('ticket_id', id).order('created_at', { ascending: false }),
    admin.from('psa_time_entries').select('*, user:users(id, first_name, last_name)').eq('ticket_id', id).order('entry_date', { ascending: false }),
    admin.from('psa_ticket_parts').select('*').eq('ticket_id', id).order('created_at', { ascending: false }),
    admin.from('psa_ticket_photos').select('*').eq('ticket_id', id).order('created_at', { ascending: false }),
    admin.from('psa_ticket_status_log').select('*, changed_by_user:users(id, first_name, last_name)').eq('ticket_id', id).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    ...ticket,
    notes: notesRes.data ?? [],
    time_entries: timeRes.data ?? [],
    parts: partsRes.data ?? [],
    photos: photosRes.data ?? [],
    status_log: statusLogRes.data ?? [],
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()
  const allowed = [
    'customer_id', 'asset_id', 'site_id', 'project_id',
    'vertical', 'category', 'ticket_type', 'priority',
    'title', 'description', 'resolution_notes',
    'assigned_to', 'job_type_id', 'costing_enabled',
    'change_window_start', 'change_window_end',
  ]
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]

  // If assignment changed and first_response_at not set, mark first response
  if (body.assigned_to !== undefined) {
    const { data: current } = await admin
      .from('psa_tickets')
      .select('first_response_at, assigned_to')
      .eq('id', id)
      .eq('org_id', dbUser.org_id)
      .single()
    if (current && !current.first_response_at && body.assigned_to) {
      update.first_response_at = new Date().toISOString()
    }
  }

  const { data, error } = await admin
    .from('psa_tickets')
    .update(update)
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
