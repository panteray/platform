import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyLeadRead } from '@/lib/auth'

export async function GET() {
  const caller = await verifyLeadRead()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const orgId = caller.org_id

  // Fetch all leads for this org
  const { data: leads } = await admin
    .from('leads')
    .select('id, status, priority, source, estimated_value, created_at, assigned_to')
    .eq('org_id', orgId)

  if (!leads) return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })

  // Funnel counts by status
  const funnel: Record<string, number> = {}
  for (const l of leads) {
    funnel[l.status] = (funnel[l.status] ?? 0) + 1
  }

  // Pipeline value (non-archived, non-converted)
  const activePipeline = leads.filter((l) => l.status !== 'ARCHIVED' && l.status !== 'CONVERTED')
  const pipelineValue = activePipeline.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0)

  // Hot leads count
  const hotLeads = leads.filter((l) => l.priority === 'HOT' && l.status !== 'ARCHIVED' && l.status !== 'CONVERTED').length

  // Conversion rate (last 90 days)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const recentLeads = leads.filter((l) => new Date(l.created_at) >= ninetyDaysAgo)
  const recentConverted = recentLeads.filter((l) => l.status === 'CONVERTED').length
  const conversionRate = recentLeads.length > 0 ? Math.round((recentConverted / recentLeads.length) * 100) : 0

  // Source breakdown
  const bySource: Record<string, number> = {}
  for (const l of leads) {
    if (l.source) bySource[l.source] = (bySource[l.source] ?? 0) + 1
  }

  // Overdue follow-ups
  const { data: overdue } = await admin
    .from('lead_interactions')
    .select('id, lead_id, follow_up_date, follow_up_note')
    .eq('org_id', orgId)
    .lt('follow_up_date', new Date().toISOString())
    .not('follow_up_date', 'is', null)
    .order('follow_up_date', { ascending: true })
    .limit(20)

  // Upcoming meetings (next 7 days)
  const now = new Date()
  const sevenDays = new Date()
  sevenDays.setDate(sevenDays.getDate() + 7)
  const { data: upcomingMeetings } = await admin
    .from('lead_meetings')
    .select('id, lead_id, title, start_time, location')
    .eq('org_id', orgId)
    .gte('start_time', now.toISOString())
    .lte('start_time', sevenDays.toISOString())
    .order('start_time', { ascending: true })
    .limit(10)

  // Recent activity (last 10 interactions)
  const { data: recentActivity } = await admin
    .from('lead_interactions')
    .select('id, lead_id, type, subject, interaction_date, created_by')
    .eq('org_id', orgId)
    .order('interaction_date', { ascending: false })
    .limit(10)

  return NextResponse.json({
    total: leads.length,
    funnel,
    pipelineValue,
    hotLeads,
    conversionRate,
    bySource,
    overdueFollowUps: overdue ?? [],
    upcomingMeetings: upcomingMeetings ?? [],
    recentActivity: recentActivity ?? [],
  })
}
