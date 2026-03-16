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
        <h1 className="text-2xl font-semibold text-white">Device Library Review</h1>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (userRole !== 'GLOBAL_ADMIN' && userRole !== 'GLOBAL_MANAGER') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Device Library Review</h1>
        <p className="text-sm text-zinc-500">Global admin access required.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Device Library — Review Queue</h1>
      <p className="text-sm text-zinc-500">
        Review community contributions to the global device library.
      </p>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : contributions.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
          <Check className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
          <p className="text-sm font-medium text-zinc-400">Queue is empty</p>
          <p className="text-xs text-zinc-600 mt-1">No pending contributions to review</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Vendor</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Model</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Category</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Submitted By</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Org</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => {
                const item = c.device_library_items
                const isLoading = actionLoading === c.id

                return (
                  <tr key={c.id} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-zinc-200">{item?.vendor ?? '-'}</td>
                    <td className="px-4 py-3 text-zinc-300">{item?.model ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 uppercase">
                        {item?.category ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {c.submitted_user
                        ? `${c.submitted_user.first_name} ${c.submitted_user.last_name}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{c.organizations?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleApprove(c.id)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectTarget(rejectTarget === c.id ? null : c.id)
                            setMergeTarget(null)
                          }}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                        >
                          <X className="h-3 w-3" /> Reject
                        </button>
                        <button
                          onClick={() => {
                            setMergeTarget(mergeTarget === c.id ? null : c.id)
                            setRejectTarget(null)
                          }}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
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
                            className="h-8 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
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
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Merge inline form */}
                      {mergeTarget === c.id && (
                        <div className="space-y-2 mt-2 max-w-sm">
                          <p className="text-[11px] text-zinc-500">
                            Search for an existing global item to merge into:
                          </p>
                          <div className="relative">
                            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-zinc-600" />
                            <input
                              value={mergeSearch}
                              onChange={(e) => searchMergeTargets(e.target.value)}
                              placeholder="Search global items..."
                              className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-900 pl-7 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                            />
                          </div>
                          {mergeResults.length > 0 && (
                            <div className="rounded-md border border-zinc-800 max-h-32 overflow-y-auto">
                              {mergeResults.map((r) => (
                                <button
                                  key={r.id}
                                  onClick={() => setMergeSelectedId(r.id)}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-900 ${
                                    mergeSelectedId === r.id ? 'bg-zinc-900 text-white' : 'text-zinc-400'
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
                            className="h-8 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMerge(c.id)}
                              disabled={!mergeSelectedId || isLoading}
                              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
                            >
                              <GitMerge className="h-3 w-3" /> Confirm Merge
                            </button>
                            <button
                              onClick={() => setMergeTarget(null)}
                              className="text-zinc-500 hover:text-zinc-300"
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
