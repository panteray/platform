import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const CATEGORIES = ['technical', 'schedule', 'cost', 'scope', 'team'] as const

type Mitigation = { residual?: number; strategy?: string; action?: string; owner_id?: string }
type Score = { probability: number; impact: number; score: number; notes: string }

function computeTotals(body: Record<string, unknown>): { total: number; residual: number; level: string } {
  let total = 0
  let residual = 0
  for (const cat of CATEGORIES) {
    const score = body[cat] as Score | undefined
    if (score && typeof score === 'object') {
      const s = (score.probability ?? 0) * (score.impact ?? 0)
      total += s
    }
    const mit = body[`${cat}_mitigation`] as Mitigation | undefined
    if (mit && mit.residual != null) {
      residual += mit.residual
    } else {
      residual += (score?.probability ?? 0) * (score?.impact ?? 0)
    }
  }
  // Max possible = 5 cats × 25 = 125
  const pct = (total / 125) * 100
  let level: string = 'low'
  if (pct >= 70) level = 'critical'
  else if (pct >= 50) level = 'high'
  else if (pct >= 25) level = 'medium'
  return { total, residual, level }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('risk_assessments')
    .select('*')
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const totals = computeTotals(body)
  const admin = createAdminClient()

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    project_id: projectId,
    created_by: dbUser.id,
    total_risk_score: totals.total,
    residual_risk_score: totals.residual,
    overall_risk_level: totals.level,
  }

  const allowed = [
    'status', 'technical', 'schedule', 'cost', 'scope', 'team',
    'technical_mitigation', 'schedule_mitigation', 'cost_mitigation',
    'scope_mitigation', 'team_mitigation',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('risk_assessments')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Roll up to projects.risk_score
  await admin
    .from('projects')
    .update({ risk_score: totals.total, risk_level: totals.level })
    .eq('id', projectId)
    .eq('org_id', dbUser.org_id)

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const raId = req.nextUrl.searchParams.get('ra_id')
  if (!raId) return NextResponse.json({ error: 'ra_id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const admin = createAdminClient()

  // Fetch current to merge for total recalc
  const { data: current } = await admin
    .from('risk_assessments')
    .select('*')
    .eq('id', raId)
    .eq('org_id', dbUser.org_id)
    .single()

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const merged = { ...current, ...body }
  const totals = computeTotals(merged)

  const updateAllowed = [
    'status', 'technical', 'schedule', 'cost', 'scope', 'team',
    'technical_mitigation', 'schedule_mitigation', 'cost_mitigation',
    'scope_mitigation', 'team_mitigation', 'approved_by', 'approved_at',
  ]

  const update: Record<string, unknown> = {
    total_risk_score: totals.total,
    residual_risk_score: totals.residual,
    overall_risk_level: totals.level,
  }
  for (const key of updateAllowed) {
    if (body[key] !== undefined) update[key] = body[key]
  }

  const { data, error } = await admin
    .from('risk_assessments')
    .update(update)
    .eq('id', raId)
    .eq('project_id', projectId)
    .eq('org_id', dbUser.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Roll up
  await admin
    .from('projects')
    .update({ risk_score: totals.total, risk_level: totals.level })
    .eq('id', projectId)
    .eq('org_id', dbUser.org_id)

  return NextResponse.json(data)
}
