'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Project } from '@/types/database'
import { InstallShell, EmptySection, type InstallSection } from '@/components/field/install/InstallShell'
import { DashboardSection } from '@/components/field/install/DashboardSection'
import { TaskList } from '@/components/field/mobile/TaskList'
import { DailyReport } from '@/components/field/mobile/DailyReport'
import { QcPanel } from '@/components/field/mobile/QcPanel'

type ProjectWithRelations = Project & {
  customer?: { name: string } | null
}

const MORE_LINKS: Array<{ label: string }> = [
  { label: 'Risk Assessment' },
  { label: 'Status Reports'  },
  { label: 'Closeout'        },
  { label: 'Inventory'       },
  { label: 'Lessons Learned' },
  { label: 'RAID Log'        },
  { label: 'Data Fields'     },
]

export default function FieldProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ProjectWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<InstallSection>('dashboard')

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
      <div className="-m-6 flex h-[calc(100dvh-56px)] items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!project) {
    return (
      <div className="-m-6 flex h-[calc(100dvh-56px)] flex-col items-center justify-center bg-background p-6 text-center">
        <p className="text-sm font-medium text-foreground">Project not found</p>
        <p className="mt-1 text-xs text-muted-foreground">Or you don&apos;t have access</p>
      </div>
    )
  }

  const siteAddress = [project.site_address, project.site_city, project.site_state].filter(Boolean).join(', ') || null

  return (
    <InstallShell
      backHref="/org/field/projects"
      pn={project.pn}
      name={project.name}
      status={project.status}
      siteAddress={siteAddress}
      active={active}
      onChange={setActive}
    >
      {active === 'dashboard' && <DashboardSection project={project} />}
      {active === 'team'      && <EmptySection title="Team & Subs"      note="Roster + sub assignments arrive in step #2." />}
      {active === 'co'        && <EmptySection title="Change Orders"   note="4-step pipeline arrives in step #4." />}
      {active === 'docs'      && <EmptySection title="Documents"       note="Document generation arrives in step #3." />}
      {active === 'qc'        && (
        <QcPanel projectId={project.id} onCountChange={() => {}} />
      )}
      {active === 'more' && (
        <div className="space-y-6 p-4">
          <div>
            <h3 className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tasks</h3>
            <div className="rounded-2xl border border-border bg-card">
              <TaskList projectId={project.id} onCountChange={() => {}} />
            </div>
          </div>
          <div>
            <h3 className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Daily Reports</h3>
            <div className="rounded-2xl border border-border bg-card">
              <DailyReport projectId={project.id} onCountChange={() => {}} />
            </div>
          </div>
          <div>
            <h3 className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Open in Project View</h3>
            <p className="px-1 pb-2 text-[11px] text-muted-foreground">These tabs live on the desktop project page — tap to jump there.</p>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {MORE_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={`/org/projects/${project.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted"
                >
                  <span>{l.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </InstallShell>
  )
}
