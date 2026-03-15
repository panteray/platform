'use client'

import { useUser } from '@/hooks/useUser'
import { canManageOrg } from '@/lib/roles'

interface ModuleDisabledProps {
  moduleName?: string
}

export function ModuleDisabled({ moduleName }: ModuleDisabledProps) {
  const { userRole } = useUser()
  const isOrgAdmin = userRole ? canManageOrg(userRole) : false

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
      <div className="text-sm text-muted-foreground">
        {moduleName
          ? `The ${moduleName} module is not enabled for your organization.`
          : 'This module is not enabled for your organization.'}
      </div>
      {isOrgAdmin && (
        <div className="text-xs text-muted-foreground">
          Contact your platform administrator to enable this module.
        </div>
      )}
    </div>
  )
}
