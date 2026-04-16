import { NextRequest, NextResponse } from 'next/server'
import { verifyOrgCRM } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAccess } from '@/lib/roles'
import { UserRole } from '@/types/enums'

/**
 * GET /api/notifications
 * Returns the current user's notifications, newest first, limit 50.
 */
export async function GET(_req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('notifications')
    .select('*')
    .eq('user_id', dbUser.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * POST /api/notifications
 * Manager+ only. Creates a notification for a user in the same org.
 */
export async function POST(req: NextRequest) {
  const dbUser = await verifyOrgCRM()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canAccess(dbUser.role, UserRole.MANAGER)) {
    return NextResponse.json({ error: 'Manager role required' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!body.user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  if (!body.type) return NextResponse.json({ error: 'type required' }, { status: 400 })
  if (!body.title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!body.message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('notifications')
    .insert({
      org_id: dbUser.org_id,
      user_id: body.user_id,
      type: body.type,
      title: body.title,
      message: body.message,
      entity_type: body.entity_type ?? null,
      entity_id: body.entity_id ?? null,
      read: false,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
