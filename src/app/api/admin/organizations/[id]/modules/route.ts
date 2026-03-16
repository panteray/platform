import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyGlobalAdmin } from '@/lib/auth'


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyGlobalAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: orgId } = await params
  const body = await request.json()
  const admin = createAdminClient()

  if (body.type === 'module') {
    const { error } = await admin
      .from('org_module_config')
      .upsert(
        { org_id: orgId, module: body.module, is_enabled: body.is_enabled },
        { onConflict: 'org_id,module' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else if (body.type === 'calculator') {
    const { error } = await admin
      .from('org_calculator_config')
      .upsert(
        { org_id: orgId, calculator_type: body.calculator_type, is_enabled: body.is_enabled },
        { onConflict: 'org_id,calculator_type' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
