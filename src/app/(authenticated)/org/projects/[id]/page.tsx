'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Project } from '@/types/database'
import { useUser } from '@/hooks/useUser'
import { ProjectOverviewTab } from '@/components/projects/ProjectOverviewTab'
import { ProjectTasksTab } from '@/components/projects/ProjectTasksTab'
import { ProjectInstallTab } from '@/components/projects/ProjectInstallTab'
import { ProjectDailyReportsTab } from '@/components/projects/ProjectDailyReportsTab'
import { ProjectInventoryTab } from '@/components/projects/ProjectInventoryTab'
import { ProjectTeamTab } from '@/components/projects/ProjectTeamTab'
import { ProjectChangeOrdersTab } from '@/components/projects/ProjectChangeOrdersTab'
import { ProjectRaidTab } from '@/components/projects/ProjectRaidTab'
import { ProjectQcTab } from '@/components/projects/ProjectQcTab'
import { ProjectCloseoutTab } from '@/components/projects/ProjectCloseoutTab'
import { ProjectStatusReportsTab } from '@/components/projects/ProjectStatusReportsTab'
import { ProjectLessonsLearnedTab } from '@/components/projects/ProjectLessonsLearnedTab'
import { StubTab } from '@/components/opportunities/StubTab'

const STATUS_LABELS: Record<string, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  punch_list: 'Punch List',
  closeout: 'Closeout',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  on_hold: 'bg-amber-100 text-amber-700',
  punch_list: 'bg-orange-100 text-orange-700',
  closeout: 'bg-purple-100 text-purple-700',
  completed: 'bg-neutral-100 text-neutral-600',
  cancelled: 'bg-red-100 text-red-700',
}

const TABS = ['Overview', 'Team', 'Tasks', 'Install', 'Daily Reports', 'Van Stock', 'Change Orders', 'RAID', 'QC', 'Status Reports', 'Lessons Learned', 'Closeout', 'Documents'] as const
type Tab = (typeof TABS)[number]

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const { user } = useUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Overview')

  const load = useCallback(async () => {
    if (!params?.id) return
    const res = await fetch(`/api/org/projects/${params.id}`)
    if (!res.ok) { setLoading(false); return }
    setProject(await res.json())
    setLoading(false)
  }, [params?.id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading project...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Link href="/org/projects" className="text-sm text-primary hover:underline">Back to projects</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5 flex-wrap">
        <Link href="/org/projects" className="rounded p-1.5 hover:bg-muted">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
        <span className="text-[13px] text-muted-foreground">Projects</span>
        <span className="text-muted-foreground">/</span>
        <span className="text-base font-semibold text-foreground">{project.pn}</span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status] ?? 'bg-muted text-muted-foreground'}`}>
          {STATUS_LABELS[project.status] ?? project.status}
        </span>
        {project.name && (
          <span className="text-sm text-muted-foreground">— {project.name}</span>
        )}
        <Link
          href={`/org/projects/${project.id}/field`}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-200 transition-colors"
        >
          Field Ops
        </Link>
      </div>

      {/* Tabs */}
      <div className="relative mb-3">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />
        <div className="flex gap-0 border-b border-border overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-border bg-card p-4">
        {tab === 'Overview' && (
          <ProjectOverviewTab
            project={project}
            onUpdate={updated => setProject(updated)}
          />
        )}
        {tab === 'Team' && <ProjectTeamTab projectId={project.id} />}
        {tab === 'Tasks' && <ProjectTasksTab projectId={project.id} />}
        {tab === 'Install' && <ProjectInstallTab projectId={project.id} />}
        {tab === 'Daily Reports' && <ProjectDailyReportsTab projectId={project.id} />}
        {tab === 'Van Stock' && <ProjectInventoryTab projectId={project.id} />}
        {tab === 'Change Orders' && <ProjectChangeOrdersTab projectId={project.id} />}
        {tab === 'RAID' && <ProjectRaidTab projectId={project.id} />}
        {tab === 'QC' && <ProjectQcTab projectId={project.id} />}
        {tab === 'Status Reports' && <ProjectStatusReportsTab projectId={project.id} />}
        {tab === 'Lessons Learned' && <ProjectLessonsLearnedTab projectId={project.id} />}
        {tab === 'Closeout' && <ProjectCloseoutTab projectId={project.id} />}
        {tab === 'Documents' && <StubTab name="Documents" />}
      </div>
    </div>
  )
}
