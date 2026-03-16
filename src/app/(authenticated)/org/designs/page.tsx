'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PenTool, Plus, Archive, ExternalLink } from 'lucide-react'
import { useUser } from '@/hooks/useUser'
import { useDesigns } from '@/hooks/useDesigns'
import { DESIGN_ACCESS_ROLES } from '@/types/enums'

export default function DesignsPage() {
  const router = useRouter()
  const { userRole, loading: userLoading } = useUser()
  const { designs, loading, error, archiveDesign } = useDesigns()
  const [archiving, setArchiving] = useState<string | null>(null)

  const hasAccess = userRole && (DESIGN_ACCESS_ROLES as readonly string[]).includes(userRole)

  if (userLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Designs</h1>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-white">Designs</h1>
        <p className="text-sm text-zinc-500">You do not have access to the Design Canvas.</p>
      </div>
    )
  }

  async function handleArchive(id: string) {
    setArchiving(id)
    await archiveDesign(id)
    setArchiving(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Designs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Design workspaces linked to opportunities
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading designs...</p>
      ) : designs.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
          <PenTool className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
          <p className="text-sm font-medium text-zinc-400">No designs yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Create a design from an opportunity detail page
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Design Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Opportunity</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Customer</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Created</th>
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {designs.map((d) => {
                const opp = d.opportunities
                return (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/30 cursor-pointer"
                    onClick={() => router.push(`/org/designs/${d.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-200">
                      <div className="flex items-center gap-2">
                        <PenTool className="h-4 w-4 text-zinc-600" />
                        {d.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {opp ? (
                        <span className="font-mono text-xs">{opp.opp_number}</span>
                      ) : '-'}
                      {opp?.project_name && (
                        <span className="text-zinc-500 ml-2">{opp.project_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{opp?.customer_name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${
                        d.status === 'ACTIVE'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/org/designs/${d.id}`}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-900"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </Link>
                        <button
                          onClick={() => handleArchive(d.id)}
                          disabled={archiving === d.id}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-900 hover:text-red-400 disabled:opacity-50"
                        >
                          <Archive className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
