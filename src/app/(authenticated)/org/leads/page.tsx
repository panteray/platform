'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLeads } from '@/hooks/useLeads'
import { LeadsTable } from '@/components/leads/LeadsTable'
import { LeadForm } from '@/components/leads/LeadForm'
import { LeadKanban } from '@/components/leads/LeadKanban'
import { LeadDashboardWidgets } from '@/components/leads/LeadDashboardWidgets'
import { LeadMapView } from '@/components/leads/LeadMapView'
import { LeadCardScanner } from '@/components/leads/LeadCardScanner'
import { LeadManagerDashboard } from '@/components/leads/LeadManagerDashboard'
import { List, Columns3, BarChart3, MapPin, Plus, Camera } from 'lucide-react'

type ViewMode = 'table' | 'kanban' | 'map' | 'dashboard'

const VIEW_TABS: { key: ViewMode; label: string; icon: typeof List }[] = [
  { key: 'table', label: 'Table', icon: List },
  { key: 'kanban', label: 'Kanban', icon: Columns3 },
  { key: 'map', label: 'Map', icon: MapPin },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
]

export default function LeadsPage() {
  const router = useRouter()
  const { leads, loading, createLead, deleteLead } = useLeads()
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<ViewMode>('table')
  const [showScanner, setShowScanner] = useState(false)

  async function handleCreate(data: Record<string, unknown>) {
    setSaving(true)
    const created = await createLead(data)
    setSaving(false)
    if (created) {
      setShowCreate(false)
      router.push(`/org/leads/${created.id}`)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lead?')) return
    await deleteLead(id)
  }

  async function handleScanComplete(data: Record<string, string | null>) {
    setShowScanner(false)
    setSaving(true)
    const payload: Record<string, unknown> = {
      contact_first_name: data.first_name ?? '',
      contact_last_name: data.last_name ?? '',
      contact_title: data.title,
      contact_email: data.email,
      contact_phone: data.phone,
      contact_mobile: data.mobile,
      company_name: data.company,
      primary_website: data.website,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      source: 'BUSINESS_CARD_SCAN',
    }
    const created = await createLead(payload)
    setSaving(false)
    if (created) router.push(`/org/leads/${created.id}`)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage leads, track pipeline, and convert to opportunities
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
            {VIEW_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          {view !== 'dashboard' && view !== 'map' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
                Scan Card
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Lead
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4">
          <LeadForm
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
            saving={saving}
          />
        </div>
      )}

      {/* Views */}
      {view === 'table' && (
        <LeadsTable
          leads={leads}
          loading={loading}
          onDelete={handleDelete}
          onCreateClick={() => setShowCreate(true)}
        />
      )}

      {view === 'kanban' && (
        <LeadKanban
          leads={leads}
          loading={loading}
        />
      )}

      {view === 'map' && (
        <LeadMapView
          leads={leads}
          loading={loading}
        />
      )}

      {view === 'dashboard' && (
        <div className="space-y-6">
          {/* Individual rep dashboard (all roles) */}
          <LeadDashboardWidgets />

          {/* Manager dashboard (403 if not MANAGER+, component handles gracefully) */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Manager View
            </h2>
            <LeadManagerDashboard />
          </div>
        </div>
      )}

      {/* Card Scanner Modal */}
      {showScanner && (
        <LeadCardScanner
          onScanComplete={handleScanComplete}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
