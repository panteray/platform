import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const customerId = req.nextUrl.searchParams.get('customer_id')
  const assetId = req.nextUrl.searchParams.get('asset_id')
  const status = req.nextUrl.searchParams.get('status')
  const admin = createAdminClient()
  let query = admin.from('service_tickets').select('*').eq('org_id', user.org_id)
  if (customerId) query = query.eq('customer_id', customerId)
  if (assetId) query = query.eq('asset_id', assetId)
  if (status) query = query.eq('status', status)
  const { data } = await query.order('created_at', { ascending: false }).limit(200)
  return NextResponse.json({ tickets: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('service_tickets').insert({
    org_id: user.org_id, ...body,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ticket: data }, { status: 201 })
}
