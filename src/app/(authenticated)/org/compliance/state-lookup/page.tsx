'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, ExternalLink, ShieldCheck, ShieldX, Pencil } from 'lucide-react'

interface OrgStateLicense {
  id: string
  state: string
  license_required: boolean
  license_type: string | null
  requirements_summary: string | null
  agency_name: string | null
  agency_url: string | null
  notes: string | null
  last_verified_at: string | null
}

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR',
  'PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

export default function StateLookupPage() {
  const [state, setState] = useState<string>('LA')
  const [row, setRow] = useState<OrgStateLicense | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (s: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/org/compliance/state-licensing/${s}`)
      if (!res.ok) {
        if (res.status === 404) { setRow(null); return }
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to load')
      }
      const data = await res.json()
      setRow(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(state) }, [state, load])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/org/compliance/technicians" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground font-display">State Licensing Lookup</h1>
          <p className="text-sm text-muted-foreground">Quick reference for low-voltage / security licensing requirements.</p>
        </div>
        <Link
          href="/org/compliance/state-licensing"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit All States
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="h-10 rounded-md border border-border bg-card pl-9 pr-8 text-sm font-medium text-foreground focus:border-primary focus:outline-none"
          >
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {!row && !loading && !error && (
        <div className="rounded-md border border-border bg-secondary p-6 text-center text-sm text-muted-foreground">
          No reference data on file for {state}.
        </div>
      )}

      {row && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-foreground">
                {row.license_type || 'No license type specified'}
              </div>
              <div className="mt-1.5">
                {row.license_required ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                    <ShieldCheck className="h-3 w-3" /> License Required
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground">
                    <ShieldX className="h-3 w-3" /> No State License
                  </span>
                )}
              </div>
            </div>
            {row.agency_url && (
              <a
                href={row.agency_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
              >
                {row.agency_name ?? 'Licensing Authority'} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {!row.agency_url && row.agency_name && (
              <span className="text-xs font-medium text-muted-foreground">{row.agency_name}</span>
            )}
          </div>

          {row.requirements_summary && (
            <p className="text-sm text-foreground leading-relaxed">{row.requirements_summary}</p>
          )}

          {row.notes && (
            <div className="rounded-md border border-warning/20 bg-warning/10 p-3">
              <div className="text-xs font-medium text-warning mb-1">Org Notes</div>
              <p className="text-sm text-warning">{row.notes}</p>
            </div>
          )}

          {row.last_verified_at && (
            <p className="text-xs text-muted-foreground/60">
              Last verified {new Date(row.last_verified_at).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
