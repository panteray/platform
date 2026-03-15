'use client'

import { Pencil, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CustomRole } from '@/types/database'

interface CustomRoleTableProps {
  roles: CustomRole[]
  onAdd: () => void
  onEdit: (role: CustomRole) => void
  onDelete: (role: CustomRole) => void
}

export function CustomRoleTable({ roles, onAdd, onEdit, onDelete }: CustomRoleTableProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Custom roles</span>
        <Button size="sm" className="gap-1.5 text-[11px]" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> New role
        </Button>
      </div>
      <div className="rounded-lg border border-border bg-card">
        {roles.length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-muted-foreground">
            No custom roles defined for this organization
          </div>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="border-b border-border px-4 py-3.5 last:border-b-0">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[13px] font-medium">{role.name}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Inherits{' '}
                    <Badge variant="secondary" className="text-[10px]">{role.base_role}</Badge>
                  </div>
                  {role.description && (
                    <div className="mt-1.5 text-[11px] text-muted-foreground">{role.description}</div>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => onEdit(role)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDelete(role)} className="rounded p-1 text-red-500 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
