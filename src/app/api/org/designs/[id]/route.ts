import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDesignAccess } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const admin = createAdminClient()

  // Fetch design (no embedded join — avoids FK schema issues)
  const { data: design, error } = await admin
    .from('designs')
    .select('*')
    .eq('id', id)
    .eq('org_id', dbUser.org_id)
    .single()

  if (error || !design) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })
  }

  // Fetch linked opportunity separately if opp_id exists
  let opportunities: Record<string, unknown> | null = null
  if (design.opp_id) {
    const { data: opp } = await admin
      .from('opportunities')
      .select('id, opp_number, project_name, customer_name, install_address, state')
      .eq('id', design.opp_id)
      .single()
    opportunities = opp
  }

  // Fetch areas for this design
  const { data: areas } = await admin
    .from('design_areas')
    .select('*')
    .eq('design_id', id)
    .order('sort_order', { ascending: true })

  return NextResponse.json({
    design: { ...design, opportunities },
    areas: areas ?? [],
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('designs')
    .select('id, org_id')
    .eq('id', id)
    .single()

  if (!existing || existing.org_id !== dbUser.org_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const allowed = ['name', 'status', 'opp_id']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error: updateErr } = await admin
    .from('designs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 })
  }

  return NextResponse.json({ design: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const admin = createAdminClient()

  const { error } = await admin
    .from('designs')
    .update({ status: 'ARCHIVED', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', dbUser.org_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ archived: true })
}
