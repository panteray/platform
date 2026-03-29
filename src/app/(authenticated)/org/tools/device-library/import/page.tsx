'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Upload, CheckCircle2, FileSpreadsheet, File,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { DEVICE_LIBRARY_ROLES, IMPORT_ACCEPTED_EXTENSIONS } from '@/types/enums'

function FileTypeBadge({ name }: { name: string }) {
  const ext = name.toLowerCase().split('.').pop()
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
  const [vendor, setVendor] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ imported: number; fileName: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  const hasAccess = userRole && (DEVICE_LIBRARY_ROLES as readonly string[]).includes(userRole)

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

      setResult({ imported: json.imported, fileName: json.fileName })
    } catch {
      setError('Network error')
    } finally {
      setUploading(false)
    }
  }

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

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Success state */}
      {result ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 space-y-4 max-w-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <h2 className="text-lg font-semibold text-white">Import Complete</h2>
              <p className="text-sm text-zinc-400">
                {result.imported} devices added to the library from {result.fileName}
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
                setFile(null)
                setVendor('')
                setResult(null)
                setError(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              Import Another
            </button>
          </div>
        </div>
      ) : (
        /* Upload form */
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
              File (Excel or CSV — 25MB max)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
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
            <p><strong className="text-zinc-300">Excel / CSV</strong> — Columns mapped automatically: part number, model, vendor, category, resolution, fps, poe, wattage, ndaa.</p>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Importing...' : 'Upload & Import'}
          </button>
        </div>
      )}
    </div>
  )
}
