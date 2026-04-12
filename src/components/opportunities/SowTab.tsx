'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Download, FileText, Printer } from 'lucide-react'
import type { Design, Opportunity } from '@/types/database'

interface SowData {
  devicesByCategory: Record<string, number>
  totalDevices: number
  cableRuns: number
  totalCableFt: number
  mdfCount: number
  areaNames: string[]
  liftRequired: boolean
  liftDeviceCount: number
}

interface Props {
  oppId: string
  opportunity?: Opportunity | null
}

export function SowTab({ oppId, opportunity }: Props) {
  const [designId, setDesignId] = useState<string | null>(null)
  const [designName, setDesignName] = useState('')
  const [data, setData] = useState<SowData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const dRes = await fetch('/api/org/designs')
      if (!dRes.ok) return
      const { designs } = await dRes.json()
      const oppDesign = (designs ?? []).find((d: Design) => d.opp_id === oppId)
      if (!oppDesign) { setLoading(false); return }
      setDesignId(oppDesign.id)
      setDesignName(oppDesign.name || '')

      // Fetch all design data in parallel
      const [devRes, cblRes, mdfRes, areaRes] = await Promise.all([
        fetch(`/api/org/designs/${oppDesign.id}/export/bom`, { method: 'POST' }),
        fetch(`/api/org/designs/${oppDesign.id}/export/cable-schedule`, { method: 'POST' }),
        fetch(`/api/org/designs/${oppDesign.id}/infrastructure`),
        fetch(`/api/org/designs/${oppDesign.id}/areas`),
      ])

      const bom = devRes.ok ? await devRes.json() : { items: [] }
      const cables = cblRes.ok ? await cblRes.json() : { cables: [], totalFootage: 0 }
      const mdfs = mdfRes.ok ? await mdfRes.json() : { nodes: [] }
      const areas = areaRes.ok ? await areaRes.json() : { areas: [] }

      // Fetch devices directly for lift calculation
      const deviceRes = await fetch(`/api/org/designs/${oppDesign.id}/devices`)
      const devData = deviceRes.ok ? await deviceRes.json() : { devices: [] }
      const devices = devData.devices ?? []

      const byCategory: Record<string, number> = {}
      for (const item of (bom.items ?? []) as Array<{ category: string; qty: number }>) {
        byCategory[item.category] = (byCategory[item.category] || 0) + item.qty
      }

      const liftDevices = devices.filter((d: { properties?: Record<string, unknown> }) => {
        const h = Number((d.properties ?? {}).install_height) || 0
        return h > 12
      })

      setData({
        devicesByCategory: byCategory,
        totalDevices: bom.totalDevices ?? 0,
        cableRuns: (cables.cables ?? []).length,
        totalCableFt: cables.totalFootage ?? 0,
        mdfCount: (mdfs.nodes ?? []).length,
        areaNames: (areas.areas ?? []).map((a: { name: string }) => a.name),
        liftRequired: liftDevices.length > 0,
        liftDeviceCount: liftDevices.length,
      })
    } finally { setLoading(false) }
  }, [oppId])

  useEffect(() => { load() }, [load])

  const projectName = opportunity?.project_name || designName || 'Untitled Project'
  const customerName = opportunity?.customer_name || '—'
  const address = opportunity?.install_address || '—'
  const description = opportunity?.project_description || ''
  const oppType = opportunity?.opp_type || 'SEC'

  const categoryLabels: Record<string, string> = {
    cctv: 'CCTV Cameras', dome: 'Dome Cameras', bullet: 'Bullet Cameras',
    turret: 'Turret Cameras', ptz: 'PTZ Cameras', fisheye: 'Fisheye Cameras',
    multisensor_quad: 'Multi-Sensor Quad', multisensor_dual: 'Multi-Sensor Dual',
    access_control: 'Access Control', network: 'Network Devices',
    av: 'AV Devices', vape_environmental: 'Environmental Sensors',
  }

  const handlePrint = () => {
    const html = `<!DOCTYPE html><html><head><title>SOW — ${projectName}</title>
      <style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a1a;font-size:13px;line-height:1.6}
      h1{font-size:20px;border-bottom:2px solid #522F82;padding-bottom:8px;color:#522F82}
      h2{font-size:15px;color:#333;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;font-size:12px}
      th{background:#f5f5f5;font-weight:600}.total{font-weight:700;background:#f0f0f0}
      .warn{color:#ef4444;font-weight:600}.section{margin:16px 0}</style></head><body>
      <h1>Scope of Work</h1>
      <div class="section"><strong>Project:</strong> ${projectName}<br/>
      <strong>Customer:</strong> ${customerName}<br/>
      <strong>Address:</strong> ${address}<br/>
      <strong>Type:</strong> ${oppType}<br/>
      ${description ? `<strong>Description:</strong> ${description}` : ''}</div>
      <h2>1. Project Scope</h2>
      <p>This scope of work covers the design, procurement, installation, configuration, and commissioning of a
      ${oppType === 'SEC' ? 'security surveillance' : oppType === 'AV' ? 'audio/visual' : oppType === 'NET' ? 'network infrastructure' : 'integrated technology'}
      system at the project site.</p>
      ${data?.areaNames.length ? `<p><strong>Areas:</strong> ${data.areaNames.join(', ')}</p>` : ''}
      <h2>2. Equipment Summary</h2>
      <table><tr><th>Category</th><th>Quantity</th></tr>
      ${Object.entries(data?.devicesByCategory ?? {}).map(([cat, qty]) => `<tr><td>${categoryLabels[cat] || cat}</td><td>${qty}</td></tr>`).join('')}
      <tr class="total"><td>Total Devices</td><td>${data?.totalDevices ?? 0}</td></tr></table>
      <h2>3. Infrastructure</h2>
      <table><tr><th>Item</th><th>Value</th></tr>
      <tr><td>MDF/IDF Locations</td><td>${data?.mdfCount ?? 0}</td></tr>
      <tr><td>Cable Runs</td><td>${data?.cableRuns ?? 0}</td></tr>
      <tr><td>Total Cable Footage</td><td>${data?.totalCableFt?.toLocaleString() ?? 0} ft</td></tr>
      </table>
      ${data?.liftRequired ? `<p class="warn">⚠ Lift/scaffold required for ${data.liftDeviceCount} device(s) installed above 12ft.</p>` : ''}
      <h2>4. Installation</h2>
      <ul><li>All equipment shall be installed per manufacturer specifications</li>
      <li>All cabling shall be Cat6 or better, plenum-rated where required</li>
      <li>All cable runs shall be labeled at both ends per TIA-606-C</li>
      <li>System shall be commissioned and tested prior to handoff</li>
      ${data?.liftRequired ? '<li>Contractor shall provide lift/scaffold equipment for high-mount installations</li>' : ''}
      </ul>
      <h2>5. Exclusions</h2>
      <ul><li>Electrical work or dedicated circuits (by others)</li>
      <li>Drywall repair or painting (by others)</li>
      <li>Network switch or server infrastructure (unless specified in BOM)</li>
      <li>Cloud storage or VMS licensing beyond initial term</li></ul>
      <h2>6. Acceptance</h2>
      <p>Customer walkthrough and sign-off upon completion of installation and testing.</p>
      <div style="margin-top:40px;display:flex;justify-content:space-between">
      <div style="border-top:1px solid #333;width:45%;padding-top:4px;font-size:11px">Customer Signature / Date</div>
      <div style="border-top:1px solid #333;width:45%;padding-top:4px;font-size:11px">Contractor Signature / Date</div>
      </div></body></html>`

    const w = window.open('', '_blank', 'width=800,height=1000')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500) }
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading SOW data...</div>
  if (!designId) return <div className="p-8 text-center text-sm text-muted-foreground">No design linked to this opportunity.</div>
  if (!data) return <div className="p-8 text-center text-sm text-muted-foreground">No design data available.</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Scope of Work</span>
        </div>
        <button onClick={handlePrint}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          <Printer className="h-3.5 w-3.5" /> Generate & Print
        </button>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4 text-sm">
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Project</div>
          <div className="font-medium">{projectName}</div>
          <div className="text-xs text-muted-foreground">{customerName} · {address}</div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Equipment</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.devicesByCategory).map(([cat, qty]) => (
              <div key={cat} className="flex justify-between px-2 py-1 bg-muted/30 rounded text-xs">
                <span>{categoryLabels[cat] || cat}</span>
                <span className="font-mono font-semibold">{qty}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Infrastructure</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="px-2 py-1 bg-muted/30 rounded text-xs text-center">
              <div className="font-mono font-semibold">{data.mdfCount}</div>
              <div className="text-muted-foreground">MDF/IDF</div>
            </div>
            <div className="px-2 py-1 bg-muted/30 rounded text-xs text-center">
              <div className="font-mono font-semibold">{data.cableRuns}</div>
              <div className="text-muted-foreground">Cable Runs</div>
            </div>
            <div className="px-2 py-1 bg-muted/30 rounded text-xs text-center">
              <div className="font-mono font-semibold">{data.totalCableFt.toLocaleString()}</div>
              <div className="text-muted-foreground">Total Ft</div>
            </div>
          </div>
        </div>

        {data.liftRequired && (
          <div className="text-xs text-destructive font-semibold bg-destructive/5 border border-destructive/20 rounded px-3 py-2">
            ⚠ Lift required for {data.liftDeviceCount} device{data.liftDeviceCount > 1 ? 's' : ''} above 12ft
          </div>
        )}

        {data.areaNames.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Areas: {data.areaNames.join(' · ')}
          </div>
        )}
      </div>
    </div>
  )
}
