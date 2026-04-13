import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ buildingId: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { buildingId } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('building_floors').select('*').eq('building_id', buildingId).eq('org_id', user.org_id).order('floor_number')
  return NextResponse.json({ floors: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ buildingId: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { buildingId } = await params
  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('building_floors').insert({ building_id: buildingId, org_id: user.org_id, name: body.name || 'Floor 1', floor_number: body.floor_number || 1 }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ floor: data }, { status: 201 })
}
