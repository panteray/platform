'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PenTool, Plus, ExternalLink } from 'lucide-react'
import type { Design } from '@/types/database'

interface DesignsTabProps {
  oppId: string
  oppNumber: string
  projectName?: string
}

export function DesignsTab({ oppId, oppNumber, projectName }: DesignsTabProps) {
  const router = useRouter()
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDesigns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/org/designs')
      if (!res.ok) { setError('Failed to load designs'); return }
      const json = await res.json()
      // Filter to only designs for this OPP
      const oppDesigns = (json.designs ?? []).filter((d: Design) => d.opp_id === oppId)
      setDesigns(oppDesigns)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [oppId])

  useEffect(() => { void fetchDesigns() }, [fetchDesigns])

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const name = projectName ? `${oppNumber} — ${projectName}` : `${oppNumber} Design`
      const res = await fetch('/api/org/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opp_id: oppId, name }),
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to create design')
        return
      }
      const json = await res.json()
      router.push(`/org/designs/${json.design.id}`)
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading designs...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {designs.length === 0
            ? 'No designs for this opportunity yet.'
            : `${designs.length} design${designs.length > 1 ? 's' : ''}`}
        </p>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {creating ? 'Creating...' : 'Create Design'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      )}

      {designs.length > 0 && (
        <div className="space-y-2">
          {designs.map((d) => (
            <div
              key={d.id}
              onClick={() => router.push(`/org/designs/${d.id}`)}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-pt-sm cursor-pointer transition-all duration-150 hover:border-primary/30 hover:shadow-pt-md"
            >
              <div className="flex items-center gap-3">
                <PenTool className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  d.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'
                }`}>
                  {d.status}
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
