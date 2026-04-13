import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MANAGER_ROLES = [
  'GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER', 'MANAGER', 'OPERATIONS',
]

/**
 * GET /api/org/leads/dashboard-manager
 * Manager-level lead analytics: team pipeline, conversion by rep,
 * lead aging, source effectiveness, unassigned leads, leaderboard.
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

  if (!dbUser?.org_id || !MANAGER_ROLES.includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = dbUser.org_id

  // Fetch all leads for org
  const { data: leads } = await admin
    .from('leads')
    .select('id, status, source, priority, estimated_value, assigned_to, created_at, converted_at')
    .eq('org_id', orgId)

  if (!leads) return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })

  // Fetch users in org for rep mapping
  const { data: orgUsers } = await admin
    .from('users')
    .select('id, first_name, last_name, role')
    .eq('org_id', orgId)

  const userMap = new Map<string, { name: string; role: string }>()
  for (const u of orgUsers ?? []) {
    userMap.set(u.id, { name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || 'Unknown', role: u.role })
  }

  // --- Team Pipeline: grouped by assigned_to ---
  const teamPipeline: Record<string, { name: string; total: number; value: number; byStatus: Record<string, number> }> = {}
  for (const lead of leads) {
    const repId = lead.assigned_to ?? 'unassigned'
    const repName = lead.assigned_to ? (userMap.get(lead.assigned_to)?.name ?? 'Unknown') : 'Unassigned'
    if (!teamPipeline[repId]) {
      teamPipeline[repId] = { name: repName, total: 0, value: 0, byStatus: {} }
    }
    teamPipeline[repId].total++
    teamPipeline[repId].value += Number(lead.estimated_value ?? 0)
    teamPipeline[repId].byStatus[lead.status] = (teamPipeline[repId].byStatus[lead.status] ?? 0) + 1
  }

  // --- Conversion by Rep (90 day) ---
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString()
  const recentLeads = leads.filter((l) => l.created_at >= ninetyDaysAgo)
  const conversionByRep: Record<string, { name: string; total: number; converted: number; rate: number }> = {}
  for (const lead of recentLeads) {
    const repId = lead.assigned_to ?? 'unassigned'
    const repName = lead.assigned_to ? (userMap.get(lead.assigned_to)?.name ?? 'Unknown') : 'Unassigned'
    if (!conversionByRep[repId]) {
      conversionByRep[repId] = { name: repName, total: 0, converted: 0, rate: 0 }
    }
    conversionByRep[repId].total++
    if (lead.status === 'CONVERTED') conversionByRep[repId].converted++
  }
  for (const rep of Object.values(conversionByRep)) {
    rep.rate = rep.total > 0 ? Math.round((rep.converted / rep.total) * 100) : 0
  }

  // --- Lead Aging (days since creation for non-terminal leads) ---
  const now = Date.now()
  const activeLeads = leads.filter((l) => l.status !== 'CONVERTED' && l.status !== 'ARCHIVED')
  const agingBuckets = { '0-7': 0, '8-14': 0, '15-30': 0, '31-60': 0, '60+': 0 }
  for (const lead of activeLeads) {
    const days = Math.floor((now - new Date(lead.created_at).getTime()) / 86400000)
    if (days <= 7) agingBuckets['0-7']++
    else if (days <= 14) agingBuckets['8-14']++
    else if (days <= 30) agingBuckets['15-30']++
    else if (days <= 60) agingBuckets['31-60']++
    else agingBuckets['60+']++
  }

  // --- Source Effectiveness (conversion rate by source) ---
  const sourceEffectiveness: Record<string, { total: number; converted: number; rate: number; value: number }> = {}
  for (const lead of leads) {
    const src = lead.source ?? 'UNKNOWN'
    if (!sourceEffectiveness[src]) {
      sourceEffectiveness[src] = { total: 0, converted: 0, rate: 0, value: 0 }
    }
    sourceEffectiveness[src].total++
    sourceEffectiveness[src].value += Number(lead.estimated_value ?? 0)
    if (lead.status === 'CONVERTED') sourceEffectiveness[src].converted++
  }
  for (const src of Object.values(sourceEffectiveness)) {
    src.rate = src.total > 0 ? Math.round((src.converted / src.total) * 100) : 0
  }

  // --- Unassigned Leads ---
  const unassignedLeads = leads.filter(
    (l) => !l.assigned_to && l.status !== 'CONVERTED' && l.status !== 'ARCHIVED'
  ).length

  // --- Leaderboard (by converted count, 90 day) ---
  const leaderboard = Object.entries(conversionByRep)
    .filter(([id]) => id !== 'unassigned')
    .map(([, rep]) => rep)
    .sort((a, b) => b.converted - a.converted)
    .slice(0, 10)

  return NextResponse.json({
    teamPipeline: Object.values(teamPipeline).sort((a, b) => b.value - a.value),
    conversionByRep: Object.values(conversionByRep)
      .filter((r) => r.name !== 'Unassigned')
      .sort((a, b) => b.rate - a.rate),
    agingBuckets,
    sourceEffectiveness: Object.entries(sourceEffectiveness)
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.total - a.total),
    unassignedLeads,
    leaderboard,
  })
}
