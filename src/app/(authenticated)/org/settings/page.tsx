'use client'

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useOrgModules } from '@/hooks/useOrgModules'
import { MODULE_LABELS } from '@/lib/constants'
import { PLATFORM_MODULES, PSA_SUB_MODULES, ModuleName } from '@/types/enums'
import type { Organization } from '@/types/database'
import { Badge } from '@/components/ui/badge'

export default function OrgSettingsPage() {
  const { orgId } = useUser()
  const { modules, loading: modulesLoading } = useOrgModules(orgId)
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single()

      setOrg(data as Organization | null)
      setLoading(false)
    }

    load()
  }, [orgId])

  if (loading || modulesLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>
  }

  if (!org) {
    return <div className="text-sm text-muted-foreground">Organization not found</div>
  }

  // Build lookup for enabled modules
  const enabledSet = new Set(
    modules.filter((m) => m.is_enabled).map((m) => m.module)
  )

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Home</span>
        <ChevronRight className="h-3 w-3" />
        <span>Settings</span>
      </div>

      <h1 className="mb-5 text-lg font-medium">Organization Settings</h1>

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

          {/* Platform Modules */}
          <div className="mb-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Platform
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_MODULES.map((mod) => (
                <ModuleBadge
                  key={mod}
                  name={MODULE_LABELS[mod]}
                  enabled={enabledSet.has(mod)}
                />
              ))}
            </div>
          </div>

          {/* PSA */}
          <div className="mb-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              PSA — Service Engine
            </div>
            <div className="mb-2">
              <ModuleBadge
                name="PSA (Master)"
                enabled={enabledSet.has(ModuleName.PSA)}
              />
            </div>
            {enabledSet.has(ModuleName.PSA) && (
              <div className="flex flex-wrap gap-2">
                {PSA_SUB_MODULES.map((mod) => (
                  <ModuleBadge
                    key={mod}
                    name={MODULE_LABELS[mod]}
                    enabled={enabledSet.has(mod)}
                  />
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
