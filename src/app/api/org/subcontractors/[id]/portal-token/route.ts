import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'
import { randomBytes } from 'crypto'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sub_portal_tokens')
    .select('*, project:projects(id, pn, name)')
    .eq('sub_id', id)
    .eq('org_id', caller.org_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const expiresAt = body.expires_at as string | undefined
    ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
  const token = randomBytes(32).toString('hex')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sub_portal_tokens')
    .insert({
      org_id: caller.org_id,
      sub_id: id,
      project_id: body.project_id,
      token,
      permissions: body.permissions ?? ['view', 'upload', 'invoice'],
      expires_at: expiresAt,
      created_by: caller.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
