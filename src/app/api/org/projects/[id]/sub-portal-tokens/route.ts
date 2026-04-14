import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.sub_id) return NextResponse.json({ error: 'sub_id required' }, { status: 400 })

  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sub_portal_tokens')
    .insert({
      org_id: dbUser.org_id,
      project_id: projectId,
      sub_id: body.sub_id,
      token,
      permissions: body.permissions ?? ['view'],
      expires_at: expiresAt,
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
