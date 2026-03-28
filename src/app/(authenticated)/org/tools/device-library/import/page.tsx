'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Upload, Check, X, FileText, ChevronRight,
  CheckCircle2, XCircle, FileSpreadsheet, File,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { DEVICE_LIBRARY_ROLES, IMPORT_MAX_FILE_SIZE, IMPORT_ACCEPTED_EXTENSIONS } from '@/types/enums'
import type { DeviceImportBatch, DeviceImportRow } from '@/types/database'

type Step = 1 | 2 | 3

function FileTypeBadge({ name }: { name: string }) {
  const ext = name.toLowerCase().split('.').pop()
  if (ext === 'pdf') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
        <FileText className="h-3 w-3" /> PDF
      </span>
    )
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
        <FileSpreadsheet className="h-3 w-3" /> Excel
      </span>
    )
  }
  if (ext === 'csv') {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
        <File className="h-3 w-3" /> CSV
      </span>
    )
  }
  return null
}

export default function DeviceImportPage() {
  const { userRole, loading: userLoading } = useUser()
  const [step, setStep] = useState<Step>(1)
  const [vendor, setVendor] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 2
  const [batchId, setBatchId] = useState<string | null>(null)
  const [rows, setRows] = useState<DeviceImportRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowsLoading, setRowsLoading] = useState(false)
  const [bulkAction, setBulkAction] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)

  // Step 3
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<{ committed: number; total: number } | null>(null)

  // Batch history
  const [batches, setBatches] = useState<DeviceImportBatch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(true)

  const fileRef = useRef<HTMLInputElement>(null)

  const hasAccess = userRole && (DEVICE_LIBRARY_ROLES as readonly string[]).includes(userRole)

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true)
    try {
      const res = await fetch('/api/org/device-library/import/batches')
      if (res.ok) {
        const json = await res.json()
        setBatches(json.batches ?? [])
      }
    } finally {
      setBatchesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasAccess) {
      void loadBatches()
    }
  }, [hasAccess, loadBatches])

  async function loadRows(id: string) {
    setRowsLoading(true)
    try {
      const res = await fetch(`/api/org/device-library/import/batches/${id}/rows`)
      if (res.ok) {
        const json = await res.json()
        setRows(json.rows ?? [])
      }
    } finally {
      setRowsLoading(false)
    }
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    if (vendor.trim()) formData.append('vendor', vendor.trim())

    try {
      const res = await fetch('/api/org/device-library/import', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
        return
      }

      setBatchId(json.batchId)
      setStep(2)
      await loadRows(json.batchId)
      await loadBatches()
    } catch {
      setError('Network error')
    } finally {
      setUploading(false)
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const pendingRows = rows.filter((r) => r.status === 'pending')
    if (selected.size === pendingRows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendingRows.map((r) => r.id)))
    }
  }

  async function bulkApprove() {
    if (selected.size === 0 || !batchId) return
    setBulkAction(true)
    try {
      const res = await fetch(`/api/org/device-library/import/batches/${batchId}/rows`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIds: Array.from(selected), action: 'approved' }),
      })
      if (res.ok) {
        setSelected(new Set())
        await loadRows(batchId)
      }
    } finally {
      setBulkAction(false)
    }
  }

  async function bulkReject() {
    if (selected.size === 0 || !batchId) return
    setBulkAction(true)
    try {
      const res = await fetch(`/api/org/device-library/import/batches/${batchId}/rows`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIds: Array.from(selected), action: 'rejected' }),
      })
      if (res.ok) {
        setSelected(new Set())
        setRejectReason('')
        setShowRejectInput(false)
        await loadRows(batchId)
      }
    } finally {
      setBulkAction(false)
    }
  }

  async function singleAction(rowId: string, action: 'approved' | 'rejected') {
    if (!batchId) return
    await fetch(`/api/org/device-library/import/batches/${batchId}/rows`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIds: [rowId], action }),
    })
    await loadRows(batchId)
  }

  async function handleCommit() {
    if (!batchId) return
    setCommitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/org/device-library/import/commit/${batchId}`, {
        method: 'POST',
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Commit failed')
        return
      }

      setCommitResult({ committed: json.committed, total: json.total })
      setStep(3)
      await loadBatches()
    } finally {
      setCommitting(false)
    }
  }

  const approvedCount = rows.filter((r) => r.status === 'approved').length
  const rejectedCount = rows.filter((r) => r.status === 'rejected').length
  const pendingCount = rows.filter((r) => r.status === 'pending').length

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Import Devices</h1>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Import Devices</h1>
        <p className="text-sm text-zinc-500">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/org/tools/device-library"
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-white">Import Devices</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: 'Upload' },
          { n: 2, label: 'Review' },
          { n: 3, label: 'Commit' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= s.n
                  ? 'bg-white text-zinc-900'
                  : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {s.n}
            </div>
            <span className={`text-sm ${step >= s.n ? 'text-zinc-200' : 'text-zinc-600'}`}>
              {s.label}
            </span>
            {i < 2 && <ChevronRight className="h-4 w-4 text-zinc-700" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Vendor / Manufacturer Name</label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Axis, Hanwha, Verkada..."
              className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-600">
              Applied to all rows unless the file has a vendor/manufacturer column.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">
              File (PDF, Excel, or CSV — 25MB max)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept={IMPORT_ACCEPTED_EXTENSIONS.join(',')}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-500 file:mr-4 file:rounded-md file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200"
            />
            {file && (
              <div className="flex items-center gap-2 mt-1">
                <FileTypeBadge name={file.name} />
                <span className="text-xs text-zinc-500">{file.name}</span>
                <span className="text-xs text-zinc-600">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </div>
            )}
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-500 space-y-1">
            <p className="font-medium text-zinc-400">Supported formats:</p>
            <p><strong className="text-zinc-300">PDF</strong> — Spec sheets are scanned for SKU patterns with confidence scoring.</p>
            <p><strong className="text-zinc-300">Excel / CSV</strong> — Structured data with columns mapped automatically (part number, model, category, etc.).</p>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Parsing...' : 'Upload & Parse'}
          </button>
        </div>
      )}

      {/* Step 2 — Review */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-400">
              Approved: <strong className="text-green-500">{approvedCount}</strong>
            </span>
            <span className="text-zinc-400">
              Rejected: <strong className="text-red-500">{rejectedCount}</strong>
            </span>
            <span className="text-zinc-400">
              Pending: <strong className="text-zinc-200">{pendingCount}</strong>
            </span>
            <span className="text-zinc-500">
              Total: <strong>{rows.length}</strong>
            </span>
          </div>

          {/* Bulk actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={bulkApprove}
              disabled={selected.size === 0 || bulkAction}
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-3.5 w-3.5" />
              Approve Selected ({selected.size})
            </button>

            {showRejectInput ? (
              <div className="flex items-center gap-2">
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason..."
                  className="h-8 w-48 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                />
                <button
                  onClick={bulkReject}
                  disabled={bulkAction}
                  className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRejectInput(true)}
                disabled={selected.size === 0}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-3.5 w-3.5" />
                Reject Selected
              </button>
            )}
          </div>

          {/* Rows table */}
          {rowsLoading ? (
            <p className="text-sm text-zinc-500">Loading rows...</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === rows.filter((r) => r.status === 'pending').length && rows.filter((r) => r.status === 'pending').length > 0}
                        onChange={toggleAll}
                        className="accent-white"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Part #</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Model</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Category</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Confidence</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">NDAA</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</th>
                    <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/30">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          disabled={row.status !== 'pending'}
                          className="accent-white"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-300">{row.partnumber ?? '-'}</td>
                      <td className="px-3 py-2 text-zinc-300">{row.model ?? '-'}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 uppercase">
                          {row.category ?? '-'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-white"
                              style={{ width: `${row.confidence ?? 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-zinc-500">
                            {Math.round(row.confidence ?? 0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {row.ndaa_compliant ? (
                          <span className="text-green-500 text-xs">Yes</span>
                        ) : (
                          <span className="text-zinc-600 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === 'approved' && (
                          <span className="inline-flex rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                            Approved
                          </span>
                        )}
                        {row.status === 'rejected' && (
                          <span className="inline-flex rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                            Rejected
                          </span>
                        )}
                        {row.status === 'pending' && (
                          <span className="inline-flex rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                            Pending
                          </span>
                        )}
                        {row.status === 'committed' && (
                          <span className="inline-flex rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                            Committed
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === 'pending' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => singleAction(row.id, 'approved')}
                              className="text-green-500 hover:text-green-400"
                              title="Approve"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => singleAction(row.id, 'rejected')}
                              className="text-red-500 hover:text-red-400"
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={handleCommit}
            disabled={approvedCount === 0 || committing}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {committing ? 'Committing...' : `Commit ${approvedCount} Approved Items`}
          </button>
        </div>
      )}

      {/* Step 3 — Commit result */}
      {step === 3 && commitResult && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 space-y-4 max-w-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <h2 className="text-lg font-semibold text-white">Import Complete</h2>
              <p className="text-sm text-zinc-400">
                {commitResult.committed} items added to the Device Library
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/org/tools/device-library"
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
            >
              View Device Library
            </Link>
            <button
              onClick={() => {
                setStep(1)
                setFile(null)
                setVendor('')
                setBatchId(null)
                setRows([])
                setSelected(new Set())
                setCommitResult(null)
                setError(null)
              }}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              Import Another
            </button>
          </div>
        </div>
      )}

      {/* Batch history */}
      <div className="space-y-3 pt-4 border-t border-zinc-800">
        <h2 className="text-lg font-semibold text-white">Import History</h2>
        {batchesLoading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : batches.length === 0 ? (
          <p className="text-sm text-zinc-500">No past imports.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Filename</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Vendor</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Rows</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-3 flex items-center gap-2 text-zinc-300">
                      <FileText className="h-4 w-4 text-zinc-600" />
                      {b.file_name ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      {b.file_name && <FileTypeBadge name={b.file_name} />}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{b.vendor ?? '-'}</td>
                    <td className="px-4 py-3">
                      {b.status === 'committed' ? (
                        <span className="inline-flex rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                          Committed
                        </span>
                      ) : b.status === 'failed' ? (
                        <span className="inline-flex rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                          {b.status ?? 'Parsed'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {b.total_rows ?? 0} total
                      {b.approved_rows != null && ` / ${b.approved_rows} approved`}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(b.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
