import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { missingSkills } from '@/lib/psa-skills'

type Slot = {
  tech_id: string
  tech_name: string
  date: string          // YYYY-MM-DD
  start: string         // ISO timestamp
  end: string           // ISO timestamp
}

const SLOT_MINUTES = 30
const DAYS_AHEAD = 10   // walk 10 days; yield first 5 business days with slots

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function combineDateTime(dateStr: string, timeStr: string): Date {
  // timeStr like "08:00:00"
  return new Date(`${dateStr}T${timeStr}`)
}

async function validateToken(token: string) {
  const admin = createAdminClient()
  const { data: tok } = await admin
    .from('dispatch_schedule_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (!tok) return { error: 'Invalid token', status: 404 as const }
  if (!tok.is_active) return { error: 'Link deactivated', status: 410 as const }
  if (tok.used_at) return { error: 'Link already used', status: 410 as const }
  if (new Date(tok.expires_at) < new Date()) return { error: 'Link expired', status: 410 as const }
  return { tok }
}

/**
 * GET /api/portal/schedule/[token]
 * Returns ticket info + available 30-min slots across the next 5 business days,
 * filtered to techs whose skills match ticket.required_skills.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const v = await validateToken(token)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: v.status })
  const tok = v.tok

  const { data: ticket, error: tErr } = await admin
    .from('psa_tickets')
    .select('id, ticket_number, title, description, priority, vertical, required_skills, customer:customers(id, name)')
    .eq('id', tok.ticket_id)
    .maybeSingle()
  if (tErr || !ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  // Load all dispatchable techs in the org with skills + availability
  const DISPATCHABLE_ROLES = ['LEAD', 'FIELD_TECH', 'TECH_SUP']
  const { data: users } = await admin
    .from('users')
    .select('id, first_name, last_name, email, role')
    .eq('org_id', tok.org_id)
    .in('role', DISPATCHABLE_ROLES)

  const userIds = (users ?? []).map(u => u.id)
  if (userIds.length === 0) {
    return NextResponse.json({ ticket, slots: [] })
  }

  const [skillsRes, availRes] = await Promise.all([
    admin.from('psa_tech_skills').select('user_id, skill').in('user_id', userIds),
    admin.from('psa_tech_availability').select('user_id, day_of_week, start_time, end_time').in('user_id', userIds).eq('active', true),
  ])

  const skillsByUser = new Map<string, string[]>()
  for (const s of skillsRes.data ?? []) {
    const arr = skillsByUser.get(s.user_id) ?? []
    arr.push(s.skill)
    skillsByUser.set(s.user_id, arr)
  }

  // Filter techs by required_skills
  const required: string[] = ticket.required_skills ?? []
  const eligibleTechs = (users ?? []).filter(u => {
    const techSkills = skillsByUser.get(u.id) ?? []
    return missingSkills(required, techSkills).length === 0
  })

  if (eligibleTechs.length === 0) {
    return NextResponse.json({ ticket, slots: [], note: 'No technicians currently match the required skills — please contact support.' })
  }

  const availByUser = new Map<string, { day_of_week: number; start_time: string; end_time: string }[]>()
  for (const a of availRes.data ?? []) {
    const arr = availByUser.get(a.user_id) ?? []
    arr.push(a)
    availByUser.set(a.user_id, arr)
  }

  // Build candidate date range
  const dateList: string[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 1; i <= DAYS_AHEAD; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dow = d.getDay()
    if (dow === 0 || dow === 6) continue // skip weekends
    dateList.push(fmtDate(d))
    if (dateList.length >= 5) break
  }

  // Fetch existing assignments for eligible techs in this window
  const { data: existing } = await admin
    .from('psa_dispatch_assignments')
    .select('tech_id, scheduled_date, scheduled_start, scheduled_end, status')
    .in('tech_id', eligibleTechs.map(t => t.id))
    .in('scheduled_date', dateList)
    .not('status', 'eq', 'cancelled')

  const busyByTech = new Map<string, { start: number; end: number }[]>()
  for (const a of existing ?? []) {
    if (!a.scheduled_start || !a.scheduled_end) continue
    const arr = busyByTech.get(a.tech_id) ?? []
    arr.push({ start: new Date(a.scheduled_start).getTime(), end: new Date(a.scheduled_end).getTime() })
    busyByTech.set(a.tech_id, arr)
  }

  const slots: Slot[] = []
  for (const dateStr of dateList) {
    const dow = new Date(dateStr + 'T12:00:00').getDay()
    for (const tech of eligibleTechs) {
      const availBlocks = (availByUser.get(tech.id) ?? []).filter(a => a.day_of_week === dow)
      for (const block of availBlocks) {
        let cursor = combineDateTime(dateStr, block.start_time).getTime()
        const blockEnd = combineDateTime(dateStr, block.end_time).getTime()
        while (cursor + SLOT_MINUTES * 60000 <= blockEnd) {
          const slotStart = cursor
          const slotEnd = cursor + SLOT_MINUTES * 60000
          const busy = busyByTech.get(tech.id) ?? []
          const conflict = busy.some(b => b.start < slotEnd && b.end > slotStart)
          if (!conflict) {
            slots.push({
              tech_id: tech.id,
              tech_name: `${tech.first_name ?? ''} ${tech.last_name ?? ''}`.trim() || tech.email,
              date: dateStr,
              start: new Date(slotStart).toISOString(),
              end: new Date(slotEnd).toISOString(),
            })
          }
          cursor = slotEnd
        }
      }
    }
  }

  // Cap to reasonable count
  return NextResponse.json({
    ticket: {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      vertical: ticket.vertical,
      customer: ticket.customer,
    },
    slots: slots.slice(0, 200),
  })
}

/**
 * POST /api/portal/schedule/[token]
 * Body: { tech_id, date, start, end }
 * Creates a dispatch assignment, marks token used, transitions ticket to SCHEDULED.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const v = await validateToken(token)
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: v.status })
  const tok = v.tok

  let body: { tech_id?: string; date?: string; start?: string; end?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.tech_id || !body.date || !body.start || !body.end) {
    return NextResponse.json({ error: 'tech_id, date, start, end required' }, { status: 400 })
  }

  // Re-check slot availability to avoid double-booking
  const { data: conflicts } = await admin
    .from('psa_dispatch_assignments')
    .select('id')
    .eq('tech_id', body.tech_id)
    .eq('scheduled_date', body.date)
    .not('status', 'eq', 'cancelled')
    .lt('scheduled_start', body.end)
    .gt('scheduled_end', body.start)

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: 'Slot no longer available — please pick another.' }, { status: 409 })
  }

  const { data: assignment, error: insErr } = await admin
    .from('psa_dispatch_assignments')
    .insert({
      org_id: tok.org_id,
      ticket_id: tok.ticket_id,
      tech_id: body.tech_id,
      scheduled_date: body.date,
      scheduled_start: body.start,
      scheduled_end: body.end,
      status: 'scheduled',
      notes: 'Customer self-scheduled',
    })
    .select('id')
    .single()

  if (insErr || !assignment) {
    return NextResponse.json({ error: insErr?.message ?? 'Failed to create assignment' }, { status: 500 })
  }

  // Mark token used
  await admin
    .from('dispatch_schedule_tokens')
    .update({ used_at: new Date().toISOString(), assignment_id: assignment.id, is_active: false })
    .eq('id', tok.id)

  // Transition ticket to SCHEDULED (best-effort — ignore if already past that state)
  const { data: ticket } = await admin
    .from('psa_tickets')
    .select('status')
    .eq('id', tok.ticket_id)
    .maybeSingle()
  if (ticket && (ticket.status === 'NEW' || ticket.status === 'OPEN')) {
    await admin
      .from('psa_tickets')
      .update({ status: 'SCHEDULED', updated_at: new Date().toISOString() })
      .eq('id', tok.ticket_id)
    await admin.from('psa_ticket_status_log').insert({
      org_id: tok.org_id,
      ticket_id: tok.ticket_id,
      from_status: ticket.status,
      to_status: 'SCHEDULED',
      reason: 'Customer self-scheduled via portal link',
    })
  }

  return NextResponse.json({ ok: true, assignment_id: assignment.id })
}
