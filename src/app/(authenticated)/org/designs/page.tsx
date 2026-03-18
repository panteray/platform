'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PenTool, Plus, Archive, ExternalLink, X, Search, LayoutGrid, List, Upload, Trash2, Calendar } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDesigns } from '@/hooks/useDesigns'
import { DESIGN_ACCESS_ROLES } from '@/types/enums'
import type { Opportunity } from '@/types/database'

type ViewMode = 'grid' | 'list'
type TabFilter = 'ongoing' | 'completed'

export default function DesignsPage() {
  const router = useRouter()
  const { userRole, loading: userLoading } = useUser()
  const { designs, loading, error, createDesign, archiveDesign, refresh } = useDesigns()
  const [archiving, setArchiving] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [selectedOppId, setSelectedOppId] = useState('')
  const [designName, setDesignName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [assignDesignId, setAssignDesignId] = useState<string | null>(null)
  const [assignOppId, setAssignOppId] = useState('')
  const [assigning, setAssigning] = useState(false)

  // Phase A state
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [activeTab, setActiveTab] = useState<TabFilter>('ongoing')
  const [searchQuery, setSearchQuery] = useState('')

  const hasAccess = userRole && (DESIGN_ACCESS_ROLES as readonly string[]).includes(userRole)

  // Fetch opportunities when modal opens
  useEffect(() => {
    if (!showCreate && !assignDesignId) return
    fetch('/api/org/opportunities')
      .then((r) => r.ok ? r.json() : [])
      .then((json) => setOpportunities(Array.isArray(json) ? json : json.data ?? []))
      .catch(() => {})
  }, [showCreate, assignDesignId])

  // Filter designs by tab + search
  const filteredDesigns = useMemo(() => {
    let list = designs
    if (activeTab === 'ongoing') {
      list = list.filter((d) => d.status === 'ACTIVE')
    } else {
      list = list.filter((d) => d.status !== 'ACTIVE')
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((d) => {
        const opp = d.opportunities
        return (
          d.name?.toLowerCase().includes(q) ||
          opp?.opp_number?.toLowerCase().includes(q) ||
          opp?.project_name?.toLowerCase().includes(q) ||
          opp?.customer_name?.toLowerCase().includes(q)
        )
      })
    }
    return list
  }, [designs, activeTab, searchQuery])

  async function handleCreate() {
    setCreating(true)
    setCreateError(null)
    const design = await createDesign(selectedOppId || null, designName || undefined)
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

  async function handleAssignOpp() {
    if (!assignDesignId || !assignOppId) return
    setAssigning(true)
    try {
      const res = await fetch(`/api/org/designs/${assignDesignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opp_id: assignOppId }),
      })
      if (res.ok) {
        setAssignDesignId(null)
        refresh()
      }
    } catch { /* silent */ }
    setAssigning(false)
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Designs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Design workspaces linked to opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-zinc-800 px-3 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            title="Import design"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <button
            onClick={() => { setShowCreate(true); setSelectedOppId(''); setDesignName(''); setCreateError(null) }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Design
          </button>
        </div>
      </div>

      {/* Tabs + Search + View Toggle */}
      <div className="flex items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-0 rounded-lg border border-zinc-800 overflow-hidden">
          <button
            onClick={() => setActiveTab('ongoing')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'ongoing'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
            }`}
          >
            Ongoing Designs
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'completed'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
            }`}
          >
            Completed / Archived
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search designs..."
              className="h-9 w-60 rounded-md border border-zinc-800 bg-zinc-900 pl-8 pr-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0 rounded-md border border-zinc-800 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-300'}`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-300'}`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading designs...</p>
      ) : filteredDesigns.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
          <PenTool className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
          <p className="text-sm font-medium text-zinc-400">
            {searchQuery ? 'No designs match your search' : activeTab === 'ongoing' ? 'No ongoing designs' : 'No completed designs'}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            {!searchQuery && activeTab === 'ongoing' && 'Click "New Design" to get started, or create one from an opportunity.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ---- CARD GRID VIEW ---- */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDesigns.map((d) => {
            const opp = d.opportunities
            return (
              <div
                key={d.id}
                onClick={() => router.push(`/org/designs/${d.id}`)}
                className="group rounded-lg border border-zinc-800 bg-zinc-950 p-4 cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/40 transition-all"
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <PenTool className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-200 leading-tight truncate">{d.name}</p>
                      {opp?.opp_number && (
                        <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{opp.opp_number}</p>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 ml-2 inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${
                    d.status === 'ACTIVE'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {d.status}
                  </span>
                </div>

                {/* Customer */}
                <p className="text-xs text-zinc-400 truncate">
                  {opp?.customer_name || 'No customer assigned'}
                </p>

                {/* Project name */}
                {opp?.project_name && (
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{opp.project_name}</p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                    <Calendar className="h-3 w-3" />
                    {new Date(d.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {!opp && (
                      <button
                        onClick={() => { setAssignDesignId(d.id); setAssignOppId('') }}
                        className="rounded px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        Assign OPP
                      </button>
                    )}
                    <button
                      onClick={() => handleArchive(d.id)}
                      disabled={archiving === d.id}
                      className="rounded p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                      title="Archive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ---- LIST (TABLE) VIEW ---- */
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
              {filteredDesigns.map((d) => {
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
                        <>
                          <span className="font-mono text-xs">{opp.opp_number}</span>
                          {opp.project_name && (
                            <span className="text-zinc-500 ml-2">{opp.project_name}</span>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setAssignDesignId(d.id)
                            setAssignOppId('')
                          }}
                          className="text-[11px] text-primary hover:underline"
                        >
                          Assign OPP
                        </button>
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
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Link to Opportunity <span className="text-zinc-700">(optional)</span></label>
                <select
                  value={selectedOppId}
                  onChange={(e) => {
                    setSelectedOppId(e.target.value)
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
                disabled={creating}
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

      {/* Assign OPP Modal */}
      {assignDesignId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAssignDesignId(null)}>
          <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Assign Opportunity</h2>
              <button onClick={() => setAssignDesignId(null)} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">Select Opportunity</label>
              <select
                value={assignOppId}
                onChange={(e) => setAssignOppId(e.target.value)}
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

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleAssignOpp}
                disabled={assigning || !assignOppId}
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : 'Assign'}
              </button>
              <button onClick={() => setAssignDesignId(null)} className="h-9 rounded-md border border-zinc-800 px-4 text-sm text-zinc-400 hover:bg-zinc-900">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
