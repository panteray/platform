import { NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeSlaProgress, SLA_TERMINAL_STATUSES } from '@/lib/psa/sla'
import type { PsaTicket } from '@/types/database'

/**
 * SLA breach sweep. Idempotent — scans active tickets for the caller's org,
 * computes effective clock, and flips `sla_response_breached` /
 * `sla_resolution_breached` only on newly-breached tickets. Inserts
 * `BREACH_RESPONSE` / `BREACH_RESOLUTION` rows into `psa_sla_events` for audit.
 *
 * Safe to call repeatedly (cron, manual trigger, dashboard load).
 */
export async function POST() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const now = new Date()

  const { data: tickets, error } = await admin
    .from('psa_tickets')
    .select('id, org_id, status, created_at, first_response_at, sla_response_due, sla_resolution_due, sla_paused_at, sla_total_pause_min, sla_response_breached, sla_resolution_breached')
    .eq('org_id', dbUser.org_id)
    .not('status', 'in', `(${SLA_TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = Pick<
    PsaTicket,
    | 'id'
    | 'org_id'
    | 'status'
    | 'created_at'
    | 'first_response_at'
    | 'sla_response_due'
    | 'sla_resolution_due'
    | 'sla_paused_at'
    | 'sla_total_pause_min'
    | 'sla_response_breached'
    | 'sla_resolution_breached'
  >

  const rows = (tickets ?? []) as Row[]
  let scanned = 0
  let newResponseBreaches = 0
  let newResolutionBreaches = 0
  const eventsToInsert: Array<{ org_id: string; ticket_id: string; event_type: 'BREACH_RESPONSE' | 'BREACH_RESOLUTION'; notes: string }> = []

  for (const t of rows) {
    scanned++
    const progress = computeSlaProgress(t, now)

    const flipResponse = progress.response.breached && !t.sla_response_breached
    const flipResolution = progress.resolution.breached && !t.sla_resolution_breached

    if (!flipResponse && !flipResolution) continue

    const update: Record<string, unknown> = {}
    if (flipResponse) {
      update.sla_response_breached = true
      newResponseBreaches++
      eventsToInsert.push({
        org_id: t.org_id,
        ticket_id: t.id,
        event_type: 'BREACH_RESPONSE',
        notes: `Response SLA breached. Due ${t.sla_response_due}.`,
      })
    }
    if (flipResolution) {
      update.sla_resolution_breached = true
      newResolutionBreaches++
      eventsToInsert.push({
        org_id: t.org_id,
        ticket_id: t.id,
        event_type: 'BREACH_RESOLUTION',
        notes: `Resolution SLA breached. Due ${t.sla_resolution_due}.`,
      })
    }

    await admin.from('psa_tickets').update(update).eq('id', t.id).eq('org_id', dbUser.org_id)
  }

  if (eventsToInsert.length > 0) {
    await admin.from('psa_sla_events').insert(eventsToInsert)
  }

  return NextResponse.json({
    scanned,
    new_response_breaches: newResponseBreaches,
    new_resolution_breaches: newResolutionBreaches,
  })
}
