import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  // Get SOS + gate status
  const [sosRes, installRes, coRes, qcRes] = await Promise.all([
    admin.from('sign_off_sheets').select('*').eq('project_id', projectId).eq('org_id', dbUser.org_id).order('created_at', { ascending: false }).limit(1),
    admin.from('install_items').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
    admin.from('change_orders').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id).neq('status', 'closed'),
    admin.from('qc_checklists').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
  ])

  const items = installRes.data ?? []
  const allInstalled = items.length > 0 && items.every(i => i.status === 'installed' || i.status === 'deviation')
  const openCOs = (coRes.data ?? []).length
  const qcLists = qcRes.data ?? []
  const allQcPassed = qcLists.length > 0 && qcLists.every(q => q.status === 'approved')

  return NextResponse.json({
    sos: sosRes.data?.[0] ?? null,
    gates: {
      install_complete: allInstalled,
      all_co_closed: openCOs === 0,
      qc_passed: allQcPassed,
      install_count: items.length,
      installed_count: items.filter(i => i.status === 'installed' || i.status === 'deviation').length,
      open_co_count: openCOs,
      qc_count: qcLists.length,
      qc_approved_count: qcLists.filter(q => q.status === 'approved').length,
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Verify gates
  const [installRes, coRes, qcRes] = await Promise.all([
    admin.from('install_items').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
    admin.from('change_orders').select('id').eq('project_id', projectId).eq('org_id', dbUser.org_id).neq('status', 'closed'),
    admin.from('qc_checklists').select('id, status').eq('project_id', projectId).eq('org_id', dbUser.org_id),
  ])

  const items = installRes.data ?? []
  const allInstalled = items.length > 0 && items.every(i => i.status === 'installed' || i.status === 'deviation')
  const openCOs = (coRes.data ?? []).length
  const qcLists = qcRes.data ?? []
  const allQcPassed = qcLists.length === 0 || qcLists.every(q => q.status === 'approved')

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    created_by: dbUser.id,
    gate_install_complete: allInstalled,
    gate_co_closed: openCOs === 0,
    gate_qc_passed: allQcPassed,
  }

  const allowed = [
    'scope_summary', 'customer_name', 'customer_title', 'customer_sig_data',
    'customer_signed_at', 'sub_name', 'sub_sig_data', 'sub_signed_at',
    'pm_name', 'pm_sig_data', 'pm_signed_at', 'status', 'notes', 'photos',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('sign_off_sheets')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create assets from installed install_items (Phase 5 — Asset Intelligence)
  // Only runs when SOS is signed (customer + pm signatures) AND all gates pass.
  const isSigned = !!(insert.customer_sig_data && insert.pm_sig_data)
  if (isSigned && allInstalled && openCOs === 0 && allQcPassed) {
    // Load full install items + project to build assets
    const { data: fullItems } = await admin
      .from('install_items')
      .select('id, device_id, area_id, label, category, vendor, model, serial_number, mac_address, installed_at, position_x, position_y, photos')
      .eq('project_id', projectId)
      .eq('org_id', dbUser.org_id)
      .in('status', ['installed', 'deviation'])

    const { data: project } = await admin
      .from('projects')
      .select('customer_id')
      .eq('id', projectId)
      .single()

    // Skip any install_item that already has an asset record
    const { data: existingAssets } = await admin
      .from('assets')
      .select('install_item_id')
      .eq('project_id', projectId)
      .eq('org_id', dbUser.org_id)
      .not('install_item_id', 'is', null)

    const alreadyAssetized = new Set((existingAssets ?? []).map(a => a.install_item_id as string))
    const toCreate = (fullItems ?? []).filter(i => !alreadyAssetized.has(i.id))

    if (toCreate.length > 0) {
      const assetRows = toCreate.map(i => ({
        org_id: dbUser.org_id,
        project_id: projectId,
        install_item_id: i.id,
        device_id: i.device_id,
        customer_id: project?.customer_id ?? null,
        label: i.label,
        category: i.category,
        vendor: i.vendor,
        model: i.model,
        serial_number: i.serial_number,
        mac_address: i.mac_address,
        status: 'active',
        install_date: i.installed_at,
        position_x: i.position_x,
        position_y: i.position_y,
        photos: i.photos,
        created_by: dbUser.id,
      }))

      const { data: newAssets } = await admin
        .from('assets')
        .insert(assetRows)
        .select('id')

      // Lifecycle event per asset
      if (newAssets && newAssets.length > 0) {
        await admin.from('asset_lifecycle_events').insert(
          newAssets.map(a => ({
            org_id: dbUser.org_id,
            asset_id: a.id,
            event_type: 'installed',
            details: { source: 'project_closeout', project_id: projectId, sos_id: data.id },
            user_id: dbUser.id,
          }))
        )
      }
    }
  }

  return NextResponse.json(data, { status: 201 })
}
