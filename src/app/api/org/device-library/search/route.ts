import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

function sanitizeSearchTerm(input: string): string {
  if (!input) return ''
  return input
    .replace(/[,()\\.]/g, ' ')
    .replace(/[^a-zA-Z0-9\s\-_]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export async function GET(req: NextRequest) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = dbUser.org_id
  const url = req.nextUrl
  const q = sanitizeSearchTerm(url.searchParams.get('q')?.trim() ?? '')
  const category = url.searchParams.get('category') ?? ''
  const ndaaParam = url.searchParams.get('ndaa_compliant')
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 5000) : 50

  const admin = createAdminClient()

  let query = admin
    .from('device_library_items')
    .select('id, category, subcategory, vendor, model, partnumber, resolution, fps, poe_standard, wattage, ndaa_compliant, form, ir, super_low_light, focal_length, focal_type, aov, imager_count, multi_imager_type, codecs, fisheye_view, environment, specs, manufacturer_id')
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order('vendor', { ascending: true })
    .order('model', { ascending: true })
    .limit(limit)

  if (q) {
    query = query.or(`vendor.ilike.%${q}%,model.ilike.%${q}%,partnumber.ilike.%${q}%`)
  }

  if (category) {
    query = query.eq('category', category)
  }

  if (ndaaParam === 'true') {
    query = query.eq('ndaa_compliant', true)
  } else if (ndaaParam === 'false') {
    query = query.eq('ndaa_compliant', false)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ results: data ?? [] })
}
