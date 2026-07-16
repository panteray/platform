import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
import { OppStatus } from '@/types/enums'

type OppOutcome = 'PENDING' | 'WON' | 'LOST'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    outcome?: OppOutcome
    lost_reason?: string
    payment_agreement_signed_at?: string | null
    payment_terms?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const outcome = body.outcome
  if (!outcome || !['PENDING', 'WON', 'LOST'].includes(outcome)) {
    return NextResponse.json({ error: 'outcome must be PENDING, WON, or LOST' }, { status: 400 })
  }
  if (outcome === 'LOST' && !body.lost_reason?.trim()) {
    return NextResponse.json({ error: 'lost_reason is required when outcome is LOST' }, { status: 400 })
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
  const update: Record<string, unknown> = { outcome }
  if (outcome === 'LOST') update.lost_reason = body.lost_reason!.trim()
  if (outcome === 'WON') update.lost_reason = null
  if ('payment_agreement_signed_at' in body) update.payment_agreement_signed_at = body.payment_agreement_signed_at || null
  if ('payment_terms' in body) update.payment_terms = body.payment_terms?.trim() || null

  let newStatus: OppStatus | null = null
  if (outcome === 'WON' && previousStatus !== OppStatus.ORDER_ENTRY) {
    newStatus = OppStatus.ORDER_ENTRY
    update.status = newStatus
  } else if (outcome === 'LOST' && previousStatus !== OppStatus.CLOSED) {
    newStatus = OppStatus.CLOSED
    update.status = newStatus
  }

  const { error: updateErr } = await admin.from('opportunities').update(update).eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  if (newStatus) {
    await admin.from('opp_status_history').insert({
      opp_id: id, org_id: caller.org_id, previous_status: previousStatus, new_status: newStatus,
      changed_by: caller.id,
    })
  }

  return NextResponse.json({ outcome, status: newStatus ?? previousStatus })
}
