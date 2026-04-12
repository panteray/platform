import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; nodeId: string }> }) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: designId, nodeId } = await params
  const admin = createAdminClient()
  // Try delete from nodes first, then links
  const { error: nodeErr } = await admin.from('interconnect_nodes').delete().eq('id', nodeId).eq('design_id', designId)
  if (nodeErr) {
    const { error: linkErr } = await admin.from('interconnect_links').delete().eq('id', nodeId).eq('design_id', designId)
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
  }
  return NextResponse.json({ deleted: true })
}
