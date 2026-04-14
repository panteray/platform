'use client'

import { useState } from 'react'
import type { Project } from '@/types/database'
import {
  Calendar, MapPin, DollarSign, AlertTriangle, Users, Target,
  Save, CheckCircle2,
} from 'lucide-react'

const STATUS_OPTIONS = ['planning', 'active', 'on_hold', 'punch_list', 'closeout', 'completed', 'cancelled'] as const
const RISK_LEVELS = ['LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'CRITICAL'] as const

interface ProjectWithRelations extends Project {
  pm?: { first_name: string; last_name: string; email: string } | null
  customer?: { name: string } | null
  opportunity?: { opp_number: string; project_name: string } | null
  project_tasks?: Array<{ count: number }> | null
  install_items?: Array<{ count: number }> | null
  daily_reports?: Array<{ count: number }> | null
  project_milestones?: Array<{ id: string; title: string; target_date: string | null; completed_at: string | null }> | null
}

interface Props {
  project: ProjectWithRelations
  onUpdate: (p: Project) => void
}

export function ProjectOverviewTab({ project, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: project.name,
    status: project.status,
    site_address: project.site_address ?? '',
    site_city: project.site_city ?? '',
    site_state: project.site_state ?? '',
    site_zip: project.site_zip ?? '',
    site_notes: project.site_notes ?? '',
    start_date: project.start_date ?? '',
    target_end_date: project.target_end_date ?? '',
    budget_amount: project.budget_amount?.toString() ?? '',
    risk_level: project.risk_level ?? 'LOW',
  })

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch(`/api/org/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        budget_amount: form.budget_amount ? parseFloat(form.budget_amount) : null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(updated)
      setEditing(false)
    }
    setSaving(false)
  }

  const pm = project.pm
  const customer = project.customer
  const opp = project.opportunity
  const taskCount = project.project_tasks?.[0]?.count ?? 0
  const installCount = project.install_items?.[0]?.count ?? 0
  const reportCount = project.daily_reports?.[0]?.count ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Project Overview</h3>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-primary hover:underline"
          >
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-3 w-3" /> Save
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryCard icon={<Users className="h-4 w-4 text-blue-500" />} label="Tasks" value={taskCount.toString()} />
        <SummaryCard icon={<Target className="h-4 w-4 text-emerald-500" />} label="Install Items" value={installCount.toString()} />
        <SummaryCard icon={<Calendar className="h-4 w-4 text-amber-500" />} label="Daily Reports" value={reportCount.toString()} />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
          label="Risk Level"
          value={project.risk_level ?? 'LOW'}
        />
      </div>

      {/* Details */}
      {editing ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Project Name">
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
          </FormField>
          <FormField label="Status">
            <select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as Project['status'] })}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Risk Level">
            <select
              value={form.risk_level}
              onChange={e => setForm({ ...form, risk_level: e.target.value })}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            >
              {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </FormField>
          <FormField label="Budget">
            <input
              type="number"
              value={form.budget_amount}
              onChange={e => setForm({ ...form, budget_amount: e.target.value })}
              placeholder="0.00"
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
          </FormField>
          <FormField label="Start Date">
            <input
              type="date"
              value={form.start_date}
              onChange={e => setForm({ ...form, start_date: e.target.value })}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
          </FormField>
          <FormField label="Target End">
            <input
              type="date"
              value={form.target_end_date}
              onChange={e => setForm({ ...form, target_end_date: e.target.value })}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
          </FormField>
          <FormField label="Site Address" span={2}>
            <input
              value={form.site_address}
              onChange={e => setForm({ ...form, site_address: e.target.value })}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
          </FormField>
          <FormField label="City">
            <input
              value={form.site_city}
              onChange={e => setForm({ ...form, site_city: e.target.value })}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="State">
              <input
                value={form.site_state}
                onChange={e => setForm({ ...form, site_state: e.target.value })}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              />
            </FormField>
            <FormField label="ZIP">
              <input
                value={form.site_zip}
                onChange={e => setForm({ ...form, site_zip: e.target.value })}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
              />
            </FormField>
          </div>
          <FormField label="Site Notes" span={2}>
            <textarea
              value={form.site_notes}
              onChange={e => setForm({ ...form, site_notes: e.target.value })}
              rows={3}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
            />
          </FormField>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <DetailRow label="Project Name" value={project.name} />
          <DetailRow label="PM" value={pm ? `${pm.first_name} ${pm.last_name}` : '—'} />
          <DetailRow label="Customer" value={customer?.name ?? '—'} />
          <DetailRow label="Opportunity" value={opp?.opp_number ?? '—'} />
          <DetailRow label="Budget" value={project.budget_amount ? `$${Number(project.budget_amount).toLocaleString()}` : '—'} icon={<DollarSign className="h-3 w-3" />} />
          <DetailRow label="Risk" value={project.risk_level ?? 'LOW'} icon={<AlertTriangle className="h-3 w-3" />} />
          <DetailRow label="Start Date" value={project.start_date ? new Date(project.start_date).toLocaleDateString() : '—'} icon={<Calendar className="h-3 w-3" />} />
          <DetailRow label="Target End" value={project.target_end_date ? new Date(project.target_end_date).toLocaleDateString() : '—'} icon={<Calendar className="h-3 w-3" />} />
          <DetailRow
            label="Location"
            value={[project.site_address, project.site_city, project.site_state, project.site_zip].filter(Boolean).join(', ') || '—'}
            icon={<MapPin className="h-3 w-3" />}
            span={2}
          />
          {project.site_notes && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Site Notes:</span>
              <p className="mt-0.5 text-foreground whitespace-pre-wrap">{project.site_notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Milestones */}
      {!editing && project.project_milestones && project.project_milestones.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Milestones</h4>
          <div className="space-y-1">
            {project.project_milestones.map(m => (
              <div key={m.id} className="flex items-center gap-2 rounded border border-border px-2.5 py-1.5">
                {m.completed_at ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground" />
                )}
                <span className={`text-xs ${m.completed_at ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {m.title}
                </span>
                {m.target_date && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date(m.target_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] text-muted-foreground">{label}</span></div>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  )
}

function DetailRow({ label, value, icon, span }: { label: string; value: string; icon?: React.ReactNode; span?: number }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <span className="text-muted-foreground">{label}:</span>
      <span className="ml-1.5 text-foreground inline-flex items-center gap-1">
        {icon}{value}
      </span>
    </div>
  )
}

function FormField({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">{label}</label>
      {children}
    </div>
  )
}
