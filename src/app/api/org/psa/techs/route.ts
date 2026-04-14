import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const DISPATCHABLE_ROLES = ['LEAD', 'FIELD_TECH', 'TECH_SUP']

export async function GET(_req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: users, error } = await admin
    .from('users')
    .select('id, first_name, last_name, email, role')
    .eq('org_id', dbUser.org_id)
    .in('role', DISPATCHABLE_ROLES)
    .order('first_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!users) return NextResponse.json([])

  const userIds = users.map(u => u.id)

  const [skillsRes, availRes] = await Promise.all([
    admin.from('psa_tech_skills').select('*').in('user_id', userIds),
    admin.from('psa_tech_availability').select('*').in('user_id', userIds).eq('active', true),
  ])

  const skillsByUser = new Map<string, unknown[]>()
  for (const s of skillsRes.data ?? []) {
    if (!skillsByUser.has(s.user_id)) skillsByUser.set(s.user_id, [])
    skillsByUser.get(s.user_id)!.push(s)
  }

  const availByUser = new Map<string, unknown[]>()
  for (const a of availRes.data ?? []) {
    if (!availByUser.has(a.user_id)) availByUser.set(a.user_id, [])
    availByUser.get(a.user_id)!.push(a)
  }

  return NextResponse.json(users.map(u => ({
    ...u,
    skills: skillsByUser.get(u.id) ?? [],
    availability: availByUser.get(u.id) ?? [],
  })))
}
