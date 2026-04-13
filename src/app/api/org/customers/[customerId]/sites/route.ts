import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { customerId } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('customer_sites').select('*').eq('customer_id', customerId).eq('org_id', user.org_id).order('name')
  return NextResponse.json({ sites: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { customerId } = await params
  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('customer_sites').insert({ customer_id: customerId, org_id: user.org_id, name: body.name || 'New Site', address: body.address, city: body.city, state: body.state, zip: body.zip }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ site: data }, { status: 201 })
}
