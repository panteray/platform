'use client'

import Link from 'next/link'
import {
  UserCircle,
  LayoutGrid,
  Building2,
  Users,
  ShieldCheck,
  Wrench,
  Briefcase,
  Settings,
} from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { canManageUsers, canManageOrg, canManageCRM } from '@/lib/roles'

import type { UserRole } from '@/types/enums'
import type { LucideIcon } from 'lucide-react'

interface ManagementSection {
  href: string
  icon: LucideIcon
  title: string
  description: string
  visible: (role: UserRole) => boolean
  phase?: number
}

const ALL_SECTIONS: ManagementSection[] = [
  {
    href: '/org/profile',
    icon: UserCircle,
    title: 'My Profile',
    description: 'Edit your photo, phone number, and change your password',
    visible: () => true,
  },
  {
    href: '/org',
    icon: LayoutGrid,
    title: 'Customize Dashboard',
    description: 'Add, remove, and reorder your dashboard widgets',
    visible: () => true,
  },
  {
    href: '/org/settings',
    icon: Building2,
    title: 'Organization',
    description: 'Edit organization name, branding, and configuration',
    visible: (role) => canManageOrg(role),
  },
  {
    href: '/org/users',
    icon: Users,
    title: 'Users',
    description: 'Manage users, edit roles, and reset passwords',
    visible: (role) => canManageUsers(role),
  },
  {
    href: '/org/management/roles',
    icon: ShieldCheck,
    title: 'Roles & Permissions',
    description: 'Configure role permissions and field-level access',
    visible: (role) => canManageUsers(role),
    phase: 6,
  },
  {
    href: '/org/customers',
    icon: Users,
    title: 'Customers',
    description: 'Manage customer records, contacts, and documents',
    visible: (role) => canManageCRM(role),
  },
  {
    href: '/org/manufacturers',
    icon: Building2,
    title: 'Manufacturers',
    description: 'Manage manufacturer relationships and compliance',
    visible: (role) => canManageCRM(role),
  },
  {
    href: '/org/subcontractors',
    icon: Wrench,
    title: 'Subcontractors',
    description: 'Manage subcontractor onboarding and compliance',
    visible: (role) => canManageCRM(role),
  },
  {
    href: '/org/distributors',
    icon: Building2,
    title: 'Distributors',
    description: 'Manage distributors, accounts, and purchasing',
    visible: (role) => canManageCRM(role),
  },
  {
    href: '/org/opportunities',
    icon: Briefcase,
    title: 'Opportunities',
    description: 'Manage pipeline, quoting, and project lifecycle',
    visible: (role) => canManageCRM(role),
  },
]

export default function ManagementPage() {
  const { userRole, loading } = useUser()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const visible = userRole
    ? ALL_SECTIONS.filter((s) => s.visible(userRole))
    : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organization settings, user management, and configuration
        </p>
      </div>

      {visible.length > 0 ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((section) => {
            const isFuture = section.phase && section.phase > 4
            const Icon = section.icon

            return (
              <Link
                key={section.href}
                href={isFuture ? '#' : section.href}
                onClick={isFuture ? (e) => e.preventDefault() : undefined}
                className={`group flex items-start gap-3.5 rounded-lg border border-border bg-card p-5 transition-colors ${
                  isFuture
                    ? 'cursor-default opacity-50'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
                  <Icon
                    className="h-[18px] w-[18px] text-muted-foreground transition-colors group-hover:text-foreground"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-medium text-foreground">
                      {section.title}
                    </h3>
                    {isFuture && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                        Phase {section.phase}
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {section.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Settings className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            No management options available
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Contact your organization admin for access.
          </p>
        </div>
      )}
    </div>
  )
}
