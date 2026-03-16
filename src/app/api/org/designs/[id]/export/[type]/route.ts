import { NextRequest, NextResponse } from 'next/server'
import { verifyDesignAccess } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type ExportType = 'bom' | 'material-list' | 'hardware-schedule' | 'cable-schedule'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const user = await verifyDesignAccess()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: designId, type: exportType } = await params
  const admin = createAdminClient()

  // Verify design ownership
  const { data: design } = await admin.from('designs').select('id, name').eq('id', designId).eq('org_id', user.org_id).single()
  if (!design) return NextResponse.json({ error: 'Design not found' }, { status: 404 })

  // Fetch all devices for this design
  const { data: devices } = await admin.from('design_devices').select('*').eq('design_id', designId).order('created_at')
  const { data: cables } = await admin.from('design_cables').select('*').eq('design_id', designId).order('created_at')
  const { data: mdfIdfs } = await admin.from('design_mdf_idf').select('*').eq('design_id', designId)

  const deviceList = devices ?? []
  const cableList = cables ?? []
  const mdfIdfList = mdfIdfs ?? []

  switch (exportType as ExportType) {
    case 'bom': {
      // Bill of Materials — group devices by category + model, count quantities
      const groups = new Map<string, { category: string; label: string; manufacturer: string; model: string; qty: number; unitCost: number }>()
      for (const d of deviceList) {
        const props = (d.properties ?? {}) as Record<string, unknown>
        const key = `${d.category}|${String(props.manufacturer ?? '')}|${String(props.model ?? d.label)}`
        const existing = groups.get(key)
        if (existing) { existing.qty++ }
        else { groups.set(key, { category: d.category, label: d.label, manufacturer: String(props.manufacturer ?? ''), model: String(props.model ?? ''), qty: 1, unitCost: Number(d.recurring_cost) || 0 }) }
      }
      return NextResponse.json({
        exportType: 'bom',
        designName: design.name,
        generatedAt: new Date().toISOString(),
        totalLineItems: groups.size,
        totalDevices: deviceList.length,
        items: Array.from(groups.values()),
      })
    }

    case 'material-list': {
      // Material list — every device with full properties
      return NextResponse.json({
        exportType: 'material-list',
        designName: design.name,
        generatedAt: new Date().toISOString(),
        totalDevices: deviceList.length,
        devices: deviceList.map((d) => ({
          label: d.label,
          category: d.category,
          status: d.status,
          mount_type: d.mount_type,
          properties: d.properties,
          area_id: d.area_id,
        })),
      })
    }

    case 'hardware-schedule': {
      // Hardware schedule — devices grouped by area with install details
      const areaMap = new Map<string, typeof deviceList>()
      for (const d of deviceList) {
        const aId = d.area_id ?? 'unassigned'
        const list = areaMap.get(aId) ?? []
        list.push(d)
        areaMap.set(aId, list)
      }
      return NextResponse.json({
        exportType: 'hardware-schedule',
        designName: design.name,
        generatedAt: new Date().toISOString(),
        totalDevices: deviceList.length,
        areas: Array.from(areaMap.entries()).map(([areaId, devs]) => ({
          areaId,
          deviceCount: devs.length,
          devices: devs.map((d) => ({
            label: d.label,
            category: d.category,
            status: d.status,
            mount_type: d.mount_type,
            position_x: d.position_x,
            position_y: d.position_y,
            properties: d.properties,
          })),
        })),
      })
    }

    case 'cable-schedule': {
      // Cable schedule — all cables with from/to, type, length, MDF/IDF
      return NextResponse.json({
        exportType: 'cable-schedule',
        designName: design.name,
        generatedAt: new Date().toISOString(),
        totalCables: cableList.length,
        totalFootage: cableList.reduce((sum, c) => sum + (c.total_length_ft ?? 0), 0),
        mdfIdfs: mdfIdfList.map((m) => ({ id: m.id, name: m.name })),
        cables: cableList.map((c) => ({
          label: c.label,
          cable_type: c.cable_type,
          length_ft: c.length_ft,
          slack_pct: c.slack_pct,
          total_length_ft: c.total_length_ft,
          service_loop_ft: c.service_loop_ft,
          from_device_id: c.from_device_id,
          to_device_id: c.to_device_id,
          mdf_idf_id: c.mdf_idf_id,
        })),
      })
    }

    default:
      return NextResponse.json({ error: `Unknown export type: ${exportType}` }, { status: 400 })
  }
}
