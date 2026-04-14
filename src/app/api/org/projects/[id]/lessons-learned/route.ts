import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('lessons_learned')
    .select('*, author:users!lessons_learned_created_by_fkey(id, first_name, last_name)')
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const what = (body.what_happened as string)?.trim()
  const practice = (body.practice_area as string)?.trim()
  const issueCat = (body.issue_category as string)?.trim()
  if (!what || !practice || !issueCat) {
    return NextResponse.json({ error: 'what_happened, practice_area, and issue_category are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    what_happened: what,
    practice_area: practice,
    issue_category: issueCat,
    created_by: dbUser.id,
  }

  const allowed = ['subcategory', 'impact', 'recommendation', 'severity', 'status', 'notes']
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('lessons_learned')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const itemId = req.nextUrl.searchParams.get('item_id')
  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const allowed = [
    'practice_area', 'issue_category', 'subcategory', 'what_happened',
    'impact', 'recommendation', 'severity', 'status',
  ]

  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  if (body.status === 'reviewed') {
    update.reviewed_by = dbUser.id
    update.reviewed_at = new Date().toISOString()
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lessons_learned')
    .update(update)
    .eq('id', itemId)
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
