import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: subId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('sub_skill_matrix')
    .select('*')
    .eq('sub_id', subId)
    .eq('org_id', dbUser.org_id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: subId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  const allowed = [
    'technical_skills', 'soft_skills', 'certifications',
    'territory', 'approved_practices', 'notes',
  ]

  const data: Record<string, unknown> = {
    org_id: dbUser.org_id,
    sub_id: subId,
    last_updated_by: dbUser.id,
  }
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key]
  }

  // Upsert
  const { data: result, error } = await admin
    .from('sub_skill_matrix')
    .upsert(data, { onConflict: 'sub_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(result)
}
