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
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const itemId = body.item_id as string
  const deviationNote = body.deviation_note as string
  const deviationType = body.deviation_type as string

  if (!itemId || !deviationNote) {
    return NextResponse.json({ error: 'item_id and deviation_note required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify project access
  const { data: project } = await admin
    .from('projects')
    .select('id, name, pn')
    .eq('id', projectId)
    .eq('org_id', dbUser.org_id)
    .single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Get the install item
  const { data: item } = await admin
    .from('install_items')
    .select('*')
    .eq('id', itemId)
    .eq('project_id', projectId)
    .single()
  if (!item) return NextResponse.json({ error: 'Install item not found' }, { status: 404 })

  const prompt = `You are a physical security installation quality analyst.

A field technician has reported a deviation from the planned installation. Analyze the deviation and provide a structured assessment.

Project: ${project.name} (${project.pn})
Item: ${item.label} (${item.category ?? 'general'})
Planned: ${item.vendor ?? ''} ${item.model ?? ''} — qty ${item.quantity}
Deviation Type: ${deviationType ?? 'unspecified'}
Technician's Note: ${deviationNote}

Provide a concise analysis (under 200 words):
1. **Impact Assessment**: How does this affect the installation? (Low/Medium/High)
2. **Root Cause**: Likely reason for the deviation
3. **Recommended Action**: What should be done next (continue as-is, change order needed, PM approval needed, etc.)
4. **Documentation**: What should be documented for the customer/PM

Be specific to physical security installations (cameras, access control, networking). If this could affect code compliance or system functionality, flag it clearly.`

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
  const analysis = result.content?.[0]?.text ?? 'Unable to generate analysis.'

  // Save analysis to install item
  await admin
    .from('install_items')
    .update({
      deviation_type: deviationType || 'minor',
      deviation_note: deviationNote,
      deviation_ai_analysis: analysis,
      status: 'deviation',
    })
    .eq('id', itemId)

  return NextResponse.json({ analysis, item_id: itemId, generated_at: new Date().toISOString() })
}
