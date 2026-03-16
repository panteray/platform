import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const areaId = request.nextUrl.searchParams.get('area_id')
  const admin = createAdminClient()

  const { data: design } = await admin.from('designs').select('id').eq('id', designId).eq('org_id', user.org_id).single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  // Parallel fetch all canvas objects
  const queries = [
    admin.from('design_devices').select('*').eq('design_id', designId),
    admin.from('design_cables').select('*').eq('design_id', designId),
    admin.from('design_mdf_idf').select('*').eq('design_id', designId),
    admin.from('design_zones').select('*').eq('design_id', designId),
    admin.from('door_configs').select('*').eq('design_id', designId),
  ]

  // Apply area filter if provided
  if (areaId) {
    for (const q of queries) q.eq('area_id', areaId)
  }

  const [devRes, cabRes, infRes, zoneRes, doorRes] = await Promise.all(queries)

  return NextResponse.json({
    designId,
    areaId,
    devices: devRes.data ?? [],
    cables: cabRes.data ?? [],
    infrastructure: infRes.data ?? [],
    zones: zoneRes.data ?? [],
    doors: doorRes.data ?? [],
  })
}
