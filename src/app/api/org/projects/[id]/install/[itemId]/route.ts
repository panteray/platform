import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, itemId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  const allowed = [
    'label', 'category', 'description', 'vendor', 'model', 'quantity',
    'status', 'installed_by', 'installed_at', 'serial_number', 'mac_address',
    'deviation_type', 'deviation_note', 'deviation_ai_analysis',
    'position_x', 'position_y', 'photos', 'area_id',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  // Auto-set installed_at when status changes to installed
  if (update.status === 'installed' && !update.installed_at) {
    update.installed_at = new Date().toISOString()
  }
  // Auto-set installed_by to caller if not provided
  if (update.status === 'installed' && !update.installed_by) {
    update.installed_by = dbUser.id
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('install_items')
    .update(update)
    .eq('id', itemId)
    .eq('project_id', projectId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, itemId } = await params
  const admin = createAdminClient()

  const { error } = await admin
    .from('install_items')
    .delete()
    .eq('id', itemId)
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
