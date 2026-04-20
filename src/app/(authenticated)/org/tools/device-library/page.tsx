'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  X, ShieldCheck, ShieldAlert, ShieldQuestion,
  Upload, Globe, Pencil, Save, Trash2, Sparkles,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { DEVICE_CATEGORIES, DEVICE_LIBRARY_ROLES } from '@/types/enums'

const DEVICE_LIBRARY_WRITE_ROLES = [
  'GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER', 'PRESALES',
] as const
import type { DeviceLibraryItem, DeviceElement } from '@/types/database'
import { DeviceGrid } from '@/components/device-library/device-grid'
import { ElementAttributeForm } from '@/components/device-library/ElementAttributeForm'

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
  { key: 'ul_listed', label: 'UL Listed', type: 'checkbox' },
  { key: 'ul_listing_code', label: 'UL Listing Code (e.g. UL 294)', type: 'text' },
  { key: 'subcategory', label: 'Subcategory', type: 'text' },
] as const

function NdaaBadge({ value }: { value: boolean | null }) {
  if (value === true) return <span className="inline-flex items-center gap-1 text-green-500"><ShieldCheck className="h-3.5 w-3.5" /> Compliant</span>
  if (value === false) return <span className="inline-flex items-center gap-1 text-red-500"><ShieldAlert className="h-3.5 w-3.5" /> Non-compliant</span>
  return <span className="inline-flex items-center gap-1 text-muted-foreground"><ShieldQuestion className="h-3.5 w-3.5" /> Unverified</span>
}

function SpecRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value != null && value !== '' ? String(value) : '-'}</p>
    </div>
  )
}

// ---- Edit Form ----

function EditForm({
  values, onChange, onSave, onCancel, saving,
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
                <input type="checkbox" checked={!!values[f.key]} onChange={(e) => onChange(f.key, e.target.checked)} className="accent-current" />
                <span className="text-xs text-muted-foreground">{values[f.key] ? 'Yes' : 'No'}</span>
              </div>
            ) : f.type === 'select' && f.key === 'category' ? (
              <select value={String(values[f.key] ?? '')} onChange={(e) => onChange(f.key, e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground">
                {DEVICE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            ) : (
              <input type={f.type} value={String(values[f.key] ?? '')}
                onChange={(e) => onChange(f.key, f.type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none" />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onSave} disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <Save className="h-3 w-3" />{saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---- Dynamic Edit Form (schema-driven, non-CCTV) ----

function DynamicEditForm({
  element, headerValues, attrValues, onHeaderChange, onAttrChange, onSave, onCancel, saving,
}: {
  element: DeviceElement
  headerValues: Record<string, unknown>
  attrValues: Record<string, unknown>
  onHeaderChange: (key: string, val: unknown) => void
  onAttrChange: (key: string, val: unknown) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Manufacturer</label>
          <input type="text" value={String(headerValues.vendor ?? '')}
            onChange={(e) => onHeaderChange('vendor', e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:border-ring focus:outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Model</label>
          <input type="text" value={String(headerValues.model ?? '')}
            onChange={(e) => onHeaderChange('model', e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:border-ring focus:outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Part Number</label>
          <input type="text" value={String(headerValues.partnumber ?? '')}
            onChange={(e) => onHeaderChange('partnumber', e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:border-ring focus:outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">NDAA Compliant</label>
          <div className="flex items-center gap-2 h-8">
            <input type="checkbox" checked={!!headerValues.ndaa_compliant}
              onChange={(e) => onHeaderChange('ndaa_compliant', e.target.checked)}
              className="accent-current" />
            <span className="text-xs text-muted-foreground">{headerValues.ndaa_compliant ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          {element.name} Attributes
        </p>
        <ElementAttributeForm
          element={element}
          values={attrValues}
          onChange={onAttrChange}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onSave} disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <Save className="h-3 w-3" />{saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---- Side Drawer ----

function SideDrawer({ item, element, onClose, onSaved, onDeleted, canWrite }: {
  item: DeviceLibraryItem
  element: DeviceElement | null
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
  canWrite: boolean
}) {
  const specs = (item.specs ?? {}) as Record<string, unknown>
  const attributes = (item.attributes ?? {}) as Record<string, unknown>
  const isCctv = item.category === 'cctv'
  const useDynamic = !isCctv && element !== null
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, unknown>>({})
  const [editAttrs, setEditAttrs] = useState<Record<string, unknown>>({})

  function startEdit() {
    setEditValues({
      vendor: item.vendor, model: item.model, partnumber: item.partnumber ?? '',
      category: item.category, subcategory: item.subcategory ?? '', form: item.form ?? '',
      resolution: item.resolution ?? '', ir: item.ir ?? '', super_low_light: item.super_low_light ?? false,
      focal_length: item.focal_length ?? '', focal_type: item.focal_type ?? '',
      aov: item.aov ?? '', imager_count: item.imager_count ?? '',
      multi_imager_type: item.multi_imager_type ?? '', codecs: item.codecs ?? '',
      fisheye_view: item.fisheye_view ?? '', environment: item.environment ?? '',
      fps: item.fps ?? '', poe_standard: item.poe_standard ?? '',
      wattage: item.wattage ?? '', ndaa_compliant: item.ndaa_compliant,
      ul_listed: item.ul_listed ?? false, ul_listing_code: item.ul_listing_code ?? '',
    })
    setEditAttrs({ ...attributes })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (useDynamic) {
        body.vendor = editValues.vendor || null
        body.model = editValues.model || null
        body.partnumber = editValues.partnumber || null
        body.category = editValues.category || null
        body.ndaa_compliant = !!editValues.ndaa_compliant
        body.attributes = editAttrs
      } else {
        for (const f of EDITABLE_FIELDS) {
          const val = editValues[f.key]
          if (f.type === 'number') body[f.key] = val != null && val !== '' ? Number(val) : null
          else if (f.type === 'checkbox') body[f.key] = !!val
          else body[f.key] = val || null
        }
      }
      const res = await fetch(`/api/org/device-library/items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.ok) { setEditing(false); onSaved() }
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${item.vendor} — ${item.model}?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/org/device-library/items/${item.id}`, { method: 'DELETE' })
      if (res.ok) onDeleted()
    } finally { setDeleting(false) }
  }

  return (
    <div className="w-[38%] flex-shrink-0 rounded-lg border border-border bg-background p-4 space-y-4 overflow-y-auto max-h-[80vh]">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{item.vendor} {item.model}</h2>
        <div className="flex items-center gap-1">
          {canWrite && !editing && (
            <>
              <button onClick={startEdit} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-400 transition-colors disabled:opacity-50" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {item.org_id ? (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">Org Item</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"><Globe className="h-3 w-3" /> Global</span>
        )}
        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">{item.category}</span>
      </div>

      {editing ? (
        useDynamic && element ? (
          <DynamicEditForm
            element={element}
            headerValues={editValues}
            attrValues={editAttrs}
            onHeaderChange={(key, val) => setEditValues(prev => ({ ...prev, [key]: val }))}
            onAttrChange={(key, val) => setEditAttrs(prev => ({ ...prev, [key]: val }))}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            saving={saving}
          />
        ) : (
          <EditForm values={editValues} onChange={(key, val) => setEditValues(prev => ({ ...prev, [key]: val }))} onSave={handleSave} onCancel={() => setEditing(false)} saving={saving} />
        )
      ) : useDynamic && element ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SpecRow label="Element" value={element.name} />
            <SpecRow label="Category" value={item.category} />
            <SpecRow label="Part Number" value={item.partnumber} />
            <div>
              <p className="text-[11px] text-muted-foreground">NDAA</p>
              <NdaaBadge value={item.ndaa_compliant} />
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <ElementAttributeForm element={element} values={attributes} onChange={() => {}} readOnly />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <SpecRow label="Category" value={item.category} />
            <SpecRow label="Form" value={item.form} />
            <SpecRow label="Part Number" value={item.partnumber} />
            {item.category === 'cctv' && (
              <>
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
                <SpecRow label="FPS" value={item.fps} />
              </>
            )}
            <SpecRow label="Environment" value={item.environment} />
            <SpecRow label="PoE Standard" value={item.poe_standard} />
            <SpecRow label="Wattage" value={item.wattage != null ? `${item.wattage}W` : null} />
            <div>
              <p className="text-[11px] text-muted-foreground">NDAA</p>
              <NdaaBadge value={item.ndaa_compliant} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">UL Listing</p>
              {item.ul_listed ? (
                <span className="inline-flex items-center rounded border border-amber-500/50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                  {item.ul_listing_code ?? 'UL'}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </div>
          </div>
          {Object.keys(specs).length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Extended Specs</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(specs).map(([key, val]) => (
                  <SpecRow key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={val != null ? String(val) : null} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---- Main Page ----

export default function DeviceLibraryPage() {
  const { userRole, loading: userLoading } = useUser()
  const [selectedItem, setSelectedItem] = useState<DeviceLibraryItem | null>(null)
  const [elements, setElements] = useState<DeviceElement[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetch('/api/org/device-library/elements')
      .then(r => r.ok ? r.json() : { elements: [] })
      .then(j => setElements(j.elements ?? []))
      .catch(() => setElements([]))
  }, [])

  const hasAccess = userRole && (DEVICE_LIBRARY_ROLES as readonly string[]).includes(userRole)
  const canWrite = !!userRole && (DEVICE_LIBRARY_WRITE_ROLES as readonly string[]).includes(userRole)

  const loadFullItem = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/org/device-library/items/${id}`)
      if (res.ok) {
        const json = await res.json()
        setSelectedItem(json.item)
      }
    } catch { /* ignore */ }
  }, [])

  const handleSaved = useCallback(() => {
    setRefreshKey(k => k + 1)
    if (selectedItem) loadFullItem(selectedItem.id)
  }, [selectedItem, loadFullItem])

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Device Library</h1>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Device Library</h1>
        <p className="text-sm text-muted-foreground">You do not have access to the Device Library.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Device Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Browse hardware specifications across all device categories</p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <Link href="/org/tools/device-library/import"
              className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
              <Upload className="h-4 w-4" /> Import Devices
            </Link>
            <Link href="/org/tools/device-library/enrich"
              className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
              <Sparkles className="h-4 w-4" /> Enrich Devices
            </Link>
          </div>
        )}
      </div>

      {/* Content: DeviceGrid + optional drawer */}
      <div className="flex flex-1 overflow-hidden" key={refreshKey}>
        <div className={`flex-1 overflow-hidden ${selectedItem ? 'max-w-[62%]' : ''}`}>
          <DeviceGrid
            mode="browse"
            onBrowseClick={loadFullItem}
            onBulkChanged={() => setRefreshKey(k => k + 1)}
            canWrite={canWrite}
          />
        </div>

        {selectedItem && (
          <SideDrawer
            item={selectedItem}
            element={selectedItem.element_id ? elements.find(e => e.id === selectedItem.element_id) ?? null : null}
            onClose={() => setSelectedItem(null)}
            onSaved={handleSaved}
            onDeleted={() => { setSelectedItem(null); setRefreshKey(k => k + 1) }}
            canWrite={canWrite}
          />
        )}
      </div>
    </div>
  )
}
