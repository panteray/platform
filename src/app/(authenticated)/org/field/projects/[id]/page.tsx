'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import type { Project } from '@/types/database'
import { MobileShell, MobileTabs } from '@/components/field/mobile/MobileShell'
import { TaskList } from '@/components/field/mobile/TaskList'
import { DailyReport } from '@/components/field/mobile/DailyReport'
import { QcPanel } from '@/components/field/mobile/QcPanel'

type ProjectWithRelations = Project & {
  customer?: { name: string } | null
}

export default function FieldProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<'tasks' | 'daily' | 'qc'>('tasks')
  const [counts, setCounts] = useState<{ tasks?: number; daily?: number; qc?: number }>({})

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetch(`/api/org/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setProject(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="-m-6 flex h-[calc(100dvh-56px)] items-center justify-center bg-neutral-50 text-sm text-neutral-400">
        Loading…
      </div>
    )
  }

  if (!project) {
    return (
      <div className="-m-6 flex h-[calc(100dvh-56px)] flex-col items-center justify-center bg-neutral-50 p-6 text-center">
        <p className="text-sm font-medium text-neutral-600">Project not found</p>
        <p className="mt-1 text-xs text-neutral-400">Or you don't have access</p>
      </div>
    )
  }

  const siteAddress = [project.site_address, project.site_city, project.site_state].filter(Boolean).join(', ') || null

  return (
    <MobileShell
      backHref="/org/field/projects"
      pn={project.pn}
      name={project.name}
      status={project.status}
      siteAddress={siteAddress}
      tabs={<MobileTabs active={active} onChange={setActive} counts={counts} />}
    >
      {active === 'tasks' && (
        <TaskList
          projectId={project.id}
          onCountChange={(total) => setCounts((c) => ({ ...c, tasks: total }))}
        />
      )}
      {active === 'daily' && (
        <DailyReport
          projectId={project.id}
          onCountChange={(total) => setCounts((c) => ({ ...c, daily: total }))}
        />
      )}
      {active === 'qc' && (
        <QcPanel
          projectId={project.id}
          onCountChange={(total) => setCounts((c) => ({ ...c, qc: total }))}
        />
      )}
    </MobileShell>
  )
}
