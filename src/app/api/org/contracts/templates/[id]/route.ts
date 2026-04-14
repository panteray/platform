import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

const ALLOWED = ['name', 'type', 'status', 'body_md', 'variables', 'version'] as const

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const admin = createAdminClient()
  const [tplRes, clausesRes] = await Promise.all([
    admin
      .from('contract_templates')
      .select('*')
      .eq('id', id)
      .eq('org_id', caller.org_id)
      .single(),
    admin
      .from('contract_template_clauses')
      .select('*, clause:contract_clauses(*)')
      .eq('template_id', id)
      .order('display_order', { ascending: true }),
  ])

  if (tplRes.error) return NextResponse.json({ error: tplRes.error.message }, { status: 404 })
  return NextResponse.json({ ...tplRes.data, clauses: clausesRes.data ?? [] })
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
    .from('contract_templates')
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
  const { error } = await admin
    .from('contract_templates')
    .delete()
    .eq('id', id)
    .eq('org_id', caller.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
