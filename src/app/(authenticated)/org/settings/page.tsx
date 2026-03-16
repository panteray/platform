'use client'

import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useOrgModules } from '@/hooks/useOrgModules'
import { MODULE_LABELS } from '@/lib/constants'
import { PLATFORM_MODULES, PSA_SUB_MODULES, ModuleName } from '@/types/enums'
import type { Organization } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function OrgSettingsPage() {
  const { orgId } = useUser()
  const { modules, loading: modulesLoading } = useOrgModules(orgId)
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    brand_color: '',
  })
  const [territories, setTerritories] = useState<string[]>([])
  const [newTerritory, setNewTerritory] = useState('')

  useEffect(() => {
    if (!orgId) return
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()

      const orgData = data as Organization | null
      setOrg(orgData)
      if (orgData) {
        setForm({
          name: orgData.name ?? '',
          description: orgData.description ?? '',
          brand_color: orgData.brand_color ?? '',
        })
        const settings = orgData.settings as Record<string, unknown> | null
        if (settings?.territories && Array.isArray(settings.territories)) {
          setTerritories(settings.territories as string[])
        }
      }
      setLoading(false)
    }

    load()
  }, [orgId])

  async function saveTerrritories(updated: string[]) {
    if (!orgId || !org) return
    const supabase = createClient()
    const currentSettings = (org.settings as Record<string, unknown>) ?? {}
    const newSettings = { ...currentSettings, territories: updated }
    const { error } = await supabase.from('organizations').update({ settings: newSettings }).eq('id', orgId)
    if (!error) {
      setTerritories(updated)
      setOrg((prev) => prev ? { ...prev, settings: newSettings } : null)
    }
  }

  function addTerritory() {
    const val = newTerritory.trim()
    if (!val || territories.includes(val)) return
    const updated = [...territories, val]
    setNewTerritory('')
    saveTerrritories(updated)
  }

  function removeTerritory(t: string) {
    saveTerrritories(territories.filter((x) => x !== t))
  }

  async function handleSave() {
    if (!orgId || !org) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('organizations')
      .update({
        name: form.name.trim() || org.name,
        description: form.description.trim() || null,
        brand_color: form.brand_color.trim() || null,
      })
      .eq('id', orgId)

    if (!error) {
      setOrg((prev) => prev ? {
        ...prev,
        name: form.name.trim() || prev.name,
        description: form.description.trim() || null,
        brand_color: form.brand_color.trim() || null,
      } : null)
    }
    setSaving(false)
  }

  if (loading || modulesLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>
  }

  if (!org) {
    return <div className="text-sm text-muted-foreground">Organization not found</div>
  }

  const enabledSet = new Set(
    modules.filter((m) => m.is_enabled).map((m) => m.module)
  )

  return (
    <div>
      <h1 className="text-lg font-medium">Organization</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Branding and organization information.
      </p>

      {/* Branding + Logo — two column grid matching CASDEX */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {/* Branding Card */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Branding
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Display Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Organization name"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Tagline / Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional tagline"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Brand color (hex)</Label>
              <div className="mt-1 flex gap-2">
                <input
                  type="color"
                  value={form.brand_color || '#7C3AED'}
                  onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-input p-0.5"
                />
                <Input
                  value={form.brand_color}
                  onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))}
                  placeholder="#7C3AED"
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <Button size="sm" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {/* Logo Card */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Logo
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Organization logo</p>
              <p className="text-xs text-muted-foreground">Upload coming soon</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Legal name, plan, and other org details are managed by your admin.
          </p>
        </div>
      </div>

      {/* Territories Config */}
      <div className="mb-6 rounded-lg border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Territories
        </p>
        <p className="text-xs text-muted-foreground">
          Define territories available for opportunity assignment. These appear as dropdown options on OPP create and detail pages.
        </p>
        <div className="flex flex-wrap gap-2">
          {territories.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground">
              {t}
              <button type="button" onClick={() => removeTerritory(t)} className="text-muted-foreground hover:text-red-500 transition-colors">&times;</button>
            </span>
          ))}
          {territories.length === 0 && <span className="text-xs text-muted-foreground">No territories configured yet.</span>}
        </div>
        <div className="flex gap-2">
          <Input
            value={newTerritory}
            onChange={(e) => setNewTerritory(e.target.value)}
            placeholder="Add territory (e.g. Northeast, Gulf South)"
            className="max-w-xs text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTerritory() } }}
          />
          <Button size="sm" variant="outline" onClick={addTerritory} disabled={!newTerritory.trim()}>
            Add
          </Button>
        </div>
      </div>

      {/* Org Info — Read Only */}
      <div className="mb-6 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5 text-sm font-medium">
          Organization Info
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 px-5 py-4">
          <InfoRow label="Name" value={org.name} />
          <InfoRow label="Phone" value={org.phone} />
          <InfoRow label="Address" value={org.address} />
          <InfoRow label="Primary Contact" value={org.primary_contact_name} />
          <InfoRow label="Contact Email" value={org.primary_contact_email} />
          <InfoRow label="Contact Phone" value={org.primary_contact_phone} />
          <InfoRow label="Description" value={org.description} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Badge variant={org.is_active ? 'success' : 'warning'} className="text-[10px]">
              {org.is_active ? 'Active' : 'Suspended'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Enabled Modules — Read Only */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3.5 text-sm font-medium">
          Enabled Modules
        </div>
        <div className="px-5 py-4">
          <div className="mb-3 text-xs text-muted-foreground">
            Module configuration is managed by Global Admin. Contact your administrator to request changes.
          </div>

          <div className="mb-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Platform
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_MODULES.map((mod) => (
                <ModuleBadge key={mod} name={MODULE_LABELS[mod]} enabled={enabledSet.has(mod)} />
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              PSA — Service Engine
            </div>
            <div className="mb-2">
              <ModuleBadge name="PSA (Master)" enabled={enabledSet.has(ModuleName.PSA)} />
            </div>
            {enabledSet.has(ModuleName.PSA) && (
              <div className="flex flex-wrap gap-2">
                {PSA_SUB_MODULES.map((mod) => (
                  <ModuleBadge key={mod} name={MODULE_LABELS[mod]} enabled={enabledSet.has(mod)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}:</span>{' '}
      <span className="text-[13px] text-foreground">{value || '---'}</span>
    </div>
  )
}

function ModuleBadge({ name, enabled }: { name: string; enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium ${
        enabled
          ? 'border-green-500/30 bg-green-500/10 text-green-400'
          : 'border-border bg-muted/30 text-muted-foreground'
      }`}
    >
      {name}
    </span>
  )
}
