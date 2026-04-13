import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ floorId: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { floorId } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('floor_spaces').select('*').eq('floor_id', floorId).eq('org_id', user.org_id).order('name')
  return NextResponse.json({ spaces: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ floorId: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { floorId } = await params
  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('floor_spaces').insert({ floor_id: floorId, org_id: user.org_id, name: body.name || 'Room 1', space_type: body.space_type || 'room' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ space: data }, { status: 201 })
}
