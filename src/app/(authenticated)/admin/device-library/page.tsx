'use client'

import { useEffect, useState, useCallback } from 'react'
import { Check, X, GitMerge, Search } from 'lucide-react'
import { useUser } from '@/hooks/useUser'

interface ContributionRow {
  id: string
  org_id: string
  device_item_id: string
  submitted_by: string | null
  status: string
  created_at: string
  device_library_items: {
    id: string
    vendor: string
    model: string
    partnumber: string | null
    category: string
    subcategory: string | null
    ndaa_compliant: boolean | null
    org_id: string | null
  } | null
  organizations: { name: string } | null
  submitted_user: { first_name: string; last_name: string } | null
}

export default function AdminDeviceLibraryPage() {
  const { userRole, loading: userLoading } = useUser()
  const [contributions, setContributions] = useState<ContributionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Merge state
  const [mergeTarget, setMergeTarget] = useState<string | null>(null)
  const [mergeSearch, setMergeSearch] = useState('')
  const [mergeResults, setMergeResults] = useState<{ id: string; vendor: string; model: string }[]>([])
  const [mergeSelectedId, setMergeSelectedId] = useState<string | null>(null)
  const [mergeNotes, setMergeNotes] = useState('')

  // Reject state
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')

  const loadQueue = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/device-library/review-queue')
      if (res.ok) {
        const json = await res.json()
        setContributions(json.contributions ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userRole === 'GLOBAL_ADMIN' || userRole === 'GLOBAL_MANAGER') {
      void loadQueue()
    }
  }, [userRole, loadQueue])

  async function handleApprove(contribId: string) {
    setActionLoading(contribId)
    await fetch(`/api/admin/device-library/review/${contribId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approved' }),
    })
    setActionLoading(null)
    await loadQueue()
  }

  async function handleReject(contribId: string) {
    if (!rejectNotes.trim()) return
    setActionLoading(contribId)
    await fetch(`/api/admin/device-library/review/${contribId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rejected', review_notes: rejectNotes.trim() }),
    })
    setActionLoading(null)
    setRejectTarget(null)
    setRejectNotes('')
    await loadQueue()
  }

  async function searchMergeTargets(q: string) {
    setMergeSearch(q)
    if (!q.trim()) {
      setMergeResults([])
      return
    }
    const res = await fetch(`/api/org/device-library/search?q=${encodeURIComponent(q)}&limit=10`)
    if (res.ok) {
      const json = await res.json()
      // Only show global items for merge
      setMergeResults(
        (json.results ?? [])
          .filter((i: { org_id?: string | null }) => !i.org_id)
          .map((i: { id: string; vendor: string; model: string }) => ({
            id: i.id, vendor: i.vendor, model: i.model,
          }))
      )
    }
  }

  async function handleMerge(contribId: string) {
    if (!mergeSelectedId) return
    setActionLoading(contribId)
    await fetch(`/api/admin/device-library/review/${contribId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'merged',
        merged_into_id: mergeSelectedId,
        review_notes: mergeNotes.trim() || null,
      }),
    })
    setActionLoading(null)
    setMergeTarget(null)
    setMergeSearch('')
    setMergeResults([])
    setMergeSelectedId(null)
    setMergeNotes('')
    await loadQueue()
  }

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Device Library Review</h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (userRole !== 'GLOBAL_ADMIN' && userRole !== 'GLOBAL_MANAGER') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Device Library Review</h1>
        <p className="text-sm text-muted-foreground">Global admin access required.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Device Library — Review Queue</h1>
      <p className="text-sm text-muted-foreground">
        Review community contributions to the global device library.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : contributions.length === 0 ? (
        <div className="rounded-lg border border-border bg-background p-8 text-center">
          <Check className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Queue is empty</p>
          <p className="text-xs text-muted-foreground mt-1">No pending contributions to review</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Vendor</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Model</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Submitted By</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Org</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => {
                const item = c.device_library_items
                const isLoading = actionLoading === c.id

                return (
                  <tr key={c.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{item?.vendor ?? '-'}</td>
                    <td className="px-4 py-3 text-foreground">{item?.model ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                        {item?.category ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.submitted_user
                        ? `${c.submitted_user.first_name} ${c.submitted_user.last_name}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.organizations?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleApprove(c.id)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectTarget(rejectTarget === c.id ? null : c.id)
                            setMergeTarget(null)
                          }}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent disabled:opacity-50"
                        >
                          <X className="h-3 w-3" /> Reject
                        </button>
                        <button
                          onClick={() => {
                            setMergeTarget(mergeTarget === c.id ? null : c.id)
                            setRejectTarget(null)
                          }}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent disabled:opacity-50"
                        >
                          <GitMerge className="h-3 w-3" /> Merge
                        </button>
                      </div>

                      {/* Reject inline form */}
                      {rejectTarget === c.id && (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="Rejection reason (required)..."
                            className="h-8 flex-1 rounded-md border border-border bg-muted px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                          />
                          <button
                            onClick={() => handleReject(c.id)}
                            disabled={!rejectNotes.trim() || isLoading}
                            className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setRejectTarget(null)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Merge inline form */}
                      {mergeTarget === c.id && (
                        <div className="space-y-2 mt-2 max-w-sm">
                          <p className="text-[11px] text-muted-foreground">
                            Search for an existing global item to merge into:
                          </p>
                          <div className="relative">
                            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                              value={mergeSearch}
                              onChange={(e) => searchMergeTargets(e.target.value)}
                              placeholder="Search global items..."
                              className="h-8 w-full rounded-md border border-border bg-muted pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                            />
                          </div>
                          {mergeResults.length > 0 && (
                            <div className="rounded-md border border-border max-h-32 overflow-y-auto">
                              {mergeResults.map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => setMergeSelectedId(r.id)}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent ${
                                    mergeSelectedId === r.id ? 'bg-muted text-foreground' : 'text-muted-foreground'
                                  }`}
                                >
                                  {r.vendor} — {r.model}
                                </button>
                              ))}
                            </div>
                          )}
                          {mergeSelectedId && (
                            <p className="text-[11px] text-green-500">
                              Selected: {mergeResults.find((r) => r.id === mergeSelectedId)?.vendor}{' '}
                              {mergeResults.find((r) => r.id === mergeSelectedId)?.model}
                            </p>
                          )}
                          <input
                            value={mergeNotes}
                            onChange={(e) => setMergeNotes(e.target.value)}
                            placeholder="Review notes (optional)..."
                            className="h-8 w-full rounded-md border border-border bg-muted px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMerge(c.id)}
                              disabled={!mergeSelectedId || isLoading}
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              <GitMerge className="h-3 w-3" /> Confirm Merge
                            </button>
                            <button
                              onClick={() => setMergeTarget(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
