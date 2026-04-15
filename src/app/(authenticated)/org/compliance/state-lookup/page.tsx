'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, ExternalLink, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'

type Status = 'LICENSE_REQUIRED' | 'NO_STATE_LICENSE' | 'ELECTRICIAN_LICENSE'

interface StateRef {
  id: string
  state: string
  license_type: string
  status: Status
  requirements_summary: string | null
  agency_name: string | null
  agency_url: string | null
  last_verified_at: string | null
}

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR',
  'PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

function StatusBadge({ status }: { status: Status }) {
  if (status === 'LICENSE_REQUIRED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
        <ShieldAlert className="h-3 w-3" /> License required
      </span>
    )
  }
  if (status === 'ELECTRICIAN_LICENSE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
        <ShieldCheck className="h-3 w-3" /> Electrician
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
      <ShieldX className="h-3 w-3" /> No state license
    </span>
  )
}

export default function StateLookupPage() {
  const [state, setState] = useState<string>('LA')
  const [rows, setRows] = useState<StateRef[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (s: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/org/compliance/state-licensing?state=${s}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to load')
      }
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(state) }, [state, load])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/org/compliance/technicians" className="text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">State Licensing Lookup</h1>
          <p className="text-sm text-slate-600">50-state + DC reference for low-voltage / life-safety licensing requirements.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="h-10 rounded-md border border-slate-300 bg-white pl-9 pr-8 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
          >
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {loading && <span className="text-xs text-slate-500">Loading…</span>}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>
      )}

      <div className="space-y-3">
        {rows.length === 0 && !loading && !error && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
            No reference data on file for {state}.
          </div>
        )}
        {rows.map(r => (
          <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{r.license_type}</div>
                <div className="mt-1"><StatusBadge status={r.status} /></div>
              </div>
              {r.agency_url && (
                <a
                  href={r.agency_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  {r.agency_name ?? 'Agency'} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {r.requirements_summary && (
              <p className="mt-3 text-sm text-slate-700">{r.requirements_summary}</p>
            )}
            {r.last_verified_at && (
              <p className="mt-3 text-xs text-slate-400">
                Last verified {new Date(r.last_verified_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
