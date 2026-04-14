'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, Clock, AlertTriangle } from 'lucide-react'
import type { Project, ProjectMilestone } from '@/types/database'

interface Props {
  project: Project
}

const LIFECYCLE_STEPS = [
  { key: 'opp_created', label: 'Opportunity Created', phase: 'presales' },
  { key: 'site_survey', label: 'Site Survey', phase: 'presales' },
  { key: 'design_complete', label: 'Design Complete', phase: 'presales' },
  { key: 'quote_sent', label: 'Quote Sent', phase: 'presales' },
  { key: 'po_received', label: 'PO Received', phase: 'presales' },
  { key: 'project_created', label: 'Project Created', phase: 'planning' },
  { key: 'kickoff', label: 'Internal Kickoff', phase: 'planning' },
  { key: 'materials_ordered', label: 'Materials Ordered', phase: 'planning' },
  { key: 'materials_received', label: 'Materials Received', phase: 'planning' },
  { key: 'sub_scheduled', label: 'Subs Scheduled', phase: 'planning' },
  { key: 'rough_in', label: 'Rough-In', phase: 'install' },
  { key: 'cable_pull', label: 'Cable Pull', phase: 'install' },
  { key: 'device_mount', label: 'Device Mounting', phase: 'install' },
  { key: 'terminate', label: 'Termination', phase: 'install' },
  { key: 'head_end', label: 'Head-End Build', phase: 'install' },
  { key: 'programming', label: 'Programming', phase: 'install' },
  { key: 'testing', label: 'Testing & QC', phase: 'qa' },
  { key: 'punch_list', label: 'Punch List', phase: 'qa' },
  { key: 'training', label: 'Customer Training', phase: 'closeout' },
  { key: 'as_builts', label: 'As-Builts Delivered', phase: 'closeout' },
  { key: 'sos', label: 'SOS Signed', phase: 'closeout' },
  { key: 'final_invoice', label: 'Final Invoice', phase: 'closeout' },
  { key: 'project_complete', label: 'Project Complete', phase: 'closeout' },
] as const

const PHASE_COLORS: Record<string, string> = {
  presales: 'text-blue-500',
  planning: 'text-purple-500',
  install: 'text-amber-500',
  qa: 'text-orange-500',
  closeout: 'text-emerald-500',
}

export function FieldLifecycle({ project }: Props) {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([])

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${project.id}/milestones`)
    if (res.ok) setMilestones(await res.json())
  }, [project.id])

  useEffect(() => { load() }, [load])

  // Determine current step based on project status
  const statusToStep: Record<string, number> = {
    planning: 6,
    active: 10,
    on_hold: 10,
    punch_list: 17,
    closeout: 18,
    completed: 22,
  }
  const currentStep = statusToStep[project.status] ?? 0

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-foreground">Project Lifecycle</h2>
        <p className="text-[10px] text-muted-foreground">
          {project.pn} — {project.name} · Phase: {project.status.replace(/_/g, ' ')}
        </p>
      </div>

      {/* Risk Badge */}
      {project.risk_level && project.risk_level !== 'LOW' && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-800">Risk Level: {project.risk_level}</p>
            <p className="text-[10px] text-amber-700">Review risk factors before proceeding</p>
          </div>
        </div>
      )}

      {/* Lifecycle Steps */}
      <div className="space-y-0.5">
        {LIFECYCLE_STEPS.map((step, idx) => {
          const isDone = idx < currentStep
          const isCurrent = idx === currentStep
          const phaseColor = PHASE_COLORS[step.phase] ?? 'text-muted-foreground'

          return (
            <div
              key={step.key}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 ${
                isCurrent ? 'bg-primary/5 border border-primary/20' : ''
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              ) : isCurrent ? (
                <Clock className="h-4 w-4 text-primary animate-pulse flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
              )}
              <span className={`text-xs ${isDone ? 'text-muted-foreground line-through' : isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
              <span className={`ml-auto text-[9px] font-medium ${phaseColor}`}>
                {step.phase}
              </span>
            </div>
          )
        })}
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">Custom Milestones</h3>
          <div className="space-y-1">
            {milestones.map(m => (
              <div key={m.id} className="flex items-center gap-2 text-xs">
                {m.completed_at ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
                <span className={m.completed_at ? 'text-muted-foreground line-through' : 'text-foreground'}>
                  {m.title}
                </span>
                {m.target_date && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date(m.target_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
