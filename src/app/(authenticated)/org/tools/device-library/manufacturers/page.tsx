'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, ShieldCheck, ShieldAlert, ShieldQuestion, ShieldOff,
  Globe, ExternalLink, X,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDeviceLibraryManufacturers } from '@/hooks/useDeviceLibraryManufacturers'
import { DEVICE_LIBRARY_ROLES, NDAA_STATUS_OPTIONS } from '@/types/enums'
import type { DeviceLibraryManufacturer } from '@/types/database'

function NdaaStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'compliant':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
          <ShieldCheck className="h-3 w-3" /> Compliant
        </span>
      )
    case 'non_compliant':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
          <ShieldAlert className="h-3 w-3" /> Non-Compliant
        </span>
      )
    case 'mixed':
      return (
        <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
          <ShieldOff className="h-3 w-3" /> Mixed
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
          <ShieldQuestion className="h-3 w-3" /> Unverified
        </span>
      )
  }
}

function AddManufacturerForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: { name: string; ndaa_status: string; ndaa_notes: string; website: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [ndaaStatus, setNdaaStatus] = useState('unverified')
  const [ndaaNotes, setNdaaNotes] = useState('')
  const [website, setWebsite] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim()) return
    setSaving(true)
    await onSubmit({ name: name.trim(), ndaa_status: ndaaStatus, ndaa_notes: ndaaNotes.trim(), website: website.trim() })
    setSaving(false)
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Add Device Manufacturer</h3>
        <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-zinc-500">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Axis Communications"
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-zinc-500">NDAA Status</label>
          <select
            value={ndaaStatus}
            onChange={(e) => setNdaaStatus(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none"
          >
            {NDAA_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-zinc-500">Website</label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://..."
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-zinc-500">NDAA Notes</label>
          <input
            type="text"
            value={ndaaNotes}
            onChange={(e) => setNdaaNotes(e.target.value)}
            placeholder="Optional notes..."
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
          className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Add Manufacturer'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function DeviceLibraryManufacturersPage() {
  const { userRole, loading: userLoading } = useUser()
  const { manufacturers, loading, error, createManufacturer } = useDeviceLibraryManufacturers()
  const [showAdd, setShowAdd] = useState(false)

  const hasAccess = userRole && (DEVICE_LIBRARY_ROLES as readonly string[]).includes(userRole)

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Device Manufacturers</h1>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Device Manufacturers</h1>
        <p className="text-sm text-zinc-500">Access denied.</p>
      </div>
    )
  }

  const globalMfrs = manufacturers.filter((m) => !m.org_id)
  const orgMfrs = manufacturers.filter((m) => m.org_id)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/org/tools/device-library"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white">Device Manufacturers</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Manage hardware manufacturers with NDAA compliance tracking
            </p>
          </div>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Manufacturer
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <AddManufacturerForm
          onSubmit={async (data) => {
            await createManufacturer(data)
            setShowAdd(false)
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading manufacturers...</p>
      ) : manufacturers.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
          <p className="text-sm font-medium text-zinc-400">No manufacturers found</p>
          <p className="text-xs text-zinc-600 mt-1">Add your first device manufacturer above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Org-specific */}
          {orgMfrs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
                Your Organization ({orgMfrs.length})
              </h2>
              <MfrTable items={orgMfrs} showSource={false} />
            </div>
          )}

          {/* Global */}
          {globalMfrs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
                Global Library ({globalMfrs.length})
              </h2>
              <MfrTable items={globalMfrs} showSource />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MfrTable({ items, showSource }: { items: DeviceLibraryManufacturer[]; showSource: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Name</th>
            <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">NDAA Status</th>
            <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Website</th>
            <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</th>
            {showSource && (
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Source</th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/30">
              <td className="px-4 py-3 font-medium text-zinc-200">{m.name}</td>
              <td className="px-4 py-3">
                <NdaaStatusBadge status={m.ndaa_status} />
              </td>
              <td className="px-4 py-3">
                {m.website ? (
                  <a
                    href={m.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    {m.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-xs text-zinc-600">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                {m.is_active ? (
                  <span className="inline-flex rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">Active</span>
                ) : (
                  <span className="inline-flex rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-500">Inactive</span>
                )}
              </td>
              {showSource && (
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                    <Globe className="h-3 w-3" /> Global
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
