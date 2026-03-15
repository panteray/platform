import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get users table ID
  const { data: dbUser } = await admin
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single()

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await request.json()
  const { notificationId, all } = body

  if (all === true) {
    // Mark all unread notifications as read
    const { error } = await admin
      .from('notifications')
      .update({ read: true })
      .eq('user_id', dbUser.id)
      .eq('read', false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, marked: 'all' })
  }

  if (notificationId && typeof notificationId === 'string') {
    // Mark single notification as read
    const { error } = await admin
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', dbUser.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, marked: notificationId })
  }

  return NextResponse.json({ error: 'Provide notificationId or all: true' }, { status: 400 })
}
