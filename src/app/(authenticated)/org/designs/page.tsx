'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PenTool, Plus, Archive, ExternalLink, X } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDesigns } from '@/hooks/useDesigns'
import { DESIGN_ACCESS_ROLES } from '@/types/enums'
import type { Opportunity } from '@/types/database'

export default function DesignsPage() {
  const router = useRouter()
  const { userRole, loading: userLoading } = useUser()
  const { designs, loading, error, createDesign, archiveDesign } = useDesigns()
  const [archiving, setArchiving] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [selectedOppId, setSelectedOppId] = useState('')
  const [designName, setDesignName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const hasAccess = userRole && (DESIGN_ACCESS_ROLES as readonly string[]).includes(userRole)

  // Fetch opportunities when modal opens
  useEffect(() => {
    if (!showCreate) return
    fetch('/api/org/opportunities')
      .then((r) => r.ok ? r.json() : [])
      .then((json) => setOpportunities(Array.isArray(json) ? json : json.data ?? []))
      .catch(() => {})
  }, [showCreate])

  async function handleCreate() {
    if (!selectedOppId) { setCreateError('Select an opportunity'); return }
    setCreating(true)
    setCreateError(null)
    const design = await createDesign(selectedOppId, designName || undefined)
    if (design) {
      router.push(`/org/designs/${design.id}`)
    } else {
      setCreateError('Failed to create design')
    }
    setCreating(false)
  }

  async function handleArchive(id: string) {
    setArchiving(id)
    await archiveDesign(id)
    setArchiving(null)
  }

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Designs</h1>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Designs</h1>
        <p className="text-sm text-zinc-500">You do not have access to the Design Canvas.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Designs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Design workspaces linked to opportunities
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSelectedOppId(''); setDesignName(''); setCreateError(null) }}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Design
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading designs...</p>
      ) : designs.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
          <PenTool className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
          <p className="text-sm font-medium text-zinc-400">No designs yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Click "New Design" to get started, or create one from an opportunity.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Design Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Opportunity</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Customer</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Created</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {designs.map((d) => {
                const opp = d.opportunities
                return (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/30 cursor-pointer"
                    onClick={() => router.push(`/org/designs/${d.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-200">
                      <div className="flex items-center gap-2">
                        <PenTool className="h-4 w-4 text-zinc-600" />
                        {d.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {opp ? (
                        <span className="font-mono text-xs">{opp.opp_number}</span>
                      ) : '-'}
                      {opp?.project_name && (
                        <span className="text-zinc-500 ml-2">{opp.project_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{opp?.customer_name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${
                        d.status === 'ACTIVE'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/org/designs/${d.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-900"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </Link>
                        <button
                          onClick={() => handleArchive(d.id)}
                          disabled={archiving === d.id}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-900 hover:text-red-400 disabled:opacity-50"
                        >
                          <Archive className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Design Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">New Design</h2>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            {createError && (
              <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-400">{createError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Link to Opportunity</label>
                <select
                  value={selectedOppId}
                  onChange={(e) => {
                    setSelectedOppId(e.target.value)
                    // Auto-fill name from OPP
                    const opp = (Array.isArray(opportunities) ? opportunities : []).find((o: Opportunity) => o.id === e.target.value)
                    if (opp) {
                      setDesignName(opp.project_name ? `${opp.opp_number} — ${opp.project_name}` : `${opp.opp_number} Design`)
                    }
                  }}
                  className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select opportunity...</option>
                  {(Array.isArray(opportunities) ? opportunities : []).map((o: Opportunity) => (
                    <option key={o.id} value={o.id}>
                      {o.opp_number} {o.project_name ? `— ${o.project_name}` : ''} {o.customer_name ? `(${o.customer_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Design Name</label>
                <input
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="Auto-generated from opportunity"
                  className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleCreate}
                disabled={creating || !selectedOppId}
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Design'}
              </button>
              <button onClick={() => setShowCreate(false)} className="h-9 rounded-md border border-zinc-800 px-4 text-sm text-zinc-400 hover:bg-zinc-900">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
