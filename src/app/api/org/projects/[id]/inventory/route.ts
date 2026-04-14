import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('inventory_txns')
    .select('*, user:users!inventory_txns_user_id_fkey(id, first_name, last_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const itemDescription = (body.item_description as string)?.trim()
  const type = body.type as string
  if (!itemDescription) return NextResponse.json({ error: 'item_description required' }, { status: 400 })
  if (type !== 'DEBIT' && type !== 'CREDIT') {
    return NextResponse.json({ error: 'type must be DEBIT or CREDIT' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: project } = await admin
    .from('projects').select('id').eq('id', projectId).eq('org_id', dbUser.org_id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    user_id: dbUser.id,
    item_description: itemDescription,
    type,
    quantity: (body.quantity as number) || 1,
  }
  if (body.part_number !== undefined) insert.part_number = body.part_number
  if (body.notes !== undefined) insert.notes = body.notes

  const { data, error } = await admin.from('inventory_txns').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
