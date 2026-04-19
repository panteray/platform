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

    // Duplicate guard: match on vendor+model OR vendor+partnumber (case-insensitive)
    const vendorTrim = String(vendor).trim()
    const modelTrim = String(model).trim()
    const partTrim = String(partnumber || '').trim()

    const orFilters: string[] = [`model.ilike.${modelTrim}`]
    if (partTrim) orFilters.push(`partnumber.ilike.${partTrim}`)

    const { data: existing } = await admin
      .from('device_library_items')
      .select('id, vendor, model, partnumber')
      .eq('org_id', orgId)
      .ilike('vendor', vendorTrim)
      .or(orFilters.join(','))
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Duplicate device — same vendor + model/part number already exists', existing_id: existing[0].id },
        { status: 409 }
      )
    }

    const { data, error } = await admin
      .from('device_library_items')
      .insert({
        org_id: orgId,
        category,
        subcategory,
        vendor: vendorTrim,
        model: modelTrim,
        partnumber: partTrim,
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
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Duplicate device — same vendor + model/part number already exists' },
          { status: 409 }
        )
      }
      console.error('Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ item: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
