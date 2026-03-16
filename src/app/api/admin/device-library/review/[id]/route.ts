import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyGlobalAdmin } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyGlobalAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Global admin only' }, { status: 403 })
  }

  const { id: contribId } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = body.action as string
  if (!['approved', 'rejected', 'merged'].includes(action)) {
    return NextResponse.json({ error: 'action must be approved, rejected, or merged' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch contribution
  const { data: contrib } = await admin
    .from('device_library_contributions')
    .select('*, device_library_items ( id, org_id, vendor, model, partnumber, category, subcategory, resolution, fps, poe_standard, wattage, ndaa_compliant, specs )')
    .eq('id', contribId)
    .single()

  if (!contrib) {
    return NextResponse.json({ error: 'Contribution not found' }, { status: 404 })
  }

  if (contrib.status !== 'pending_review') {
    return NextResponse.json({ error: 'Contribution already reviewed' }, { status: 400 })
  }

  // Get admin user ID for reviewed_by
  const { data: adminUser } = await admin
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  const reviewedBy = adminUser?.id ?? null
  const reviewNotes = (body.review_notes as string) ?? null

  if (action === 'approved') {
    // Clone the org item as a global item (org_id = NULL)
    const item = contrib.device_library_items as Record<string, unknown>
    if (item) {
      await admin.from('device_library_items').insert({
        org_id: null, // Global
        vendor: item.vendor,
        model: item.model,
        partnumber: item.partnumber,
        category: item.category,
        subcategory: item.subcategory,
        resolution: item.resolution,
        fps: item.fps,
        poe_standard: item.poe_standard,
        wattage: item.wattage,
        ndaa_compliant: item.ndaa_compliant,
        specs: item.specs ?? {},
      })
    }

    await admin
      .from('device_library_contributions')
      .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      })
      .eq('id', contribId)

    return NextResponse.json({ status: 'approved' })
  }

  if (action === 'rejected') {
    if (!reviewNotes) {
      return NextResponse.json({ error: 'review_notes required for rejection' }, { status: 400 })
    }

    await admin
      .from('device_library_contributions')
      .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      })
      .eq('id', contribId)

    return NextResponse.json({ status: 'rejected' })
  }

  if (action === 'merged') {
    const mergedIntoId = body.merged_into_id as string
    if (!mergedIntoId) {
      return NextResponse.json({ error: 'merged_into_id required for merge action' }, { status: 400 })
    }

    // Verify target exists and is global
    const { data: target } = await admin
      .from('device_library_items')
      .select('id, org_id')
      .eq('id', mergedIntoId)
      .single()

    if (!target || target.org_id !== null) {
      return NextResponse.json({ error: 'Merge target must be a global item' }, { status: 400 })
    }

    await admin
      .from('device_library_contributions')
      .update({
        status: 'merged',
        merged_into_id: mergedIntoId,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      })
      .eq('id', contribId)

    return NextResponse.json({ status: 'merged' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
