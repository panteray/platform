import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: designId } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('software_quotes').select('*').eq('design_id', designId).order('version', { ascending: false })
  return NextResponse.json({ quotes: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: designId } = await params
  const body = await req.json()
  const admin = createAdminClient()

  // Get next version
  const { data: existing } = await admin.from('software_quotes').select('version')
    .eq('design_id', designId).order('version', { ascending: false }).limit(1)
  const nextVersion = (existing?.[0]?.version ?? 0) + 1

  const { data, error } = await admin.from('software_quotes').insert({
    design_id: designId,
    org_id: user.org_id,
    version: nextVersion,
    status: body.status || 'draft',
    contract_term_months: body.contract_term_months || 12,
    yearly_increase_pct: body.yearly_increase_pct || 3,
    onboarding_fee: body.onboarding_fee || 0,
    markup_pct: body.markup_pct || 0,
    mrr: body.mrr || 0,
    tcv: body.tcv || 0,
    customer_notes: body.customer_notes || null,
    line_items: body.line_items || [],
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ quote: data }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.quote_id) return NextResponse.json({ error: 'quote_id required' }, { status: 400 })
  const admin = createAdminClient()
  const allowed: Record<string, unknown> = {}
  for (const f of ['status', 'customer_notes', 'submitted_at', 'approved_at']) {
    if (body[f] !== undefined) allowed[f] = body[f]
  }
  const { data, error } = await admin.from('software_quotes').update(allowed).eq('id', body.quote_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quote: data })
}
