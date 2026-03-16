import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { OppStatus, OPP_STATUS_ORDER } from '@/types/enums'

async function verifyCaller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: dbUser } = await admin.from('users').select('id, role, org_id, is_global_admin').eq('auth_id', user.id).single()
  if (!dbUser || !dbUser.org_id) return null
  return dbUser
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const newStatus = body.new_status as OppStatus
  if (!newStatus || !OPP_STATUS_ORDER.includes(newStatus)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  if (newStatus === 'ON_HOLD' && !body.on_hold_reason?.trim()) {
    return NextResponse.json({ error: 'on_hold_reason is required for ON_HOLD' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: opp, error: fetchErr } = await admin.from('opportunities').select('id, status, org_id').eq('id', id).single()
  if (fetchErr || !opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  if (opp.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  const previousStatus = opp.status as OppStatus
  const updateFields: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'ON_HOLD') updateFields.on_hold_reason = body.on_hold_reason?.trim() || null
  if (body.decline_reason?.trim()) updateFields.decline_reason = body.decline_reason.trim()

  const { error: updateErr } = await admin.from('opportunities').update(updateFields).eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  await admin.from('opp_status_history').insert({
    opp_id: id, org_id: caller.org_id, previous_status: previousStatus, new_status: newStatus,
    changed_by: caller.id, on_hold_reason: newStatus === 'ON_HOLD' ? (body.on_hold_reason?.trim() || null) : null,
    decline_reason: body.decline_reason?.trim() || null,
  })

  return NextResponse.json({ status: newStatus, previous_status: previousStatus })
}
