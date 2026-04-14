import { NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const in90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Totals by status
  const { data: statusCounts } = await admin
    .from('assets')
    .select('status')
    .eq('org_id', dbUser.org_id)

  const byStatus: Record<string, number> = {}
  for (const a of statusCounts ?? []) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
  }

  // Warranty expiring within 90 days
  const { data: warrantyExpiring } = await admin
    .from('assets')
    .select('id, label, vendor, model, warranty_expires_at, customer:customers(id, name)')
    .eq('org_id', dbUser.org_id)
    .gte('warranty_expires_at', today)
    .lte('warranty_expires_at', in90)
    .order('warranty_expires_at', { ascending: true })
    .limit(50)

  // Warranty already expired
  const { count: warrantyExpired } = await admin
    .from('assets')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', dbUser.org_id)
    .lt('warranty_expires_at', today)

  // Upcoming maintenance (next 30 days, not completed)
  const { data: upcomingMaintenance } = await admin
    .from('asset_maintenance')
    .select('id, type, scheduled_at, asset:assets(id, label, vendor, model)')
    .eq('org_id', dbUser.org_id)
    .is('completed_at', null)
    .gte('scheduled_at', today)
    .lte('scheduled_at', in30)
    .order('scheduled_at', { ascending: true })
    .limit(50)

  // Overdue maintenance
  const { data: overdueMaintenance } = await admin
    .from('asset_maintenance')
    .select('id, type, scheduled_at, asset:assets(id, label, vendor, model)')
    .eq('org_id', dbUser.org_id)
    .is('completed_at', null)
    .lt('scheduled_at', today)
    .order('scheduled_at', { ascending: true })
    .limit(50)

  // Recent lifecycle events
  const { data: recentEvents } = await admin
    .from('asset_lifecycle_events')
    .select('id, event_type, event_at, details, asset:assets(id, label)')
    .eq('org_id', dbUser.org_id)
    .order('event_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    totals: {
      total: statusCounts?.length ?? 0,
      by_status: byStatus,
      warranty_expired: warrantyExpired ?? 0,
      warranty_expiring_90d: warrantyExpiring?.length ?? 0,
      upcoming_maintenance_30d: upcomingMaintenance?.length ?? 0,
      overdue_maintenance: overdueMaintenance?.length ?? 0,
    },
    warranty_expiring: warrantyExpiring ?? [],
    upcoming_maintenance: upcomingMaintenance ?? [],
    overdue_maintenance: overdueMaintenance ?? [],
    recent_events: recentEvents ?? [],
  })
}
