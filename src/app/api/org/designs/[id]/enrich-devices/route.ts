import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST — Enrich devices with missing specs from device library.
 * Sets sensible defaults for sensor_w, focal_length, resolution_w/h
 * so FOV/DORI calculations work.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId } = await params
  const admin = createAdminClient()

  const { data: devices } = await admin.from('design_devices').select('*').eq('design_id', designId)
  if (!devices) return NextResponse.json({ error: 'No devices' }, { status: 400 })

  const CAMERA_CATS = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']
  let enriched = 0

  // Batch-fetch all linked library items in a single query (fixes N+1)
  const libItemIds = [...new Set(
    devices.filter(d => d.device_library_item_id).map(d => d.device_library_item_id as string)
  )]
  const libItemMap = new Map<string, Record<string, unknown>>()
  if (libItemIds.length > 0) {
    const { data: libItems } = await admin.from('device_library_items').select('*').in('id', libItemIds)
    for (const item of libItems ?? []) {
      libItemMap.set(item.id, item as Record<string, unknown>)
    }
  }

  for (const d of devices) {
    if (!CAMERA_CATS.includes(d.category)) continue
    const props = (d.properties ?? {}) as Record<string, unknown>
    const updates: Record<string, unknown> = {}
    let needsUpdate = false

    // Default sensor width: 1/2.8" = 5.14mm (IEC 62676-4 standard)
    if (!props.sensor_w && !props.sensor_width) {
      updates.sensor_w = 5.14
      needsUpdate = true
    }

    // Default focal length: 4mm (common fixed lens)
    if (!props.focal_length) {
      updates.focal_length = 4
      needsUpdate = true
    }

    // Default resolution: derive from category or set 1920x1080
    if (!props.resolution_w) {
      updates.resolution_w = 1920
      updates.resolution_h = 1080
      needsUpdate = true
    }

    // Try to enrich from device library if linked
    if (d.device_library_item_id) {
      const libItem = libItemMap.get(d.device_library_item_id)
      if (libItem) {
        const specs = ((libItem.specs ?? {}) as Record<string, unknown>)
        if (!props.sensor_w && specs.sensor_w) { updates.sensor_w = specs.sensor_w; needsUpdate = true }
        if (!props.focal_length && specs.focal_length) { updates.focal_length = specs.focal_length; needsUpdate = true }
        if (!props.resolution_w && specs.resolution_w) { updates.resolution_w = specs.resolution_w; needsUpdate = true }
        if (!props.resolution_h && specs.resolution_h) { updates.resolution_h = specs.resolution_h; needsUpdate = true }
        if (!props.vendor && libItem.vendor) { updates.vendor = libItem.vendor; needsUpdate = true }
        if (!props.model && libItem.model) { updates.model = libItem.model; needsUpdate = true }
        if (!props.poe_standard && libItem.poe_standard) { updates.poe_standard = libItem.poe_standard; needsUpdate = true }
        if (!props.poe_watts && libItem.wattage) { updates.poe_watts = libItem.wattage; needsUpdate = true }

        // Parse resolution string
        if (!props.resolution_w && libItem.resolution) {
          const resStr = String(libItem.resolution)
          const wxh = resStr.match(/(\d+)\s*[xX×]\s*(\d+)/)
          if (wxh) { updates.resolution_w = parseInt(wxh[1]); updates.resolution_h = parseInt(wxh[2]); needsUpdate = true }
          else if (/4k/i.test(resStr)) { updates.resolution_w = 3840; updates.resolution_h = 2160; needsUpdate = true }
          else if (/8k/i.test(resStr)) { updates.resolution_w = 7680; updates.resolution_h = 4320; needsUpdate = true }
          else {
            const mp = resStr.match(/([\d.]+)\s*mp/i)
            if (mp) {
              const mpVal = parseFloat(mp[1])
              const lookup: Record<string, [number, number]> = { '2': [1920, 1080], '4': [2560, 1440], '5': [2592, 1944], '8': [3840, 2160], '12': [4000, 3000] }
              const key = String(Math.round(mpVal))
              if (lookup[key]) { updates.resolution_w = lookup[key][0]; updates.resolution_h = lookup[key][1]; needsUpdate = true }
            }
          }
        }
      }
    }

    if (needsUpdate) {
      const newProps = { ...props, ...updates }
      await admin.from('design_devices').update({ properties: newProps }).eq('id', d.id)
      enriched++
    }
  }

  return NextResponse.json({ enriched, total: devices.length })
}
