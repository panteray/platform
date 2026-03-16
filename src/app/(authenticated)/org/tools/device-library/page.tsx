'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search, X, ShieldCheck, ShieldAlert, ShieldQuestion,
  Upload, ChevronRight, Globe,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDeviceLibrary } from '@/hooks/useDeviceLibrary'
import { DEVICE_CATEGORIES, DEVICE_LIBRARY_ROLES } from '@/types/enums'
import type { DeviceLibraryItem } from '@/types/database'

function NdaaBadge({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1 text-green-500">
        <ShieldCheck className="h-3.5 w-3.5" /> Compliant
      </span>
    )
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1 text-red-500">
        <ShieldAlert className="h-3.5 w-3.5" /> Non-compliant
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-zinc-500">
      <ShieldQuestion className="h-3.5 w-3.5" /> Unverified
    </span>
  )
}

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-200">{value != null && value !== '' ? String(value) : '-'}</p>
    </div>
  )
}

function SideDrawer({
  item,
  onClose,
}: {
  item: DeviceLibraryItem
  onClose: () => void
}) {
  const specs = (item.specs ?? {}) as Record<string, unknown>

  return (
    <div className="w-[38%] flex-shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-4 overflow-y-auto max-h-[75vh]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">
          {item.vendor} {item.model}
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Source badge */}
      <div className="flex items-center gap-2">
        {item.org_id ? (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
            Org Item
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            <Globe className="h-3 w-3" /> Global
          </span>
        )}
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 uppercase">
          {item.category}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SpecRow label="Category" value={item.category} />
        <SpecRow label="Subcategory" value={item.subcategory} />
        <SpecRow label="Part Number" value={item.partnumber} />
        <div>
          <p className="text-[11px] text-zinc-500">NDAA</p>
          <NdaaBadge value={item.ndaa_compliant} />
        </div>
        <SpecRow label="Resolution" value={item.resolution} />
        <SpecRow label="FPS" value={item.fps} />
        <SpecRow label="PoE Standard" value={item.poe_standard} />
        <SpecRow label="Wattage" value={item.wattage != null ? `${item.wattage}W` : null} />
      </div>

      {/* Extended specs from JSONB */}
      {Object.keys(specs).length > 0 && (
        <>
          <div className="border-t border-zinc-800 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
              Extended Specs
            </p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(specs).map(([key, val]) => (
                <SpecRow
                  key={key}
                  label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  value={val != null ? String(val) : null}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function DeviceLibraryPage() {
  const router = useRouter()
  const { userRole, loading: userLoading } = useUser()
  const {
    results,
    loading,
    error,
    search,
    setSearch,
    filterCategory,
    setFilterCategory,
    filterNdaa,
    setFilterNdaa,
    selectedItem,
    loadFullItem,
    clearSelection,
  } = useDeviceLibrary()

  // Role check
  const hasAccess = userRole && (DEVICE_LIBRARY_ROLES as readonly string[]).includes(userRole)

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Device Library</h1>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Device Library</h1>
        <p className="text-sm text-zinc-500">You do not have access to the Device Library.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Device Library</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Browse hardware specifications across all device categories
          </p>
        </div>
        <Link
          href="/org/tools/device-library/import"
          className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Import Devices
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search vendor, model, part number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300"
        >
          <option value="">All Categories</option>
          {DEVICE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select
          value={filterNdaa}
          onChange={(e) => setFilterNdaa(e.target.value as '' | 'true' | 'false')}
          className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300"
        >
          <option value="">All NDAA</option>
          <option value="true">NDAA Compliant</option>
          <option value="false">Non-Compliant</option>
        </select>

        {(search || filterCategory || filterNdaa) && (
          <button
            onClick={() => {
              setSearch('')
              setFilterCategory('')
              setFilterNdaa('')
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Content: table + optional drawer */}
      <div className="flex gap-4">
        {/* Table */}
        <div className={`flex-1 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 ${selectedItem ? 'max-w-[60%]' : ''}`}>
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Loading devices...</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-sm font-medium text-zinc-400">No devices found</p>
              <p className="text-xs text-zinc-600 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Vendor</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Model</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Part #</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Category</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Subcategory</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">NDAA</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Source</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => loadFullItem(item.id)}
                    className={`border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/50 cursor-pointer transition-colors ${
                      selectedItem?.id === item.id ? 'bg-zinc-900' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-200">{item.vendor}</td>
                    <td className="px-4 py-3 text-zinc-300">{item.model}</td>
                    <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{item.partnumber ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{item.subcategory ?? '-'}</td>
                    <td className="px-4 py-3">
                      <NdaaBadge value={item.ndaa_compliant} />
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs">
                      {item.manufacturer_id ? 'Linked' : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Side drawer */}
        {selectedItem && (
          <SideDrawer item={selectedItem} onClose={clearSelection} />
        )}
      </div>
    </div>
  )
}
