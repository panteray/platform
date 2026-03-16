'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { DESIGN_ACCESS_ROLES } from '@/types/enums'
import { DesignCanvas } from '@/components/design-canvas/design-canvas'

export default function DesignCanvasPage() {
  const { id } = useParams<{ id: string }>()
  const { userRole, loading: userLoading } = useUser()

  const hasAccess = userRole && (DESIGN_ACCESS_ROLES as readonly string[]).includes(userRole)

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Design Canvas</h1>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Design Canvas</h1>
        <p className="text-sm text-zinc-500">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Link
        href="/org/designs"
        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft className="h-3 w-3" /> Back to designs
      </Link>

      <DesignCanvas designId={id} />
    </div>
  )
}
