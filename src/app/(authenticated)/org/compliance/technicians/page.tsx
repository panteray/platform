'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Search, Plus, X, ShieldCheck, ShieldAlert, Clock, Trash2, ExternalLink, Pencil } from 'lucide-react'

interface Tech {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
}

interface TechLicense {
  id: string
  user_id: string
  license_type: string
  license_number: string | null
  state: string
  issued_date: string | null
  expiration_date: string | null
  document_url: string | null
  status: 'active' | 'expired' | 'pending' | 'revoked'
  notes: string | null
  user?: { id: string; first_name: string | null; last_name: string | null; email: string; role: string }
}

interface TechCert {
  id: string
  user_id: string
  cert_body: string
  cert_type: string
  credential_id: string | null
  state: string | null
  issue_date: string | null
  expiration_date: string | null
  cpd_required: boolean
  cpd_hours_completed: number
  cpd_hours_required: number
  document_url: string | null
  status: 'active' | 'expired' | 'pending' | 'revoked'
  notes: string | null
  user?: { id: string; first_name: string | null; last_name: string | null; email: string; role: string }
}

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR',
  'PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

const CERT_BODIES = ['NICET', 'ESA', 'ASIS', 'AVIXA', 'COMPTIA', 'VENDOR', 'STATE', 'OTHER']

function techName(t: { first_name: string | null; last_name: string | null; email: string }) {
  const n = [t.first_name, t.last_name].filter(Boolean).join(' ').trim()
  return n || t.email
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr).getTime()
  return Math.floor((d - Date.now()) / (1000 * 60 * 60 * 24))
}

function ExpiryBadge({ item }: { item: { status: string; expiration_date: string | null } }) {
  if (item.status !== 'active') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
        {item.status}
      </span>
    )
  }
  const days = daysUntil(item.expiration_date)
  if (days === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
        <ShieldCheck className="h-3 w-3" /> Active
      </span>
    )
  }
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
        <ShieldAlert className="h-3 w-3" /> Expired {Math.abs(days)}d ago
      </span>
    )
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
        <Clock className="h-3 w-3" /> Expires in {days}d
      </span>
    )
  }
  if (days <= 90) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
        <Clock className="h-3 w-3" /> Expires in {days}d
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
      <ShieldCheck className="h-3 w-3" /> Active
    </span>
  )
}

export default function TechnicianCompliancePage() {
  const [activeTab, setActiveTab] = useState<'licenses' | 'certifications'>('licenses')
  const [techs, setTechs] = useState<Tech[]>([])
  const [licenses, setLicenses] = useState<TechLicense[]>([])
  const [certs, setCerts] = useState<TechCert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [addLicenseOpen, setAddLicenseOpen] = useState(false)
  const [addCertOpen, setAddCertOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [techRes, licRes, certRes] = await Promise.all([
        fetch('/api/org/psa/techs'),
        fetch('/api/org/compliance/technician-licenses'),
        fetch('/api/org/compliance/technician-certs'),
      ])
      if (!techRes.ok || !licRes.ok) throw new Error('Failed to load')
      const techData = await techRes.json()
      const licData = await licRes.json()
      setTechs(Array.isArray(techData) ? techData : [])
      setLicenses(Array.isArray(licData) ? licData : [])
      if (certRes.ok) {
        const certData = await certRes.json()
        setCerts(Array.isArray(certData) ? certData : [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const licensesByUser = useMemo(() => {
    const map = new Map<string, TechLicense[]>()
    for (const l of licenses) {
      if (!map.has(l.user_id)) map.set(l.user_id, [])
      map.get(l.user_id)!.push(l)
    }
    return map
  }, [licenses])

  const filteredTechs = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return techs
    return techs.filter(t =>
      techName(t).toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q)
    )
  }, [techs, filter])

  const filteredCerts = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return certs
    return certs.filter(c => {
      const name = c.user ? techName(c.user) : ''
      return (
        name.toLowerCase().includes(q) ||
        c.cert_body.toLowerCase().includes(q) ||
        c.cert_type.toLowerCase().includes(q) ||
        (c.credential_id ?? '').toLowerCase().includes(q)
      )
    })
  }, [certs, filter])

  const summary = useMemo(() => {
    let active = 0, expiring = 0, expired = 0
    for (const l of licenses) {
      if (l.status !== 'active') { expired++; continue }
      const d = daysUntil(l.expiration_date)
      if (d !== null && d < 0) expired++
      else if (d !== null && d <= 90) expiring++
      else active++
    }
    return { active, expiring, expired, total: licenses.length }
  }, [licenses])

  const certSummary = useMemo(() => {
    let active = 0, expiring = 0, expired = 0
    for (const c of certs) {
      if (c.status !== 'active') { expired++; continue }
      const d = daysUntil(c.expiration_date)
      if (d !== null && d < 0) expired++
      else if (d !== null && d <= 90) expiring++
      else active++
    }
    return { active, expiring, expired, total: certs.length }
  }, [certs])

  async function handleDeleteLicense(id: string) {
    if (!confirm('Delete this license record?')) return
    const res = await fetch(`/api/org/compliance/technician-licenses/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  async function handleDeleteCert(id: string) {
    if (!confirm('Delete this certification record?')) return
    const res = await fetch(`/api/org/compliance/technician-certs/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  const currentSummary = activeTab === 'licenses' ? summary : certSummary

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Technician Compliance</h1>
          <p className="text-sm text-slate-600">Track state licenses and certifications for field technicians. Expiring items auto-warn on dispatch.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/org/compliance/state-licensing"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" /> State Licensing
          </Link>
          <Link
            href="/org/compliance/org-docs"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" /> Org docs
          </Link>
          <Link
            href="/org/compliance/state-lookup"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" /> State lookup
          </Link>
          {activeTab === 'licenses' ? (
            <button
              onClick={() => setAddLicenseOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> Add license
            </button>
          ) : (
            <button
              onClick={() => setAddCertOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> Add certification
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('licenses')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'licenses'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Licenses
        </button>
        <button
          onClick={() => setActiveTab('certifications')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'certifications'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Certifications
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase text-slate-500">Total {activeTab}</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{currentSummary.total}</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-medium uppercase text-emerald-700">Active</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-900">{currentSummary.active}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-medium uppercase text-amber-700">Expiring (≤90d)</div>
          <div className="mt-1 text-2xl font-semibold text-amber-900">{currentSummary.expiring}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-xs font-medium uppercase text-red-700">Expired / inactive</div>
          <div className="mt-1 text-2xl font-semibold text-red-900">{currentSummary.expired}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={activeTab === 'licenses' ? 'Filter technicians…' : 'Filter certifications…'}
          className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-slate-900 focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : activeTab === 'licenses' ? (
        /* ===== LICENSES TAB ===== */
        <div className="space-y-3">
          {filteredTechs.map(t => {
            const techLic = licensesByUser.get(t.id) ?? []
            return (
              <div key={t.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{techName(t)}</div>
                    <div className="text-xs text-slate-500">{t.email} · {t.role}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {techLic.length} {techLic.length === 1 ? 'license' : 'licenses'}
                  </div>
                </div>
                {techLic.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">No licenses on file.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">State</th>
                        <th className="px-4 py-2 text-left font-medium">Type</th>
                        <th className="px-4 py-2 text-left font-medium">Number</th>
                        <th className="px-4 py-2 text-left font-medium">Expires</th>
                        <th className="px-4 py-2 text-left font-medium">Status</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {techLic.map(l => (
                        <tr key={l.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 font-medium text-slate-900">{l.state}</td>
                          <td className="px-4 py-2 text-slate-700">{l.license_type}</td>
                          <td className="px-4 py-2 font-mono text-xs text-slate-600">{l.license_number ?? '—'}</td>
                          <td className="px-4 py-2 text-slate-600">
                            {l.expiration_date ? new Date(l.expiration_date).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-2"><ExpiryBadge item={l} /></td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => handleDeleteLicense(l.id)}
                              className="text-slate-400 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
          {filteredTechs.length === 0 && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
              No technicians found.
            </div>
          )}
        </div>
      ) : (
        /* ===== CERTIFICATIONS TAB ===== */
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {filteredCerts.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No certifications found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Tech Name</th>
                  <th className="px-4 py-2 text-left font-medium">Cert Body</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Credential ID</th>
                  <th className="px-4 py-2 text-left font-medium">State</th>
                  <th className="px-4 py-2 text-left font-medium">Expires</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredCerts.map(c => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {c.user ? techName(c.user) : '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{c.cert_body}</td>
                    <td className="px-4 py-2 text-slate-700">{c.cert_type}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{c.credential_id ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{c.state ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {c.expiration_date ? new Date(c.expiration_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2"><ExpiryBadge item={c} /></td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleDeleteCert(c.id)}
                        className="text-slate-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {addLicenseOpen && (
        <AddLicenseDialog
          techs={techs}
          onClose={() => setAddLicenseOpen(false)}
          onSaved={() => { setAddLicenseOpen(false); load() }}
        />
      )}

      {addCertOpen && (
        <AddCertDialog
          techs={techs}
          onClose={() => setAddCertOpen(false)}
          onSaved={() => { setAddCertOpen(false); load() }}
        />
      )}
    </div>
  )
}

function AddLicenseDialog({
  techs,
  onClose,
  onSaved,
}: {
  techs: Tech[]
  onClose: () => void
  onSaved: () => void
}) {
  const [userId, setUserId] = useState(techs[0]?.id ?? '')
  const [licenseType, setLicenseType] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [state, setState] = useState('LA')
  const [issuedDate, setIssuedDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/org/compliance/technician-licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          license_type: licenseType,
          license_number: licenseNumber || null,
          state,
          issued_date: issuedDate || null,
          expiration_date: expirationDate || null,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to save')
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Add technician license</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="text-xs font-medium uppercase text-slate-600">Technician</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {techs.map(t => (
                <option key={t.id} value={t.id}>{techName(t)} ({t.role})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase text-slate-600">License type</label>
              <input
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                placeholder="e.g. Life Safety Installer"
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-slate-600">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-slate-600">License number</label>
            <input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase text-slate-600">Issued</label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-slate-600">Expiration</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-slate-600">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-900">{error}</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !userId || !licenseType || !state}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save license'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddCertDialog({
  techs,
  onClose,
  onSaved,
}: {
  techs: Tech[]
  onClose: () => void
  onSaved: () => void
}) {
  const [userId, setUserId] = useState(techs[0]?.id ?? '')
  const [certBody, setCertBody] = useState('NICET')
  const [certType, setCertType] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const [state, setState] = useState('LA')
  const [issueDate, setIssueDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/org/compliance/technician-certs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          cert_body: certBody,
          cert_type: certType,
          credential_id: credentialId || null,
          state: certBody === 'STATE' ? state : null,
          issue_date: issueDate || null,
          expiration_date: expirationDate || null,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'Failed to save')
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Add certification</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="text-xs font-medium uppercase text-slate-600">Technician</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {techs.map(t => (
                <option key={t.id} value={t.id}>{techName(t)} ({t.role})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase text-slate-600">Cert body</label>
              <select
                value={certBody}
                onChange={(e) => setCertBody(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {CERT_BODIES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-slate-600">Cert type</label>
              <input
                value={certType}
                onChange={(e) => setCertType(e.target.value)}
                placeholder="e.g. NICET Level II"
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-slate-600">Credential ID</label>
            <input
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-mono"
            />
          </div>
          {certBody === 'STATE' && (
            <div>
              <label className="text-xs font-medium uppercase text-slate-600">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium uppercase text-slate-600">Issue date</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-slate-600">Expiration</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-slate-600">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-900">{error}</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !userId || !certBody || !certType}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save certification'}
          </button>
        </div>
      </div>
    </div>
  )
}
