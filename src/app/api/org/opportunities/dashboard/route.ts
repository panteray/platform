import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = [
  'GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER',
  'MANAGER', 'OPERATIONS', 'SALES_ISR', 'SALES_OSR', 'PRESALES',
]

/**
 * GET /api/org/opportunities/dashboard
 * Pipeline analytics: value by stage, win rate, avg cycle time,
 * revenue forecast, type breakdown, team workload.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('id, role, org_id')
    .eq('auth_id', user.id)
    .single()

  if (!dbUser?.org_id || !ALLOWED_ROLES.includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = dbUser.org_id

  // Fetch all opportunities
  const { data: opps } = await admin
    .from('opportunities')
    .select('id, status, opp_type, quote_amount, order_amount, estimated_value, assigned_isr_id, assigned_osr_id, assigned_presales_id, created_at, updated_at')
    .eq('org_id', orgId)

  if (!opps) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  // Fetch users for name resolution
  const { data: orgUsers } = await admin
    .from('users')
    .select('id, first_name, last_name, role')
    .eq('org_id', orgId)

  const userMap = new Map<string, string>()
  for (const u of orgUsers ?? []) {
    userMap.set(u.id, `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unknown')
  }

  const now = Date.now()
  const ninetyDaysAgo = new Date(now - 90 * 86400000).toISOString()

  // --- Pipeline Value by Stage ---
  const STAGE_MAP: Record<string, string> = {
    NEW: 'Lead', ASSIGNED_TO_PRESALES: 'Lead', ON_HOLD: 'On Hold',
    SURVEY: 'Presales', DESIGN: 'Presales', WAITING_ON_INFO: 'Presales',
    SUBMITTED_FOR_QUOTE: 'Quoting', AWAITING_SOW: 'Quoting', SUBMITTED_TO_CUSTOMER: 'Proposal',
    AWAITING_PO: 'Negotiation', AWAITING_SIGNED_DOCS: 'Negotiation',
    PROJECT: 'Execution', AWAITING_DELIVERY: 'Execution', INSTALL: 'Execution',
    QC: 'Closeout', SIGN_OFF: 'Closeout', CUSTOMER_SIGNATURE: 'Closeout',
    COMPLETE: 'Won', CLOSED: 'Lost',
  }

  const pipelineByStage: Record<string, { count: number; value: number }> = {}
  for (const opp of opps) {
    const stage = STAGE_MAP[opp.status] ?? 'Other'
    if (!pipelineByStage[stage]) pipelineByStage[stage] = { count: 0, value: 0 }
    pipelineByStage[stage].count++
    pipelineByStage[stage].value += Number(opp.quote_amount ?? opp.order_amount ?? 0)
  }

  // --- Win Rate (90d) ---
  const recentOpps = opps.filter((o) => o.created_at >= ninetyDaysAgo)
  const completedRecent = recentOpps.filter((o) => o.status === 'COMPLETE').length
  const closedRecent = recentOpps.filter((o) => o.status === 'CLOSED').length
  const terminalRecent = completedRecent + closedRecent
  const winRate = terminalRecent > 0 ? Math.round((completedRecent / terminalRecent) * 100) : 0

  // --- Avg Cycle Time (won opps, days from create to COMPLETE) ---
  const wonOpps = opps.filter((o) => o.status === 'COMPLETE')
  let avgCycleDays = 0
  if (wonOpps.length > 0) {
    const totalDays = wonOpps.reduce((sum, o) => {
      const created = new Date(o.created_at).getTime()
      const updated = new Date(o.updated_at).getTime()
      return sum + (updated - created) / 86400000
    }, 0)
    avgCycleDays = Math.round(totalDays / wonOpps.length)
  }

  // --- Revenue Forecast (active pipeline * weighted probability) ---
  const STAGE_WEIGHTS: Record<string, number> = {
    Lead: 0.1, Presales: 0.2, Quoting: 0.4, Proposal: 0.5,
    Negotiation: 0.7, Execution: 0.9, Closeout: 0.95,
  }
  let weightedForecast = 0
  for (const opp of opps) {
    if (opp.status === 'COMPLETE' || opp.status === 'CLOSED' || opp.status === 'ON_HOLD') continue
    const stage = STAGE_MAP[opp.status] ?? 'Lead'
    const weight = STAGE_WEIGHTS[stage] ?? 0.1
    const value = Number(opp.quote_amount ?? opp.order_amount ?? 0)
    weightedForecast += value * weight
  }

  // --- Type Breakdown ---
  const byType: Record<string, { count: number; value: number }> = {}
  for (const opp of opps) {
    const t = opp.opp_type ?? 'Untyped'
    if (!byType[t]) byType[t] = { count: 0, value: 0 }
    byType[t].count++
    byType[t].value += Number(opp.quote_amount ?? opp.order_amount ?? 0)
  }

  // --- Team Workload ---
  const activeOpps = opps.filter((o) => o.status !== 'COMPLETE' && o.status !== 'CLOSED')
  const teamWorkload: Record<string, { name: string; count: number; value: number }> = {}
  for (const opp of activeOpps) {
    const reps = [opp.assigned_isr_id, opp.assigned_osr_id, opp.assigned_presales_id].filter(Boolean)
    for (const repId of reps) {
      if (!repId) continue
      if (!teamWorkload[repId]) {
        teamWorkload[repId] = { name: userMap.get(repId) ?? 'Unknown', count: 0, value: 0 }
      }
      teamWorkload[repId].count++
      teamWorkload[repId].value += Number(opp.quote_amount ?? opp.order_amount ?? 0)
    }
  }

  // --- Pending Approvals Count ---
  const { count: pendingApprovals } = await admin
    .from('opp_approvals')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'PENDING')

  return NextResponse.json({
    total: opps.length,
    active: activeOpps.length,
    won: wonOpps.length,
    lost: opps.filter((o) => o.status === 'CLOSED').length,
    winRate,
    avgCycleDays,
    weightedForecast: Math.round(weightedForecast),
    totalPipelineValue: activeOpps.reduce((s, o) => s + Number(o.quote_amount ?? o.order_amount ?? 0), 0),
    pendingApprovals: pendingApprovals ?? 0,
    pipelineByStage: Object.entries(pipelineByStage)
      .map(([stage, data]) => ({ stage, ...data }))
      .sort((a, b) => b.value - a.value),
    byType: Object.entries(byType)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count),
    teamWorkload: Object.values(teamWorkload).sort((a, b) => b.count - a.count),
  })
}
