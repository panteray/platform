import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const { id: projectId } = await params
  const admin = createAdminClient()

  // Fetch project with related data
  const { data: project } = await admin
    .from('projects')
    .select('*, customer:customers!projects_customer_id_fkey(name)')
    .eq('id', projectId)
    .eq('org_id', dbUser.org_id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Fetch install items for context
  const { data: installItems } = await admin
    .from('install_items')
    .select('label, category, status, vendor, model')
    .eq('project_id', projectId)
    .limit(50)

  // Fetch recent daily reports for context
  const { data: recentReports } = await admin
    .from('daily_reports')
    .select('report_date, summary, safety_notes')
    .eq('project_id', projectId)
    .order('report_date', { ascending: false })
    .limit(3)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* empty body is ok */ }

  const weather = (body.weather as string) || 'Unknown'
  const crewCount = (body.crew_count as number) || 0

  const totalItems = installItems?.length ?? 0
  const installedItems = installItems?.filter(i => i.status === 'installed').length ?? 0
  const deviationItems = installItems?.filter(i => i.status === 'deviation').length ?? 0
  const categories = [...new Set(installItems?.map(i => i.category).filter(Boolean) ?? [])]

  const prompt = `You are a field operations safety and briefing assistant for a physical security integration company.

Generate a concise daily tailgate safety briefing for a field crew.

Project: ${project.name} (${project.pn})
Customer: ${(project.customer as { name: string } | null)?.name ?? 'N/A'}
Location: ${[project.site_address, project.site_city, project.site_state].filter(Boolean).join(', ') || 'N/A'}
Weather: ${weather}
Crew Size: ${crewCount}
Risk Level: ${project.risk_level ?? 'LOW'}

Install Progress: ${installedItems}/${totalItems} items installed${deviationItems > 0 ? `, ${deviationItems} deviations` : ''}
Systems: ${categories.join(', ') || 'N/A'}

${recentReports && recentReports.length > 0 ? `Recent Safety Notes:\n${recentReports.map(r => `- ${r.report_date}: ${r.safety_notes || r.summary || 'No notes'}`).join('\n')}` : 'No recent safety notes.'}

Generate a structured briefing with:
1. **Safety Focus** (2-3 key safety items based on weather, work type, and any recent issues)
2. **Today's Priority** (what the crew should focus on based on install progress)
3. **Hazard Watch** (specific hazards for the work type — ladder safety, electrical, confined space, etc.)
4. **PPE Reminder** (required PPE for the day's work)

Keep it conversational but professional. Under 300 words. No markdown headers — use plain text with bullet points.`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    return NextResponse.json({ error: `AI API error: ${errText}` }, { status: 502 })
  }

  const result = await resp.json()
  const briefing = result.content?.[0]?.text ?? 'Unable to generate briefing.'

  return NextResponse.json({ briefing, generated_at: new Date().toISOString() })
}
