import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOrgCRM } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  const { data, error } = await admin.from('opp_material_tracking').select('*').eq('opp_id', id).eq('org_id', caller.org_id).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('opp_material_tracking').insert({
    org_id: caller.org_id, opp_id: id,
    line_number: body.line_number ?? null, distributor_id: body.distributor_id ?? null,
    manufacturer_id: body.manufacturer_id ?? null, item_description: body.item_description ?? '',
    part_number: body.part_number ?? null, quantity: body.quantity ?? 1,
    unit_cost: body.unit_cost ?? null, extended_cost: body.extended_cost ?? null,
    order_number: body.order_number ?? null, tracking_number: body.tracking_number ?? null,
    carrier: body.carrier ?? null, ship_status: body.ship_status ?? 'NOT_ORDERED',
    date_ordered: body.date_ordered ?? null, estimated_delivery_date: body.estimated_delivery_date ?? null,
    actual_delivery_date: body.actual_delivery_date ?? null,
    ship_to_address: body.ship_to_address ?? null, ship_to_city: body.ship_to_city ?? null,
    ship_to_state: body.ship_to_state ?? null, ship_to_zip: body.ship_to_zip ?? null,
    warehouse_location: body.warehouse_location ?? null, notes: body.notes ?? null,
    created_by: caller.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const admin = createAdminClient()
  const update: Record<string, unknown> = {}
  const fields = ['line_number','distributor_id','manufacturer_id','item_description','part_number','quantity','unit_cost','extended_cost','order_number','tracking_number','carrier','ship_status','date_ordered','estimated_delivery_date','actual_delivery_date','ship_to_address','ship_to_city','ship_to_state','ship_to_zip','warehouse_location','notes']
  for (const f of fields) { if (body[f] !== undefined) update[f] = body[f] }
  const { data, error } = await admin.from('opp_material_tracking').update(update).eq('id', body.id).eq('org_id', caller.org_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const caller = await verifyOrgCRM()
  if (!caller) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const admin = createAdminClient()
  const { error } = await admin.from('opp_material_tracking').delete().eq('id', id).eq('org_id', caller.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
