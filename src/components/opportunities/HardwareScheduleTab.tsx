'use client'

import { useEffect, useState, useCallback } from 'react'
import { Download, Cpu } from 'lucide-react'
import { exportHardwareSchedule } from '@/lib/export-helpers'
import type { Design } from '@/types/database'

interface HwDevice {
  label: string; category: string; status: string; mount_type: string
  manufacturer: string; model: string; partNumber: string
  posX: number; posY: number
}

interface AreaGroup { areaName: string; devices: HwDevice[] }

interface Props { oppId: string }

export function HardwareScheduleTab({ oppId }: Props) {
  const [designId, setDesignId] = useState<string | null>(null)
  const [areaGroups, setAreaGroups] = useState<AreaGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const dRes = await fetch('/api/org/designs')
      if (!dRes.ok) return
      const { designs } = await dRes.json()
      const oppDesign = (designs ?? []).find((d: Design) => d.opp_id === oppId)
      if (!oppDesign) { setLoading(false); return }
      setDesignId(oppDesign.id)

      const hRes = await fetch(`/api/org/designs/${oppDesign.id}/export/hardware-schedule`, { method: 'POST' })
      if (!hRes.ok) return
      const hw = await hRes.json()

      // Fetch areas for name resolution
      const aRes = await fetch(`/api/org/designs/${oppDesign.id}/areas`)
      const areaMap = new Map<string, string>()
      if (aRes.ok) {
        const { areas } = await aRes.json()
        for (const a of areas ?? []) areaMap.set(a.id, a.name)
      }

      const groups: AreaGroup[] = (hw.areas ?? []).map((area: { areaId: string; devices: Array<Record<string, unknown>> }) => ({
        areaName: areaMap.get(area.areaId) || area.areaId || 'Unassigned',
        devices: (area.devices ?? []).map((d: Record<string, unknown>) => {
          const props = (d.properties ?? {}) as Record<string, unknown>
          return {
            label: String(d.label || ''),
            category: String(d.category || ''),
            status: String(d.status || 'planned'),
            mount_type: String(d.mount_type || props.mount_type || '—'),
            manufacturer: String(props.manufacturer || props.vendor || '—'),
            model: String(props.model || '—'),
            partNumber: String(props.partnumber || props.part_number || '—'),
            posX: Number(d.position_x) || 0,
            posY: Number(d.position_y) || 0,
          }
        }),
      }))
      setAreaGroups(groups)
    } finally { setLoading(false) }
  }, [oppId])

  useEffect(() => { load() }, [load])

  const totalDevices = areaGroups.reduce((s, g) => s + g.devices.length, 0)

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading hardware schedule...</div>
  if (!designId) return <div className="p-8 text-center text-sm text-muted-foreground">No design linked to this opportunity.</div>
  if (totalDevices === 0) return <div className="p-8 text-center text-sm text-muted-foreground">No devices placed on canvas.</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-foreground">
          {totalDevices} devices across {areaGroups.length} area{areaGroups.length !== 1 ? 's' : ''}
        </div>
        <button onClick={async () => { setExporting(true); await exportHardwareSchedule(designId); setExporting(false) }}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Export XLSX
        </button>
      </div>

      {areaGroups.map((group, gi) => (
        <div key={gi} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">{group.areaName}</span>
            <span className="text-[10px] text-muted-foreground">({group.devices.length} devices)</span>
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Label</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Category</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Mount</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Manufacturer</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Model</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Part #</th>
                </tr>
              </thead>
              <tbody>
                {group.devices.map((d, di) => (
                  <tr key={di} className="border-b border-border hover:bg-accent/30 transition-colors">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{di + 1}</td>
                    <td className="px-3 py-2 text-xs font-medium">{d.label || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase">
                        {d.category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{d.mount_type}</td>
                    <td className="px-3 py-2 text-xs">{d.manufacturer}</td>
                    <td className="px-3 py-2 text-xs">{d.model}</td>
                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{d.partNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
