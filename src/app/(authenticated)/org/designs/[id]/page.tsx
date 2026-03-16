'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PenTool } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { DESIGN_ACCESS_ROLES } from '@/types/enums'
import type { Design, DesignArea } from '@/types/database'

export default function DesignCanvasPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { userRole, loading: userLoading } = useUser()
  const [design, setDesign] = useState<Design | null>(null)
  const [areas, setAreas] = useState<DesignArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hasAccess = userRole && (DESIGN_ACCESS_ROLES as readonly string[]).includes(userRole)

  useEffect(() => {
    if (!hasAccess || !id) return
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/org/designs/${id}`)
        if (!res.ok) {
          setError('Design not found')
          return
        }
        const json = await res.json()
        setDesign(json.design)
        setAreas(json.areas ?? [])
      } catch {
        setError('Network error')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id, hasAccess])

  if (userLoading || loading) {
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

  if (error || !design) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Design Canvas</h1>
        <p className="text-sm text-red-400">{error ?? 'Design not found'}</p>
      </div>
    )
  }

  const opp = (design as Design & { opportunities?: Record<string, unknown> }).opportunities

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/org/designs"
          className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="text-xs text-zinc-500">
            {opp ? `${(opp as Record<string, unknown>).opp_number} / ${(opp as Record<string, unknown>).project_name ?? 'Untitled'}` : 'Design'}
          </div>
          <h1 className="text-xl font-semibold text-white">{design.name}</h1>
        </div>
      </div>

      {/* Area tabs */}
      <div className="flex items-center gap-0 border-b border-zinc-800">
        {areas.map((area, i) => (
          <div
            key={area.id}
            className={`px-4 py-2 text-sm cursor-pointer border-b-2 ${
              i === 0
                ? 'border-blue-500 text-white font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {area.name}
          </div>
        ))}
        <div className="px-3 py-2 text-zinc-600 text-sm cursor-pointer hover:text-zinc-400">+</div>
      </div>

      {/* Canvas placeholder — replaced in 7B with Fabric.js */}
      <div className="rounded-lg border border-zinc-800 bg-[#0f1117] flex items-center justify-center" style={{ height: '500px' }}>
        <div className="text-center">
          <PenTool className="mx-auto h-12 w-12 text-zinc-800 mb-3" />
          <p className="text-sm font-medium text-zinc-500">Design Canvas</p>
          <p className="text-xs text-zinc-700 mt-1">
            Fabric.js canvas loads in Phase 7B
          </p>
          <p className="text-xs text-zinc-700 mt-0.5">
            {areas.length} area{areas.length !== 1 ? 's' : ''} configured
          </p>
        </div>
      </div>
    </div>
  )
}
