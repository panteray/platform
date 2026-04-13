import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { siteId } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('site_buildings').select('*').eq('site_id', siteId).eq('org_id', user.org_id).order('name')
  return NextResponse.json({ buildings: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { siteId } = await params
  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('site_buildings').insert({ site_id: siteId, org_id: user.org_id, name: body.name || 'New Building', building_type: body.building_type || 'commercial' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ building: data }, { status: 201 })
}
