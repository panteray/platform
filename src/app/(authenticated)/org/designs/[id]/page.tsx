'use client'

import { useParams } from 'next/navigation'
import { useUser } from '@/hooks/useUser'
import { DESIGN_ACCESS_ROLES } from '@/types/enums'
import { DesignCanvas } from '@/components/design-canvas/design-canvas'

export default function DesignCanvasPage() {
  const { id } = useParams<{ id: string }>()
  const { userRole, loading: userLoading } = useUser()

  const hasAccess = userRole && (DESIGN_ACCESS_ROLES as readonly string[]).includes(userRole)

  if (userLoading) {
    return (
      <div className="-m-6 h-[calc(100vh-48px)] flex items-center justify-center bg-[#0f1117]">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="-m-6 h-[calc(100vh-48px)] flex items-center justify-center bg-[#0f1117]">
        <p className="text-sm text-zinc-500">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="-m-6 h-[calc(100vh-48px)]">
      <DesignCanvas designId={id} />
    </div>
  )
}
