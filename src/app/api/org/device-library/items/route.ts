import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDeviceLibraryAccess } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const dbUser = await verifyDeviceLibraryAccess()
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = dbUser.org_id
  const admin = createAdminClient()

  try {
    const body = await req.json()
    const {
      category = 'cctv',
      subcategory = 'dome',
      vendor = 'Custom',
      model = '',
      partnumber = '',
      resolution = '2MP',
      fps = 30,
      poe_standard = 'PoE',
      wattage = 15,
      ndaa_compliant = false,
      specs = {}
    } = body

    if (!model) {
      return NextResponse.json({ error: 'Model is required' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('device_library_items')
      .insert({
        org_id: orgId,
        category,
        subcategory,
        vendor,
        model,
        partnumber,
        resolution,
        fps,
        poe_standard,
        wattage,
        ndaa_compliant,
        specs
      })
      .select('id, category, subcategory, vendor, model, partnumber, resolution, fps, poe_standard, wattage, ndaa_compliant, specs, manufacturer_id')
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ item: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
