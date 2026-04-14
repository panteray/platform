'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Users, Shield } from 'lucide-react'
import type { ProjectTeam } from '@/types/database'

interface Props { projectId: string }

const TEAM_ROLES = ['PM', 'LEAD_TECH', 'FIELD_TECH', 'SUB', 'PRESALES', 'ENGINEER'] as const
const ROLE_LABELS: Record<string, string> = {
  PM: 'Project Manager',
  LEAD_TECH: 'Lead Technician',
  FIELD_TECH: 'Field Technician',
  SUB: 'Subcontractor',
  PRESALES: 'Presales',
  ENGINEER: 'Engineer',
}
const ROLE_COLORS: Record<string, string> = {
  PM: 'bg-blue-100 text-blue-700',
  LEAD_TECH: 'bg-emerald-100 text-emerald-700',
  FIELD_TECH: 'bg-neutral-100 text-neutral-700',
  SUB: 'bg-amber-100 text-amber-700',
  PRESALES: 'bg-purple-100 text-purple-700',
  ENGINEER: 'bg-cyan-100 text-cyan-700',
}

interface OrgUser {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  role: string
}

export function ProjectTeamTab({ projectId }: Props) {
  const [members, setMembers] = useState<(ProjectTeam & { users?: OrgUser | null })[]>([])
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('FIELD_TECH')

  const load = useCallback(async () => {
    const [teamRes, usersRes] = await Promise.all([
      fetch(`/api/org/projects/${projectId}/team`),
      fetch('/api/org/users'),
    ])
    if (teamRes.ok) setMembers(await teamRes.json())
    if (usersRes.ok) setOrgUsers(await usersRes.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const addMember = async () => {
    if (!selectedUserId) return
    const res = await fetch(`/api/org/projects/${projectId}/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: selectedUserId, role: selectedRole }),
    })
    if (res.ok) {
      setShowAdd(false)
      setSelectedUserId('')
      await load()
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to add')
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return
    await fetch(`/api/org/projects/${projectId}/team?member_id=${memberId}`, { method: 'DELETE' })
    await load()
  }

  const existingUserIds = new Set(members.map(m => m.user_id))
  const availableUsers = orgUsers.filter(u => !existingUserIds.has(u.id))

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Project Team</h3>
          <p className="text-[10px] text-muted-foreground">{members.length} members</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" /> Add Member
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">User</label>
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
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
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-0.5">Project Role</label>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              >
                {TEAM_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addMember} disabled={!selectedUserId} className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Add</button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {/* Team List */}
      {members.length === 0 && !showAdd ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Users className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs">No team members assigned</p>
        </div>
      ) : (
        <div className="space-y-1">
          {members.map(member => {
            const user = member.users
            const roleColor = ROLE_COLORS[member.role] ?? 'bg-muted text-muted-foreground'

            return (
              <div key={member.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Shield className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${roleColor}`}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                  <button onClick={() => removeMember(member.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
