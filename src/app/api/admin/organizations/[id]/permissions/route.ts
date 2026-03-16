import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyGlobalAdmin } from '@/lib/auth'


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: orgId } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('role_field_permissions')
    .upsert(
      { org_id: orgId, role_key: body.role_key, field_key: body.field_key, permission: body.permission },
      { onConflict: 'org_id,role_key,field_key' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
