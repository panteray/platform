import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

interface SyncItem {
  table: 'surveys' | 'survey_floor_plans' | 'survey_devices' | 'survey_infrastructure' | 'survey_photos'
  action: 'upsert' | 'delete'
  data: Record<string, unknown>
}

/** POST /api/org/surveys/:id/sync — batch sync from offline queue */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const items: SyncItem[] = body.items || []
  const admin = createAdminClient()

  // Verify survey ownership
  const { data: survey } = await admin
    .from('surveys')
    .select('id')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })

  const results: { index: number; ok: boolean; error?: string }[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    try {
      if (item.action === 'delete') {
        const { error } = await admin
          .from(item.table)
          .delete()
          .eq('id', item.data.id as string)
          .eq('org_id', dbUser.org_id)

        results.push({ index: i, ok: !error, error: error?.message })
      } else {
        // Upsert — ensure org_id is set
        const row = { ...item.data, org_id: dbUser.org_id }
        const { error } = await admin
          .from(item.table)
          .upsert(row, { onConflict: 'id' })

        results.push({ index: i, ok: !error, error: error?.message })
      }
    } catch (err) {
      results.push({ index: i, ok: false, error: String(err) })
    }
  }

  // Mark survey as synced
  await admin
    .from('surveys')
    .update({ synced: true, synced_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', dbUser.org_id)

  const failed = results.filter(r => !r.ok)
  return NextResponse.json({
    synced: results.filter(r => r.ok).length,
    failed: failed.length,
    errors: failed,
  })
}
