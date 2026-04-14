'use client'

import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import { Building2, FileText, Upload, DollarSign, AlertCircle, Check } from 'lucide-react'

interface PortalData {
  project: {
    id: string
    pn: string
    name: string
    status: string
    site_address: string | null
    site_city: string | null
    site_state: string | null
    start_date: string | null
    target_end_date: string | null
  } | null
  sub: {
    id: string
    name: string
    primary_contact_name: string | null
    primary_contact_email: string | null
  } | null
  assignment: {
    id: string
    status: string
    scope: string | null
    po_number: string | null
    po_amount: number | null
    invoiced_amount: number
  } | null
  permissions: string[]
}

export default function SubPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'invoice'>('overview')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/org/sub-portal/${token}`)
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Access denied')
      } else {
        setData(await res.json())
      }
    } catch {
      setError('Unable to load portal')
    }
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center max-w-md">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <h1 className="text-lg font-bold text-red-900">{error ?? 'Access Denied'}</h1>
          <p className="mt-2 text-sm text-red-700">This portal link may be expired or invalid.</p>
        </div>
      </div>
    )
  }

  const { project, sub, assignment, permissions } = data
  const variance = assignment && assignment.po_amount ? assignment.invoiced_amount - assignment.po_amount : 0

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Subcontractor Portal</p>
              <h1 className="mt-0.5 text-2xl font-bold text-neutral-900">{project?.name}</h1>
              <p className="text-sm text-neutral-500">PN {project?.pn}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Assigned To</p>
              <p className="text-sm font-bold text-neutral-900">{sub?.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-6">
          <nav className="flex gap-6">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
            {permissions.includes('upload') && (
              <TabButton active={activeTab === 'upload'} onClick={() => setActiveTab('upload')}>Upload</TabButton>
            )}
            {permissions.includes('invoice') && (
              <TabButton active={activeTab === 'invoice'} onClick={() => setActiveTab('invoice')}>Invoice</TabButton>
            )}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Project Info */}
            <Card title="Project" icon={<Building2 className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="Status" value={project?.status} />
                <Field label="Project #" value={project?.pn} />
                <Field label="Site" value={[project?.site_address, project?.site_city, project?.site_state].filter(Boolean).join(', ') || '—'} />
                <Field label="Timeline" value={project?.start_date && project?.target_end_date ? `${project.start_date} → ${project.target_end_date}` : '—'} />
              </div>
            </Card>

            {/* Assignment Info */}
            {assignment && (
              <Card title="Assignment" icon={<FileText className="h-4 w-4" />}>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <Field label="Status" value={assignment.status.replace(/_/g, ' ')} />
                  <Field label="PO Number" value={assignment.po_number ?? '—'} />
                  <Field label="PO Amount" value={assignment.po_amount ? `$${assignment.po_amount.toLocaleString()}` : '—'} />
                  <Field label="Invoiced" value={`$${assignment.invoiced_amount.toLocaleString()}`} />
                  <Field label="Variance" value={variance ? `$${Math.abs(variance).toLocaleString()} ${variance > 0 ? 'over' : 'under'}` : '—'} highlight={variance > 0 ? 'red' : undefined} />
                </div>
                {assignment.scope && (
                  <div className="mt-4">
                    <p className="text-[10px] font-bold uppercase text-neutral-500">Scope</p>
                    <p className="mt-1 text-sm text-neutral-900">{assignment.scope}</p>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {activeTab === 'upload' && <UploadTab token={token} />}
        {activeTab === 'invoice' && <InvoiceTab token={token} />}
      </main>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 py-3 text-sm font-semibold ${active ? 'border-primary text-primary' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}
    >
      {children}
    </button>
  )
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
        {icon} {title}
      </h2>
      {children}
    </section>
  )
}

function Field({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: 'red' | 'green' }) {
  const cls = highlight === 'red' ? 'text-red-600' : highlight === 'green' ? 'text-emerald-600' : 'text-neutral-900'
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-neutral-500">{label}</p>
      <p className={`text-sm font-semibold ${cls}`}>{value ?? '—'}</p>
    </div>
  )
}

function UploadTab({ token }: { token: string }) {
  const [uploadType, setUploadType] = useState<'daily_report' | 'document'>('daily_report')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Daily report
  const [summary, setSummary] = useState('')
  const [crewCount, setCrewCount] = useState('')
  const [hoursWorked, setHoursWorked] = useState('')
  const [safetyNotes, setSafetyNotes] = useState('')

  // Document
  const [docType, setDocType] = useState('coi')
  const [docName, setDocName] = useState('')
  const [storageUrl, setStorageUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const submit = async () => {
    setSubmitting(true)
    const body = uploadType === 'daily_report'
      ? { upload_type: 'daily_report', summary, crew_count: parseInt(crewCount) || 0, hours_worked: parseFloat(hoursWorked) || 0, safety_notes: safetyNotes }
      : { upload_type: 'document', doc_type: docType, doc_name: docName, storage_url: storageUrl, expires_at: expiresAt || null }

    const res = await fetch(`/api/org/sub-portal/${token}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setSubmitted(true)
      setSummary(''); setCrewCount(''); setHoursWorked(''); setSafetyNotes('')
      setDocName(''); setStorageUrl(''); setExpiresAt('')
      setTimeout(() => setSubmitted(false), 3000)
    }
    setSubmitting(false)
  }

  return (
    <Card title="Upload" icon={<Upload className="h-4 w-4" />}>
      <div className="mb-4 flex gap-2">
        <button onClick={() => setUploadType('daily_report')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${uploadType === 'daily_report' ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 text-neutral-600'}`}>
          Daily Report
        </button>
        <button onClick={() => setUploadType('document')} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${uploadType === 'document' ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 text-neutral-600'}`}>
          Document
        </button>
      </div>

      {uploadType === 'daily_report' ? (
        <div className="space-y-3">
          <textarea value={summary} onChange={e => setSummary(e.target.value)} placeholder="Today's work summary…" rows={3} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" value={crewCount} onChange={e => setCrewCount(e.target.value)} placeholder="Crew count" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
            <input type="number" value={hoursWorked} onChange={e => setHoursWorked(e.target.value)} placeholder="Hours worked" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <textarea value={safetyNotes} onChange={e => setSafetyNotes(e.target.value)} placeholder="Safety notes / incidents…" rows={2} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
        </div>
      ) : (
        <div className="space-y-3">
          <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm">
            <option value="coi">Certificate of Insurance</option>
            <option value="w9">W-9</option>
            <option value="license">License</option>
            <option value="bond">Bond</option>
            <option value="msa">MSA</option>
            <option value="safety_cert">Safety Cert</option>
            <option value="other">Other</option>
          </select>
          <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="Document name" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
          <input value={storageUrl} onChange={e => setStorageUrl(e.target.value)} placeholder="File URL" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} placeholder="Expires" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
        </div>
      )}

      <button onClick={submit} disabled={submitting} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {submitted ? <><Check className="h-4 w-4" /> Submitted</> : submitting ? 'Submitting…' : 'Submit'}
      </button>
    </Card>
  )
}

function InvoiceTab({ token }: { token: string }) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const submit = async () => {
    if (!amount) return
    setSubmitting(true)
    const res = await fetch(`/api/org/sub-portal/${token}/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_amount: parseFloat(amount), notes }),
    })
    if (res.ok) {
      setResult({ ok: true, msg: 'Invoice submitted' })
      setAmount(''); setNotes('')
    } else {
      const j = await res.json()
      setResult({ ok: false, msg: j.error ?? 'Failed' })
    }
    setSubmitting(false)
  }

  return (
    <Card title="Submit Invoice" icon={<DollarSign className="h-4 w-4" />}>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Amount ($)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes / line items…" rows={3} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
        <button onClick={submit} disabled={!amount || submitting} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit Invoice'}
        </button>
        {result && (
          <p className={`text-xs ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>{result.msg}</p>
        )}
      </div>
    </Card>
  )
}
