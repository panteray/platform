import type { PsaTicket } from '@/types/database'
import { PSA_WAITING_STATUSES } from '@/types/database'

export interface SlaClockState {
  dueAt: string | null
  breached: boolean
  progressPct: number       // 0-100+, >100 = breach
  minutesRemaining: number  // negative = breach
  paused: boolean
}

export interface SlaProgress {
  response: SlaClockState
  resolution: SlaClockState
}

/**
 * Compute live SLA progress for a ticket, accounting for:
 *  - `sla_total_pause_min` (accumulated paused time)
 *  - `sla_paused_at` (currently paused — add live delta)
 *  - `first_response_at` (response clock frozen once first response recorded)
 *
 * Returns clock state for BOTH response and resolution SLAs, plus a `paused`
 * boolean. Read-only — does not mutate the ticket.
 *
 * Breach logic is effective time: now() - createdAt - totalPause (+ live pause
 * delta if currently waiting) vs. the policy due offset.
 */
export function computeSlaProgress(
  ticket: Pick<
    PsaTicket,
    | 'status'
    | 'created_at'
    | 'first_response_at'
    | 'sla_response_due'
    | 'sla_resolution_due'
    | 'sla_paused_at'
    | 'sla_total_pause_min'
  >,
  now: Date = new Date(),
): SlaProgress {
  const paused = PSA_WAITING_STATUSES.includes(ticket.status) && !!ticket.sla_paused_at

  // Live paused delta (ms)
  const livePausedMs = paused && ticket.sla_paused_at
    ? Math.max(0, now.getTime() - new Date(ticket.sla_paused_at).getTime())
    : 0

  // Total excluded ms = accumulated pause + current live pause
  const totalExcludedMs = (ticket.sla_total_pause_min ?? 0) * 60_000 + livePausedMs

  const effectiveNow = now.getTime() - totalExcludedMs

  // Response clock: frozen once first_response_at is set
  const responseFrozenAt = ticket.first_response_at
    ? new Date(ticket.first_response_at).getTime()
    : null

  const response = buildClock({
    dueAt: ticket.sla_response_due,
    createdAt: ticket.created_at,
    effectiveNowMs: responseFrozenAt ?? effectiveNow,
    paused,
  })

  const resolution = buildClock({
    dueAt: ticket.sla_resolution_due,
    createdAt: ticket.created_at,
    effectiveNowMs: effectiveNow,
    paused,
  })

  return { response, resolution }
}

function buildClock(args: {
  dueAt: string | null
  createdAt: string
  effectiveNowMs: number
  paused: boolean
}): SlaClockState {
  if (!args.dueAt) {
    return { dueAt: null, breached: false, progressPct: 0, minutesRemaining: 0, paused: args.paused }
  }

  const createdMs = new Date(args.createdAt).getTime()
  const dueMs = new Date(args.dueAt).getTime()
  const windowMs = Math.max(1, dueMs - createdMs)
  const elapsedMs = Math.max(0, args.effectiveNowMs - createdMs)

  const progressPct = Math.round((elapsedMs / windowMs) * 100)
  const minutesRemaining = Math.round((dueMs - args.effectiveNowMs) / 60_000)
  const breached = args.effectiveNowMs > dueMs

  return {
    dueAt: args.dueAt,
    breached,
    progressPct,
    minutesRemaining,
    paused: args.paused,
  }
}

/** Terminal statuses that should be excluded from SLA sweeps */
export const SLA_TERMINAL_STATUSES = ['RESOLVED', 'CANCELLED'] as const
