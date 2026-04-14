import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

export async function GET(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const includeArchived = req.nextUrl.searchParams.get('include_archived') === '1'
  const category = req.nextUrl.searchParams.get('category')
  const q = req.nextUrl.searchParams.get('q')

  const admin = createAdminClient()
  let query = admin
    .from('psa_kedb_entries')
    .select('*, problem:psa_problems(id, problem_number, title)')
    .eq('org_id', dbUser.org_id)
    .order('created_at', { ascending: false })

  if (!includeArchived) query = query.is('archived_at', null)
  if (category) query = query.eq('category', category)
  if (q) query = query.or(`title.ilike.%${q}%,symptoms.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER))
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.title || !body.symptoms) {
    return NextResponse.json({ error: 'title, symptoms required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_kedb_entries')
    .insert({
      org_id: dbUser.org_id,
      title: body.title,
      symptoms: body.symptoms,
      root_cause: body.root_cause ?? null,
      workaround: body.workaround ?? null,
      permanent_fix: body.permanent_fix ?? null,
      category: body.category ?? null,
      tags: body.tags ?? null,
      problem_id: body.problem_id ?? null,
      audience: body.audience ?? 'internal',
      created_by: dbUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
