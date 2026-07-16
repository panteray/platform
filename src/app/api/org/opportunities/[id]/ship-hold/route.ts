import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
import { OppStatus } from '@/types/enums'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { action?: 'place' | 'clear' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const action = body.action
  if (action !== 'place' && action !== 'clear') {
    return NextResponse.json({ error: "action must be 'place' or 'clear'" }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: opp, error: fetchErr } = await admin
    .from('opportunities')
    .select('id, org_id, status')
    .eq('id', id)
    .single()
  if (fetchErr || !opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  if (opp.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  const previousStatus = opp.status as OppStatus
  const validPrev: OppStatus[] = [OppStatus.ORDER_ENTRY, OppStatus.SHIP_HOLD]
  if (!validPrev.includes(previousStatus)) {
    return NextResponse.json({ error: `Ship hold only applies to ORDER_ENTRY or SHIP_HOLD (current: ${previousStatus})` }, { status: 400 })
  }

  const newStatus = action === 'place' ? OppStatus.SHIP_HOLD : OppStatus.ORDER_ENTRY
  const update: Record<string, unknown> = { status: newStatus }
  if (action === 'clear') update.ship_hold_cleared_at = new Date().toISOString()

  const { error: updateErr } = await admin.from('opportunities').update(update).eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  await admin.from('opp_status_history').insert({
    opp_id: id, org_id: caller.org_id, previous_status: previousStatus, new_status: newStatus,
    changed_by: caller.id,
  })

  return NextResponse.json({ status: newStatus, action })
}
