import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDesignAccess } from '@/lib/auth'

export async function GET() {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Fetch designs (no embedded join — avoids FK schema issues)
  const { data: designs, error } = await admin
    .from('designs')
    .select('*')
    .eq('org_id', dbUser.org_id)
    .neq('status', 'ARCHIVED')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Batch-fetch linked opportunities
  const oppIds = (designs ?? [])
    .map((d) => d.opp_id)
    .filter((id): id is string => !!id)

  let oppMap: Record<string, Record<string, unknown>> = {}
  if (oppIds.length > 0) {
    const { data: opps } = await admin
      .from('opportunities')
      .select('id, opp_number, project_name, customer_name')
      .in('id', oppIds)

    if (opps) {
      oppMap = Object.fromEntries(opps.map((o) => [o.id, o]))
    }
  }

  // Merge opportunity data into designs
  const enriched = (designs ?? []).map((d) => ({
    ...d,
    opportunities: d.opp_id ? oppMap[d.opp_id] ?? null : null,
  }))

  return NextResponse.json({ designs: enriched })
}

export async function POST(req: NextRequest) {
  const dbUser = await verifyDesignAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const oppId = body.opp_id as string
  const name = (body.name as string)?.trim() || 'Untitled Design'

  if (!oppId) {
    return NextResponse.json({ error: 'opp_id is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify OPP belongs to org
  const { data: opp } = await admin
    .from('opportunities')
    .select('id, org_id')
    .eq('id', oppId)
    .single()

  if (!opp || opp.org_id !== dbUser.org_id) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  // Create design
  const { data: design, error: designErr } = await admin
    .from('designs')
    .insert({
      org_id: dbUser.org_id,
      opp_id: oppId,
      name,
      status: 'ACTIVE',
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (designErr) {
    return NextResponse.json({ error: designErr.message }, { status: 400 })
  }

  // Auto-create first area
  await admin
    .from('design_areas')
    .insert({
      design_id: design.id,
      org_id: dbUser.org_id,
      name: 'Area A',
      canvas_type: 'FLOOR_PLAN',
      sort_order: 0,
    })

  return NextResponse.json({ design }, { status: 201 })
}
