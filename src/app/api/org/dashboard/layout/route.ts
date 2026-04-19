import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthed() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: dbUser } = await admin.from('users').select('id, org_id').eq('auth_id', user.id).single()
  if (!dbUser || !dbUser.org_id) return null
  return { authId: user.id, id: dbUser.id as string, orgId: dbUser.org_id as string }
}

export async function GET() {
  const me = await getAuthed()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data } = await admin
    .from('user_dashboard_layouts')
    .select('layout, updated_at')
    .eq('user_id', me.id)
    .maybeSingle()
  return NextResponse.json({ layout: data?.layout ?? null })
}

export async function PUT(req: NextRequest) {
  const me = await getAuthed()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (!Array.isArray(body?.layout)) {
    return NextResponse.json({ error: 'layout must be an array' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { error } = await admin
    .from('user_dashboard_layouts')
    .upsert({ user_id: me.id, org_id: me.orgId, layout: body.layout, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const me = await getAuthed()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  await admin.from('user_dashboard_layouts').delete().eq('user_id', me.id)
  return NextResponse.json({ ok: true })
}
