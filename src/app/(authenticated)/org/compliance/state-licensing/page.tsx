'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldX,
  Check,
  X,
  Pencil,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'

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

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
  LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
}

type FilterMode = 'all' | 'required' | 'not_required'

export default function StateLicensingPage() {
  const [rows, setRows] = useState<OrgStateLicense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<OrgStateLicense>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/org/compliance/state-licensing')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load state licensing data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q
      || r.state.toLowerCase().includes(q)
      || (STATE_NAMES[r.state] ?? '').toLowerCase().includes(q)
      || (r.license_type ?? '').toLowerCase().includes(q)
      || (r.agency_name ?? '').toLowerCase().includes(q)
    const matchFilter =
      filter === 'all' ? true :
      filter === 'required' ? r.license_required :
      !r.license_required
    return matchSearch && matchFilter
  })

  const startEdit = (row: OrgStateLicense) => {
    setEditId(row.id)
    setEditData({
      license_required: row.license_required,
      license_type: row.license_type ?? '',
      requirements_summary: row.requirements_summary ?? '',
      agency_name: row.agency_name ?? '',
      agency_url: row.agency_url ?? '',
      notes: row.notes ?? '',
    })
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditData({})
  }

  const saveEdit = async () => {
    if (!editId) return
    setSaving(true)
    try {
      const res = await fetch('/api/org/compliance/state-licensing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, ...editData }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Save failed')
      }
      const updated = await res.json()
      setRows(prev => prev.map(r => r.id === editId ? updated : r))
      setEditId(null)
      setEditData({})
      toast.success('State licensing updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const reqCount = rows.filter(r => r.license_required).length
  const noReqCount = rows.filter(r => !r.license_required).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/org/compliance/technicians" className="text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">State Licensing Requirements</h1>
          <p className="text-sm text-slate-600">
            Editable 50-state + DC reference for security camera and alarm system installer licensing.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2">
          <div className="text-2xl font-bold text-red-900">{reqCount}</div>
          <div className="text-xs text-red-700">License Required</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
          <div className="text-2xl font-bold text-slate-900">{noReqCount}</div>
          <div className="text-xs text-slate-600">No State License</div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by state, license type, or agency…"
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-slate-900 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-slate-300 bg-white p-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Filter className="h-3 w-3" /> All
          </button>
          <button
            onClick={() => setFilter('required')}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'required' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="h-3 w-3" /> Required
          </button>
          <button
            onClick={() => setFilter('not_required')}
            className={`flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === 'not_required' ? 'bg-slate-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldX className="h-3 w-3" /> Not Required
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">State</th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">Required</th>
                <th className="px-4 py-3 font-medium text-slate-700">License Type</th>
                <th className="px-4 py-3 font-medium text-slate-700">Requirements</th>
                <th className="px-4 py-3 font-medium text-slate-700">Licensing Authority</th>
                <th className="px-4 py-3 font-medium text-slate-700">Notes</th>
                <th className="px-4 py-3 font-medium text-slate-700 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(row => (
                editId === row.id ? (
                  <tr key={row.id} className="bg-blue-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {row.state} — {STATE_NAMES[row.state]}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditData(d => ({ ...d, license_required: !d.license_required }))}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          editData.license_required
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {editData.license_required ? 'Yes' : 'No'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={editData.license_type ?? ''}
                        onChange={e => setEditData(d => ({ ...d, license_type: e.target.value }))}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="License type"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <textarea
                        value={editData.requirements_summary ?? ''}
                        onChange={e => setEditData(d => ({ ...d, requirements_summary: e.target.value }))}
                        rows={2}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none resize-y"
                        placeholder="Requirements"
                      />
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      <input
                        value={editData.agency_name ?? ''}
                        onChange={e => setEditData(d => ({ ...d, agency_name: e.target.value }))}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="Agency name"
                      />
                      <input
                        value={editData.agency_url ?? ''}
                        onChange={e => setEditData(d => ({ ...d, agency_url: e.target.value }))}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="https://..."
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={editData.notes ?? ''}
                        onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="Org notes"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="rounded p-1.5 text-green-700 hover:bg-green-100 disabled:opacity-50"
                          title="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      <span className="font-bold">{row.state}</span>
                      <span className="ml-1.5 text-slate-500">{STATE_NAMES[row.state]}</span>
                    </td>
                    <td className="px-4 py-3">
                      {row.license_required ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
                          <ShieldCheck className="h-3 w-3" /> Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                          <ShieldX className="h-3 w-3" /> None
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[200px]">
                      {row.license_type || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[280px]">
                      <span className="line-clamp-2">{row.requirements_summary || '—'}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {row.agency_name ? (
                        <div>
                          <div className="text-slate-700 font-medium text-xs">{row.agency_name}</div>
                          {row.agency_url && (
                            <a
                              href={row.agency_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800"
                            >
                              Website <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[150px]">
                      {row.notes || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => startEdit(row)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No states match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
