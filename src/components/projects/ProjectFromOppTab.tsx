'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban, Plus, ExternalLink, Users, Wrench, Loader2, Check } from 'lucide-react'
import type { Project, Opportunity } from '@/types/database'

interface Props {
  oppId: string
  opp: Opportunity
}

interface OrgUser {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
}

interface TeamEntry {
  user_id: string
  role: 'PM' | 'LEAD_TECH' | 'FIELD_TECH' | 'SUB' | 'PRESALES' | 'ENGINEER'
}

const TEAM_ROLES = [
  { value: 'PM', label: 'Project Manager' },
  { value: 'LEAD_TECH', label: 'Lead Technician' },
  { value: 'FIELD_TECH', label: 'Field Technician' },
  { value: 'SUB', label: 'Subcontractor' },
  { value: 'PRESALES', label: 'Presales' },
  { value: 'ENGINEER', label: 'Engineer' },
] as const

export function ProjectFromOppTab({ oppId, opp }: Props) {
  const router = useRouter()
  const [projects, setProjects] = useState<(Project & { pm?: { first_name: string; last_name: string } | null })[]>([])
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [pmId, setPmId] = useState('')
  const [teamEntries, setTeamEntries] = useState<TeamEntry[]>([])
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<string>('FIELD_TECH')
  const [result, setResult] = useState<{ id: string; pn: string; install_items_created: number } | null>(null)

  // PN number
  const [pnNumber, setPnNumber] = useState(opp.project_number ?? '')
  const [pnSaving, setPnSaving] = useState(false)
  const [pnSaved, setPnSaved] = useState(false)

  const savePnNumber = async (value: string) => {
    if (value === (opp.project_number ?? '')) return
    setPnSaving(true)
    setPnSaved(false)
    const res = await fetch(`/api/org/opportunities/${oppId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_number: value.trim() || null }),
    })
    setPnSaving(false)
    if (res.ok) {
      opp.project_number = value.trim() || null
      setPnSaved(true)
      setTimeout(() => setPnSaved(false), 2000)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Failed to save PN number')
    }
  }

  const load = useCallback(async () => {
    const [projRes, usersRes] = await Promise.all([
      fetch(`/api/org/projects?opp_id=${oppId}`),
      fetch('/api/org/users'),
    ])
    if (projRes.ok) setProjects(await projRes.json())
    if (usersRes.ok) setOrgUsers(await usersRes.json())
    setLoading(false)
  }, [oppId])

  useEffect(() => { load() }, [load])

  const addTeamMember = () => {
    if (!addUserId) return
    if (teamEntries.some(t => t.user_id === addUserId)) return
    setTeamEntries([...teamEntries, { user_id: addUserId, role: addRole as TeamEntry['role'] }])
    setAddUserId('')
  }

  const removeTeamMember = (userId: string) => {
    setTeamEntries(teamEntries.filter(t => t.user_id !== userId))
  }

  const handleCreate = async () => {
    setCreating(true)
    const res = await fetch('/api/org/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opp_id: oppId,
        name: opp.project_name || `Project for ${opp.opp_number}`,
        customer_id: opp.customer_id || null,
        pm_id: pmId || null,
        team: teamEntries,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setResult({ id: data.id, pn: data.pn, install_items_created: data.install_items_created ?? 0 })
      await load()
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to create project')
    }
    setCreating(false)
  }

  const getUserLabel = (userId: string) => {
    const u = orgUsers.find(u => u.id === userId)
    if (!u) return userId
    return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email
  }

  const assignedUserIds = new Set([pmId, ...teamEntries.map(t => t.user_id)].filter(Boolean))
  const availableUsers = orgUsers.filter(u => !assignedUserIds.has(u.id))

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* PN Number */}
      <div className="rounded-lg border border-border bg-card p-3">
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1">PN Number</label>
        <div className="flex items-center gap-2">
          <input
            value={pnNumber}
            onChange={e => setPnNumber(e.target.value)}
            onBlur={e => savePnNumber(e.target.value)}
            placeholder="Assign a project number..."
            className="flex-1 rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
          />
          {pnSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {pnSaved && <Check className="h-4 w-4 text-emerald-500" />}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Project</h3>
          <p className="text-xs text-muted-foreground">
            {projects.length > 0 ? `${projects.length} project(s) linked to this opportunity` : 'No project created yet'}
          </p>
        </div>
        {!showForm && !result && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Create Project
          </button>
        )}
      </div>

      {/* Creation Result */}
      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-emerald-600" />
            <h4 className="text-sm font-bold text-emerald-800">Project Created — {result.pn}</h4>
          </div>
          <div className="flex items-center gap-4 text-xs text-emerald-700">
            <span className="flex items-center gap-1">
              <Wrench className="h-3.5 w-3.5" />
              {result.install_items_created} install items from hardware schedule
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {teamEntries.length + (pmId ? 1 : 0)} team members assigned
            </span>
          </div>
          <a
            href={`/org/projects/${result.id}`}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Open Project <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Creation Form */}
      {showForm && !result && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Create Project from {opp.opp_number}</h4>
          <p className="text-[10px] text-muted-foreground">
            Hardware schedule devices will be copied as install items for field verification.
          </p>

          {/* PM Selection */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Project Manager *</label>
            <select
              value={pmId}
              onChange={e => setPmId(e.target.value)}
              className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
            >
              <option value="">Select PM...</option>
              {orgUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} ({u.email}) — {u.role}
                </option>
              ))}
            </select>
          </div>

          {/* Team Assignment */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
              <Users className="inline h-3 w-3 mr-0.5" /> Assign Team
            </label>

            {/* Current team */}
            {teamEntries.length > 0 && (
              <div className="space-y-1 mb-2">
                {teamEntries.map(entry => (
                  <div key={entry.user_id} className="flex items-center justify-between rounded border border-border bg-background px-2.5 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{getUserLabel(entry.user_id)}</span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                        {TEAM_ROLES.find(r => r.value === entry.role)?.label ?? entry.role}
                      </span>
                    </div>
                    <button
                      onClick={() => removeTeamMember(entry.user_id)}
                      className="text-[10px] text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add team member */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <select
                  value={addUserId}
                  onChange={e => setAddUserId(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                >
                  <option value="">Select user...</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <select
                  value={addRole}
                  onChange={e => setAddRole(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                >
                  {TEAM_ROLES.filter(r => r.value !== 'PM').map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={addTeamMember}
                disabled={!addUserId}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={creating || !pmId}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...</>
              ) : (
                <><FolderKanban className="h-3.5 w-3.5" /> Create Project &amp; Import Schedule</>
              )}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing Projects */}
      {projects.length > 0 && (
        <div className="space-y-2">
          {projects.map(p => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2.5">
                <FolderKanban className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground">{p.pn} — {p.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold">
                      {p.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    {p.pm && <span>PM: {p.pm.first_name} {p.pm.last_name}</span>}
                    {p.start_date && <span>Started {new Date(p.start_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              <a
                href={`/org/projects/${p.id}`}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-primary hover:bg-primary/10"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {projects.length === 0 && !showForm && !result && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <FolderKanban className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No project linked</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Create a project to begin the delivery phase
          </p>
        </div>
      )}
    </div>
  )
}
