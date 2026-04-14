import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const status = req.nextUrl.searchParams.get('status')
  const oppId = req.nextUrl.searchParams.get('opp_id')

  let query = admin
    .from('projects')
    .select('*, pm:users!projects_pm_id_fkey(id, first_name, last_name, email), customer:customers!projects_customer_id_fkey(id, name)')
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (oppId) query = query.eq('opp_id', oppId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const admin = createAdminClient()

  const insert: Record<string, unknown> = {
    org_id: dbUser.org_id,
    name,
    created_by: dbUser.id,
  }

  const allowed = [
    'opp_id', 'pm_id', 'status', 'site_address', 'site_city', 'site_state',
    'site_zip', 'site_notes', 'start_date', 'target_end_date', 'budget_amount',
    'customer_id', 'risk_score', 'risk_level', 'contingency_pct',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) insert[key] = body[key]
  }

  const { data, error } = await admin
    .from('projects')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const projectId = data.id
  let installItemCount = 0

  // If created from an opportunity, copy hardware schedule → install_items
  if (body.opp_id) {
    // Find the design linked to this opportunity
    const { data: designs } = await admin
      .from('designs')
      .select('id')
      .eq('opp_id', body.opp_id as string)
      .eq('org_id', dbUser.org_id)
      .limit(1)

    const designId = designs?.[0]?.id
    if (designId) {
      // Fetch all design devices (the hardware schedule source)
      const { data: devices } = await admin
        .from('design_devices')
        .select('id, label, category, area_id, position_x, position_y, mount_type, properties, status')
        .eq('design_id', designId)
        .order('created_at', { ascending: true })

      if (devices && devices.length > 0) {
        const installRows = devices.map((d, idx) => {
          const props = (d.properties ?? {}) as Record<string, unknown>
          return {
            org_id: dbUser.org_id,
            project_id: projectId,
            device_id: d.id,
            area_id: d.area_id,
            hw_schedule_line: idx + 1,
            label: d.label,
            category: d.category,
            description: `${d.label} — ${String(props.manufacturer ?? '')} ${String(props.model ?? '')}`.trim(),
            vendor: String(props.manufacturer ?? props.vendor ?? '') || null,
            model: String(props.model ?? '') || null,
            quantity: 1,
            status: 'planned',
            position_x: d.position_x,
            position_y: d.position_y,
          }
        })

        const { data: inserted } = await admin.from('install_items').insert(installRows).select('id')
        installItemCount = inserted?.length ?? 0
      }
    }

    // Audit log
    await admin.from('audit_log').insert({
      org_id: dbUser.org_id,
      user_id: dbUser.id,
      action: 'project_created',
      entity_type: 'project',
      entity_id: projectId,
      details: { opp_id: body.opp_id, project_name: name, install_items_created: installItemCount },
    }).single()
  }

  // Create project_team entries if team array provided
  const team = body.team as Array<{ user_id: string; role: string }> | undefined
  if (team && Array.isArray(team) && team.length > 0) {
    const teamRows = team
      .filter(t => t.user_id && t.role)
      .map(t => ({
        org_id: dbUser.org_id,
        project_id: projectId,
        user_id: t.user_id,
        role: t.role,
      }))
    if (teamRows.length > 0) {
      await admin.from('project_team').insert(teamRows)
    }
  }

  // Also add PM to team if pm_id was provided and not already in team array
  if (insert.pm_id) {
    const pmInTeam = team?.some(t => t.user_id === insert.pm_id && t.role === 'PM')
    if (!pmInTeam) {
      await admin.from('project_team').insert({
        org_id: dbUser.org_id,
        project_id: projectId,
        user_id: insert.pm_id as string,
        role: 'PM',
      })
    }
  }

  return NextResponse.json({ ...data, install_items_created: installItemCount }, { status: 201 })
}
