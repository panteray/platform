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

  // Verify project belongs to user's org
  const { data: project } = await admin.from('projects').select('id').eq('id', projectId).eq('org_id', dbUser.org_id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { data, error } = await admin
    .from('project_team')
    .select('*, users(id, first_name, last_name, email, role, avatar_url)')
    .eq('project_id', projectId)
    .order('added_at', { ascending: true })

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

  const userId = body.user_id as string
  const role = body.role as string
  if (!userId || !role) return NextResponse.json({ error: 'user_id and role required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: project } = await admin
    .from('projects').select('id').eq('id', projectId).eq('org_id', dbUser.org_id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { data, error } = await admin
    .from('project_team')
    .insert({
      org_id: dbUser.org_id,
      project_id: projectId,
      user_id: userId,
      role,
    })
    .select('*, users(id, first_name, last_name, email, role, avatar_url)')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'User already on team' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const memberId = req.nextUrl.searchParams.get('member_id')
  if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('project_team')
    .delete()
    .eq('id', memberId)
    .eq('project_id', projectId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
