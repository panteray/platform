'use client'

import { FIELD_PERMISSION_GROUPS } from '@/lib/constants'
import type { FieldPermissionLevel } from '@/types/database'

interface FieldPermissionEditorProps {
  roleIdentifiers: { key: string; label: string }[]
  getRolePermission: (roleId: string, fieldKey: string) => FieldPermissionLevel
  onSetPermission: (roleId: string, fieldKey: string, permission: FieldPermissionLevel) => void
}

const CYCLE: FieldPermissionLevel[] = ['W', 'R', '-']

function nextPermission(current: FieldPermissionLevel): FieldPermissionLevel {
  const idx = CYCLE.indexOf(current)
  return CYCLE[(idx + 1) % CYCLE.length]
}

function permColor(perm: FieldPermissionLevel) {
  if (perm === 'W') return 'text-emerald-500'
  if (perm === 'R') return 'text-blue-500'
  return 'text-muted-foreground/40'
}

export function FieldPermissionEditor({ roleIdentifiers, getRolePermission, onSetPermission }: FieldPermissionEditorProps) {
  return (
    <div>
      <div className="mb-3 text-sm font-medium">Field permissions by role</div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3.5 py-2 text-left font-medium text-muted-foreground">Field</th>
              {roleIdentifiers.map((r) => (
                <th key={r.key} className="px-2 py-2 text-center font-medium text-muted-foreground">{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIELD_PERMISSION_GROUPS.map((group) => (
              <tr key={group.group}>
                <td colSpan={roleIdentifiers.length + 1}>
                  <table className="w-full">
                    <tbody>
                      <tr className="border-b border-border">
                        <td
                          colSpan={roleIdentifiers.length + 1}
                          className="bg-muted/80 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {group.group}
                        </td>
                      </tr>
                      {group.fields.map((field) => (
                        <tr key={field.key} className="border-b border-border">
                          <td className="px-3.5 py-1.5 text-muted-foreground">{field.label}</td>
                          {roleIdentifiers.map((role) => {
                            const perm = getRolePermission(role.key, field.key)
                            return (
                              <td key={role.key} className="px-2 py-1.5 text-center">
                                <button
                                  onClick={() => onSetPermission(role.key, field.key, nextPermission(perm))}
                                  className={`cursor-pointer select-none font-medium ${permColor(perm)} hover:opacity-80`}
                                >
                                  {perm}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex gap-3.5 text-[11px] text-muted-foreground">
        <span><span className="font-medium text-emerald-500">W</span> Write</span>
        <span><span className="font-medium text-blue-500">R</span> Read</span>
        <span><span className="font-medium text-muted-foreground/40">-</span> No access</span>
        <span className="ml-auto">Click any cell to cycle</span>
      </div>
    </div>
  )
}
