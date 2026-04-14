import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const category = url.searchParams.get('category')

  const admin = createAdminClient()
  let q = admin
    .from('contract_clauses')
    .select('*')
    .eq('org_id', caller.org_id)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })
  if (category) q = q.eq('category', category)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.name || !body.body_md) return NextResponse.json({ error: 'name and body_md required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('contract_clauses')
    .insert({
      org_id: caller.org_id,
      name: body.name,
      category: body.category ?? null,
      body_md: body.body_md,
      version: 1,
      created_by: caller.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
