import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_tech_skills')
    .select('*')
    .eq('user_id', id)
    .eq('org_id', dbUser.org_id)
    .order('skill', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { skill?: string; proficiency?: 'junior' | 'mid' | 'senior' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.skill) return NextResponse.json({ error: 'skill required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('psa_tech_skills')
    .insert({
      org_id: dbUser.org_id,
      user_id: id,
      skill: body.skill,
      proficiency: body.proficiency ?? 'mid',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const skillId = req.nextUrl.searchParams.get('skill_id')
  if (!skillId) return NextResponse.json({ error: 'skill_id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('psa_tech_skills')
    .delete()
    .eq('id', skillId)
    .eq('user_id', id)
    .eq('org_id', dbUser.org_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
