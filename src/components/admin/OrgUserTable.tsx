'use client'

import { useState } from 'react'
import { Pencil, Pause, Trash2, KeyRound, Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { User } from '@/types/database'

interface OrgUserTableProps {
  users: User[]
  onAdd: () => void
  onEdit: (user: User) => void
  onSuspend: (user: User) => void
  onResetPassword: (user: User) => void
  onDelete: (user: User) => void
}

export function OrgUserTable({ users, onAdd, onEdit, onSuspend, onResetPassword, onDelete }: OrgUserTableProps) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? users.filter((u) =>
        `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
      )
    : users

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Displaying {filtered.length} of {users.length}</span>
        <Button size="sm" className="gap-1.5" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Add user
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <div className="flex max-w-[260px] flex-1 items-center gap-2 rounded-md border border-input bg-secondary px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-5 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Name</th>
              <th className="px-3.5 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Email</th>
              <th className="px-3.5 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Role</th>
              <th className="px-3.5 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Divisions</th>
              <th className="px-3.5 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Status</th>
              <th className="px-3.5 py-2.5 text-center text-[11px] font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-border">
                <td className="px-5 py-2.5">
                  <div
                    className="flex cursor-pointer items-center gap-2.5"
                    onClick={() => onEdit(user)}
                  >
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                      {(user.first_name?.[0] ?? '').toUpperCase()}{(user.last_name?.[0] ?? '').toUpperCase()}
                    </div>
                    <span className="text-[13px] font-medium text-primary hover:underline">{user.first_name} {user.last_name}</span>
                  </div>
                </td>
                <td className="px-3.5 py-2.5 text-xs text-muted-foreground">{user.email}</td>
                <td className="px-3.5 py-2.5">
                  <Badge variant="secondary" className="text-[10px]">{user.role}</Badge>
                </td>
                <td className="px-3.5 py-2.5">
                  {user.divisions?.map((d) => (
                    <Badge key={d} variant="secondary" className="mr-1 text-[10px]">{d}</Badge>
                  ))}
                </td>
                <td className="px-3.5 py-2.5">
                  <Badge variant={user.is_active ? 'success' : 'warning'} className="text-[10px]">
                    {user.is_active ? 'Active' : 'Suspended'}
                  </Badge>
                </td>
                <td className="px-3.5 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onEdit(user)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onSuspend(user)} className="rounded p-1 text-amber-500 hover:text-amber-400" title={user.is_active ? 'Suspend' : 'Activate'}>
                      <Pause className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onResetPassword(user)} className="rounded p-1 text-blue-500 hover:text-blue-400" title="Reset password">
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onDelete(user)} className="rounded p-1 text-red-500 hover:text-red-400" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
