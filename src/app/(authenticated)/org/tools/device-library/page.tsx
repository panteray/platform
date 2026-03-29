'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Search, X, ShieldCheck, ShieldAlert, ShieldQuestion,
  Upload, Globe, Pencil, Save, Trash2, Sparkles,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDeviceLibrary } from '@/hooks/useDeviceLibrary'
import { DEVICE_CATEGORIES, DEVICE_LIBRARY_ROLES } from '@/types/enums'
import type { DeviceLibraryItem } from '@/types/database'

const EDITABLE_FIELDS = [
  { key: 'vendor', label: 'Manufacturer', type: 'text' },
  { key: 'model', label: 'Model / Part Number', type: 'text' },
  { key: 'partnumber', label: 'Part Number', type: 'text' },
  { key: 'category', label: 'Category', type: 'select' },
  { key: 'form', label: 'Form', type: 'text' },
  { key: 'resolution', label: 'Resolution', type: 'text' },
  { key: 'ir', label: 'IR', type: 'text' },
  { key: 'super_low_light', label: 'Super Low Light', type: 'checkbox' },
  { key: 'focal_length', label: 'Focal Length', type: 'text' },
  { key: 'focal_type', label: 'Focal Type', type: 'text' },
  { key: 'aov', label: 'AoV / FoV', type: 'text' },
  { key: 'imager_count', label: 'Imager Count', type: 'number' },
  { key: 'multi_imager_type', label: 'Multi-Imager Type', type: 'text' },
  { key: 'codecs', label: 'Codecs', type: 'text' },
  { key: 'fisheye_view', label: 'Fisheye View', type: 'text' },
  { key: 'environment', label: 'Environment', type: 'text' },
  { key: 'fps', label: 'FPS', type: 'text' },
  { key: 'poe_standard', label: 'PoE Standard', type: 'text' },
  { key: 'wattage', label: 'Wattage (W)', type: 'number' },
  { key: 'ndaa_compliant', label: 'NDAA Compliant', type: 'checkbox' },
  { key: 'subcategory', label: 'Subcategory', type: 'text' },
] as const

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
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <ShieldQuestion className="h-3.5 w-3.5" /> Unverified
    </span>
  )
}

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value != null && value !== '' ? String(value) : '-'}</p>
    </div>
  )
}

// ---- Edit Form (shared by drawer + bulk edit) ----

function EditForm({
  values,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  values: Record<string, unknown>
  onChange: (key: string, val: unknown) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {EDITABLE_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-[11px] text-muted-foreground">{f.label}</label>
            {f.type === 'checkbox' ? (
              <div className="flex items-center gap-2 h-8">
                <input
                  type="checkbox"
                  checked={!!values[f.key]}
                  onChange={(e) => onChange(f.key, e.target.checked)}
                  className="accent-current"
                />
                <span className="text-xs text-muted-foreground">
                  {values[f.key] ? 'Yes' : 'No'}
                </span>
              </div>
            ) : f.type === 'select' && f.key === 'category' ? (
              <select
                value={String(values[f.key] ?? '')}
                onChange={(e) => onChange(f.key, e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                {DEVICE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.type}
                value={String(values[f.key] ?? '')}
                onChange={(e) => onChange(f.key, f.type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="h-3 w-3" />
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---- Side Drawer ----

function SideDrawer({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: DeviceLibraryItem
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const specs = (item.specs ?? {}) as Record<string, unknown>
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, unknown>>({})

  function startEdit() {
    setEditValues({
      vendor: item.vendor,
      model: item.model,
      partnumber: item.partnumber ?? '',
      category: item.category,
      subcategory: item.subcategory ?? '',
      form: item.form ?? '',
      resolution: item.resolution ?? '',
      ir: item.ir ?? '',
      super_low_light: item.super_low_light ?? false,
      focal_length: item.focal_length ?? '',
      focal_type: item.focal_type ?? '',
      aov: item.aov ?? '',
      imager_count: item.imager_count ?? '',
      multi_imager_type: item.multi_imager_type ?? '',
      codecs: item.codecs ?? '',
      fisheye_view: item.fisheye_view ?? '',
      environment: item.environment ?? '',
      fps: item.fps ?? '',
      poe_standard: item.poe_standard ?? '',
      wattage: item.wattage ?? '',
      ndaa_compliant: item.ndaa_compliant,
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      for (const f of EDITABLE_FIELDS) {
        const val = editValues[f.key]
        if (f.type === 'number') {
          body[f.key] = val != null && val !== '' ? Number(val) : null
        } else if (f.type === 'checkbox') {
          body[f.key] = !!val
        } else {
          body[f.key] = val || null
        }
      }

      const res = await fetch(`/api/org/device-library/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setEditing(false)
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${item.vendor} — ${item.model}?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/org/device-library/items/${item.id}`, { method: 'DELETE' })
      if (res.ok) onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  const isOrgOwned = !!item.org_id

  return (
    <div className="w-[38%] flex-shrink-0 rounded-lg border border-border bg-background p-4 space-y-4 overflow-y-auto max-h-[80vh]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          {item.vendor} {item.model}
        </h2>
        <div className="flex items-center gap-1">
          {isOrgOwned && !editing && (
            <>
              <button
                onClick={startEdit}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-400 transition-colors disabled:opacity-50"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Source badge */}
      <div className="flex items-center gap-2">
        {item.org_id ? (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
            Org Item
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Globe className="h-3 w-3" /> Global
          </span>
        )}
        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
          {item.category}
        </span>
      </div>

      {editing ? (
        <EditForm
          values={editValues}
          onChange={(key, val) => setEditValues((prev) => ({ ...prev, [key]: val }))}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          saving={saving}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SpecRow label="Category" value={item.category} />
            <SpecRow label="Form" value={item.form} />
            <SpecRow label="Part Number" value={item.partnumber} />
            <SpecRow label="Resolution" value={item.resolution} />
            <SpecRow label="IR" value={item.ir} />
            <SpecRow label="Super Low Light" value={item.super_low_light != null ? (item.super_low_light ? 'Yes' : 'No') : null} />
            <SpecRow label="Focal Length" value={item.focal_length} />
            <SpecRow label="Focal Type" value={item.focal_type} />
            <SpecRow label="AoV / FoV" value={item.aov} />
            <SpecRow label="Imager Count" value={item.imager_count} />
            <SpecRow label="Multi-Imager Type" value={item.multi_imager_type} />
            <SpecRow label="Codecs" value={item.codecs} />
            {item.fisheye_view && <SpecRow label="Fisheye View" value={`${item.fisheye_view}°`} />}
            <SpecRow label="Environment" value={item.environment} />
            <SpecRow label="FPS" value={item.fps} />
            <SpecRow label="PoE Standard" value={item.poe_standard} />
            <SpecRow label="Wattage" value={item.wattage != null ? `${item.wattage}W` : null} />
            <div>
              <p className="text-[11px] text-muted-foreground">NDAA</p>
              <NdaaBadge value={item.ndaa_compliant} />
            </div>
          </div>

          {/* Extended specs from JSONB */}
          {Object.keys(specs).length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
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
          )}
        </>
      )}
    </div>
  )
}

// ---- Bulk Edit Modal ----

function BulkEditModal({
  count,
  ids,
  onClose,
  onSaved,
}: {
  count: number
  ids: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [values, setValues] = useState<Record<string, unknown>>({
    vendor: '', model: '', partnumber: '', category: '', subcategory: '',
    form: '', resolution: '', ir: '', super_low_light: false,
    focal_length: '', focal_type: '', aov: '', imager_count: '',
    multi_imager_type: '', codecs: '', fisheye_view: '', environment: '',
    fps: '', poe_standard: '', wattage: '', ndaa_compliant: false,
  })

  function handleChange(key: string, val: unknown) {
    setValues((prev) => ({ ...prev, [key]: val }))
    setTouched((prev) => new Set(prev).add(key))
  }

  async function handleSave() {
    if (touched.size === 0) { onClose(); return }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      for (const f of EDITABLE_FIELDS) {
        if (!touched.has(f.key)) continue
        const val = values[f.key]
        if (f.type === 'checkbox') {
          body[f.key] = !!val
        } else if (f.type === 'number') {
          body[f.key] = val != null && val !== '' ? Number(val) : null
        } else {
          body[f.key] = val ? String(val).trim() : null
        }
      }

      await Promise.all(
        ids.map((id) =>
          fetch(`/api/org/device-library/items/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        )
      )

      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-background p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Edit {count} Device{count > 1 ? 's' : ''}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">Only fields you change will be updated.</p>
        <EditForm
          values={values}
          onChange={handleChange}
          onSave={handleSave}
          onCancel={onClose}
          saving={saving}
        />
      </div>
    </div>
  )
}

// ---- Main Page ----

export default function DeviceLibraryPage() {
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
    refresh,
  } = useDeviceLibrary()

  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  const hasAccess = userRole && (DEVICE_LIBRARY_ROLES as readonly string[]).includes(userRole)

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (checked.size === results.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(results.map((r) => r.id)))
    }
  }

  const handleSaved = useCallback(() => {
    refresh()
    if (selectedItem) loadFullItem(selectedItem.id)
  }, [refresh, selectedItem, loadFullItem])

  const handleBulkSaved = useCallback(() => {
    setBulkEditOpen(false)
    setChecked(new Set())
    refresh()
  }, [refresh])

  async function handleBulkDelete() {
    if (!confirm(`Delete ${checked.size} device${checked.size > 1 ? 's' : ''}?`)) return
    await Promise.all(
      Array.from(checked).map((id) =>
        fetch(`/api/org/device-library/items/${id}`, { method: 'DELETE' })
      )
    )
    setChecked(new Set())
    clearSelection()
    refresh()
  }

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Device Library</h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Device Library</h1>
        <p className="text-sm text-muted-foreground">You do not have access to the Device Library.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Device Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Browse hardware specifications across all device categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          {checked.size > 0 && (
            <>
              <button
                onClick={() => setBulkEditOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Pencil className="h-4 w-4" />
                Edit Selected ({checked.size})
              </button>
              <button
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({checked.size})
              </button>
            </>
          )}
          <Link
            href="/org/tools/device-library/import"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import Devices
          </Link>
          <Link
            href="/org/tools/device-library/enrich"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Enrich Devices
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search vendor, model, part number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
        >
          <option value="">All Categories</option>
          {DEVICE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select
          value={filterNdaa}
          onChange={(e) => setFilterNdaa(e.target.value as '' | 'true' | 'false')}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
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
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
        <div className={`flex-1 overflow-x-auto rounded-lg border border-border bg-background ${selectedItem ? 'max-w-[60%]' : ''}`}>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading devices...</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No devices found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={checked.size === results.length && results.length > 0}
                      onChange={toggleAll}
                      className="accent-current"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Manufacturer</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Model</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Part #</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Form</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Resolution</th>
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors ${
                      selectedItem?.id === item.id ? 'bg-muted' : ''
                    }`}
                  >
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked.has(item.id)}
                        onChange={() => toggleCheck(item.id)}
                        className="accent-current"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground cursor-pointer" onClick={() => loadFullItem(item.id)}>{item.vendor}</td>
                    <td className="px-4 py-3 text-foreground cursor-pointer" onClick={() => loadFullItem(item.id)}>{item.model}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs cursor-pointer" onClick={() => loadFullItem(item.id)}>{item.partnumber ?? '-'}</td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => loadFullItem(item.id)}>
                      <span className="inline-flex rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground cursor-pointer" onClick={() => loadFullItem(item.id)}>{item.form ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground cursor-pointer" onClick={() => loadFullItem(item.id)}>{item.resolution ?? '-'}</td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => loadFullItem(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Side drawer */}
        {selectedItem && (
          <SideDrawer item={selectedItem} onClose={clearSelection} onSaved={handleSaved} onDeleted={() => { clearSelection(); refresh() }} />
        )}
      </div>

      {/* Bulk edit modal */}
      {bulkEditOpen && (
        <BulkEditModal
          count={checked.size}
          ids={Array.from(checked)}
          onClose={() => setBulkEditOpen(false)}
          onSaved={handleBulkSaved}
        />
      )}
    </div>
  )
}
