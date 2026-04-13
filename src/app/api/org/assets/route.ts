import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const customerId = req.nextUrl.searchParams.get('customer_id')
  const siteId = req.nextUrl.searchParams.get('site_id')
  const admin = createAdminClient()
  let query = admin.from('asset_registry').select('*').eq('org_id', user.org_id)
  if (customerId) query = query.eq('customer_id', customerId)
  if (siteId) query = query.eq('site_id', siteId)
  const { data } = await query.order('created_at', { ascending: false }).limit(500)
  return NextResponse.json({ assets: data ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('asset_registry').insert({
    org_id: user.org_id, ...body,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ asset: data }, { status: 201 })
}
