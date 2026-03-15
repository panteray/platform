'use client'

import { useRouter } from 'next/navigation'
import { Pencil, Pause, Trash2, Search } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Organization } from '@/types/database'

interface OrgTableProps {
  organizations: Organization[]
  onAdd: () => void
  onEdit: (org: Organization) => void
  onSuspend: (org: Organization) => void
  onDelete: (org: Organization) => void
}

export function OrgTable({ organizations, onAdd, onEdit, onSuspend, onDelete }: OrgTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const filtered = search
    ? organizations.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : organizations

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <div className="flex max-w-[300px] flex-1 items-center gap-2 rounded-md border border-input bg-secondary px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          Displaying {filtered.length} of {organizations.length}
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-5 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Organization</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground">Created</th>
            <th className="px-4 py-2.5 text-center text-[11px] font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((org) => (
            <tr
              key={org.id}
              className="cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
              onClick={() => router.push(`/admin/organizations/${org.id}`)}
            >
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                    {org.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-[13px] font-medium">{org.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant={org.is_active ? 'success' : 'warning'} className="text-[10px]">
                  {org.is_active ? 'Active' : 'Suspended'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {new Date(org.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onEdit(org)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onSuspend(org)} className="rounded p-1 text-amber-500 hover:text-amber-400" title={org.is_active ? 'Suspend' : 'Activate'}>
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDelete(org)} className="rounded p-1 text-red-500 hover:text-red-400" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">No organizations found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
