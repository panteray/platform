import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  const { data, error } = await admin.from('opp_distributors').select('*, distributors(id, name, distributor_number)').eq('opp_id', id).eq('org_id', caller.org_id).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('opp_distributors').insert({
    org_id: caller.org_id, opp_id: id, distributor_id: body.distributor_id,
    quote_number: body.quote_number ?? null, quote_date: body.quote_date ?? null,
    quote_amount: body.quote_amount ?? null, status: body.status ?? 'QUOTING',
    notes: body.notes ?? null, created_by: caller.id,
  }).select('*, distributors(id, name, distributor_number)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const admin = createAdminClient()
  const { error } = await admin.from('opp_distributors').delete().eq('id', id).eq('org_id', caller.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
