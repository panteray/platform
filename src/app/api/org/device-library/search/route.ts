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

const ALLOWED_SORT_COLS = ['vendor', 'model', 'resolution', 'form'] as const
type SortCol = (typeof ALLOWED_SORT_COLS)[number]

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
  const vendor = url.searchParams.get('vendor') ?? ''
  const form = url.searchParams.get('form') ?? ''
  const resolution = url.searchParams.get('resolution') ?? ''
  const sortParam = url.searchParams.get('sort') ?? ''
  const sortDirParam = url.searchParams.get('sort_dir') ?? 'asc'
  const limitParam = url.searchParams.get('limit')
  const offsetParam = url.searchParams.get('offset')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 5000) : 50
  const offset = offsetParam ? Math.max(parseInt(offsetParam, 10) || 0, 0) : 0

  const sortCol: SortCol = ALLOWED_SORT_COLS.includes(sortParam as SortCol)
    ? (sortParam as SortCol)
    : 'vendor'
  const ascending = sortDirParam !== 'desc'

  const admin = createAdminClient()

  let query = admin
    .from('device_library_items')
    .select('id, category, subcategory, vendor, model, partnumber, resolution, fps, poe_standard, wattage, ndaa_compliant, ul_listed, ul_listing_code, form, ir, super_low_light, focal_length, focal_type, aov, imager_count, multi_imager_type, codecs, fisheye_view, environment, specs, manufacturer_id', { count: 'exact' })
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order(sortCol, { ascending })
    .order('model', { ascending: true })
    .range(offset, offset + limit - 1)

  if (q) {
    query = query.or(`vendor.ilike.%${q}%,model.ilike.%${q}%,partnumber.ilike.%${q}%`)
  }

  if (category) {
    query = query.eq('category', category)
  }

  if (vendor) {
    query = query.eq('vendor', vendor)
  }

  if (form) {
    query = query.eq('form', form)
  }

  if (resolution) {
    query = query.ilike('resolution', `%${resolution}%`)
  }

  if (ndaaParam === 'true') {
    query = query.eq('ndaa_compliant', true)
  } else if (ndaaParam === 'false') {
    query = query.eq('ndaa_compliant', false)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ results: data ?? [], total: count ?? 0 })
}
