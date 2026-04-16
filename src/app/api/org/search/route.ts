import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

interface SearchResult {
  entity_type: string
  entity_id: string
  title: string
  subtitle?: string
  url: string
}

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ results: [] })

  const orgId = dbUser.org_id
  const admin = createAdminClient()
  const pattern = `%${q}%`

  const [
    oppsRes,
    projectsRes,
    customersRes,
    ticketsRes,
    assetsRes,
    subsRes,
  ] = await Promise.all([
    admin
      .from('opportunities')
      .select('id, opp_number, name, status')
      .eq('org_id', orgId)
      .or(`opp_number.ilike.${pattern},name.ilike.${pattern}`)
      .limit(5),
    admin
      .from('projects')
      .select('id, pn, name, status')
      .eq('org_id', orgId)
      .or(`pn.ilike.${pattern},name.ilike.${pattern}`)
      .limit(5),
    admin
      .from('customers')
      .select('id, company_name')
      .eq('org_id', orgId)
      .ilike('company_name', pattern)
      .limit(5),
    admin
      .from('psa_tickets')
      .select('id, title, status, priority')
      .eq('org_id', orgId)
      .ilike('title', pattern)
      .limit(5),
    admin
      .from('assets')
      .select('id, serial_number, label, status')
      .eq('org_id', orgId)
      .or(`serial_number.ilike.${pattern},label.ilike.${pattern}`)
      .limit(5),
    admin
      .from('subcontractors')
      .select('id, company_name, sub_number')
      .eq('org_id', orgId)
      .ilike('company_name', pattern)
      .limit(5),
  ])

  const results: SearchResult[] = []

  if (oppsRes.data) {
    for (const r of oppsRes.data) {
      results.push({
        entity_type: 'opportunity',
        entity_id: r.id,
        title: `${r.opp_number} — ${r.name}`,
        url: `/org/opportunities/${r.id}`,
      })
    }
  }

  if (projectsRes.data) {
    for (const r of projectsRes.data) {
      results.push({
        entity_type: 'project',
        entity_id: r.id,
        title: `${r.pn} — ${r.name}`,
        url: `/org/projects/${r.id}`,
      })
    }
  }

  if (customersRes.data) {
    for (const r of customersRes.data) {
      results.push({
        entity_type: 'customer',
        entity_id: r.id,
        title: r.company_name,
        url: `/org/customers/${r.id}`,
      })
    }
  }

  if (ticketsRes.data) {
    for (const r of ticketsRes.data) {
      results.push({
        entity_type: 'ticket',
        entity_id: r.id,
        title: r.title,
        subtitle: `${r.priority} · ${r.status}`,
        url: `/org/psa/tickets/${r.id}`,
      })
    }
  }

  if (assetsRes.data) {
    for (const r of assetsRes.data) {
      results.push({
        entity_type: 'asset',
        entity_id: r.id,
        title: r.label || r.serial_number,
        url: `/org/assets/${r.id}`,
      })
    }
  }

  if (subsRes.data) {
    for (const r of subsRes.data) {
      results.push({
        entity_type: 'subcontractor',
        entity_id: r.id,
        title: `${r.sub_number} — ${r.company_name}`,
        url: `/org/subcontractors/${r.id}`,
      })
    }
  }

  return NextResponse.json({ results })
}
