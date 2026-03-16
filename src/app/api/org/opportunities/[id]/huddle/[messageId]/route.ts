import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_ROLES = ['GLOBAL_ADMIN', 'ORG_ADMIN', 'ORG_MANAGER']

async function verifyCaller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('id, role, org_id')
    .eq('auth_id', user.id)
    .single()
  if (!dbUser || !dbUser.org_id) return null
  return dbUser
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { messageId } = await params
  const caller = await verifyCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch message to check ownership
  const { data: msg } = await admin
    .from('opp_huddle_messages')
    .select('id, author_id, org_id')
    .eq('id', messageId)
    .single()

  if (!msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  if (msg.org_id !== caller.org_id) return NextResponse.json({ error: 'Not in your organization' }, { status: 403 })

  // Admins can delete any, others only their own
  if (!ADMIN_ROLES.includes(caller.role) && msg.author_id !== caller.id) {
    return NextResponse.json({ error: 'Cannot delete another user\'s message' }, { status: 403 })
  }

  // Soft delete
  const { error } = await admin
    .from('opp_huddle_messages')
    .update({ is_deleted: true })
    .eq('id', messageId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
