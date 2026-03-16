import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const areaId = request.nextUrl.searchParams.get('area_id')
  const admin = createAdminClient()

  const { data: design } = await admin.from('designs').select('id').eq('id', designId).eq('org_id', user.org_id).single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  let query = admin.from('design_topology_links').select('*').eq('design_id', designId).order('created_at', { ascending: true })
  

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ links: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const { data: design } = await admin.from('designs').select('id').eq('id', designId).eq('org_id', user.org_id).single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  const { data, error } = await admin.from('design_topology_links').insert({ ...body, design_id: designId }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const itemId = request.nextUrl.searchParams.get('link_id')
  if (!itemId) return NextResponse.json({ error: 'link_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: design } = await admin.from('designs').select('id').eq('id', designId).eq('org_id', user.org_id).single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  const { error } = await admin.from('design_topology_links').delete().eq('id', itemId).eq('design_id', designId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
