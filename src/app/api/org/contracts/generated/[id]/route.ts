import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

const ALLOWED = ['title', 'content', 'variables', 'status', 'expires_at', 'opp_id', 'project_id'] as const

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('generated_contracts')
    .select('*, customer:customers(id,name,contact_name,contact_email), template:contract_templates(id,name,type)')
    .eq('id', id)
    .eq('org_id', caller.org_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const update: Record<string, unknown> = {}
  for (const k of ALLOWED) if (k in body) update[k] = body[k]

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('generated_contracts')
    .update(update)
    .eq('id', id)
    .eq('org_id', caller.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('generated_contracts')
    .select('status')
    .eq('id', id)
    .eq('org_id', caller.org_id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only DRAFT contracts can be deleted' }, { status: 400 })
  }

  const { error } = await admin
    .from('generated_contracts')
    .delete()
    .eq('id', id)
    .eq('org_id', caller.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
