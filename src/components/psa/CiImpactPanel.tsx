'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, GitBranch, AlertTriangle, Server } from 'lucide-react'
import type { CiImpactResponse, AssetRelationshipType } from '@/types/database'

const RELATIONSHIP_LABELS: Record<AssetRelationshipType, string> = {
  depends_on: 'depends on',
  contains: 'contains',
  powered_by: 'powered by',
  network_uplink: 'uplinks',
}

const RELATIONSHIP_COLORS: Record<AssetRelationshipType, string> = {
  depends_on: 'bg-blue-100 text-blue-700 border-blue-200',
  contains: 'bg-purple-100 text-purple-700 border-purple-200',
  powered_by: 'bg-amber-100 text-amber-700 border-amber-200',
  network_uplink: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

export function CiImpactPanel({ ticketId }: { ticketId: string }) {
  const [data, setData] = useState<CiImpactResponse | null>(null)
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/org/psa/tickets/${ticketId}/ci-impact`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ticketId])

  // Hide if no asset, no relationships, or still loading on first mount
  if (loading) return null
  if (!data || !data.root_asset_id || data.downstream.length === 0) return null

  return (
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-neutral-600" />
          <h3 className="text-sm font-semibold text-neutral-900">CI Impact</h3>
          <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-700 text-[10px] font-mono rounded">
            {data.downstream.length} downstream
          </span>
          {data.open_ticket_count > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold rounded">
              <AlertTriangle className="w-3 h-3" />
              {data.open_ticket_count} open ticket{data.open_ticket_count === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-neutral-500" /> : <ChevronRight className="w-4 h-4 text-neutral-500" />}
      </button>

      {open && (
        <div className="border-t border-neutral-200 p-3 space-y-1.5">
          {data.downstream.map((node) => (
            <div
              key={node.asset_id}
              className="flex items-center gap-2 text-xs py-1.5"
              style={{ paddingLeft: `${(node.depth - 1) * 16}px` }}
            >
              <span className="text-neutral-400 font-mono">{'→'.repeat(node.depth)}</span>
              <Server className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
              <span className="font-mono text-neutral-700">
                {node.serial_number ?? node.asset_id.slice(0, 8)}
              </span>
              <span
                className={`px-1.5 py-0.5 text-[9px] font-medium rounded border ${RELATIONSHIP_COLORS[node.relationship_type]}`}
              >
                {RELATIONSHIP_LABELS[node.relationship_type]}
              </span>
              <span className="text-[10px] text-neutral-400 ml-auto">depth {node.depth}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
