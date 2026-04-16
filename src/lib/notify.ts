import { createAdminClient } from '@/lib/supabase/admin'

interface NotifyParams {
  type: string
  title: string
  message: string
  entityType?: string
  entityId?: string
}

export async function sendNotification(orgId: string, userId: string, params: NotifyParams) {
  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert({
    org_id: orgId,
    user_id: userId,
    type: params.type,
    title: params.title,
    message: params.message,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    read: false,
  })
  if (error) console.error('[notify] Failed to send notification:', error.message)
}

export async function sendNotificationToRole(orgId: string, role: string, params: NotifyParams) {
  const admin = createAdminClient()
  const { data: users } = await admin
    .from('users')
    .select('id')
    .eq('org_id', orgId)
    .eq('role', role)
  if (!users?.length) return
  const rows = users.map(u => ({
    org_id: orgId,
    user_id: u.id,
    type: params.type,
    title: params.title,
    message: params.message,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    read: false,
  }))
  const { error } = await admin.from('notifications').insert(rows)
  if (error) console.error('[notify] Failed to send batch notification:', error.message)
}
