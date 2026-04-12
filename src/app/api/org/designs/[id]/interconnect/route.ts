import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: designId } = await params
  const admin = createAdminClient()
  const { data: nodes } = await admin.from('interconnect_nodes').select('*').eq('design_id', designId).order('created_at')
  const { data: links } = await admin.from('interconnect_links').select('*').eq('design_id', designId).order('created_at')
  return NextResponse.json({ nodes: nodes ?? [], links: links ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: designId } = await params
  const body = await req.json()
  const admin = createAdminClient()
  const table = body.from_node_id ? 'interconnect_links' : 'interconnect_nodes'
  const key = body.from_node_id ? 'link' : 'node'
  const { data, error } = await admin.from(table).insert({ ...body, design_id: designId }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ [key]: data }, { status: 201 })
}
