'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldCheck, LayoutDashboard, MapPin, RefreshCw,
  Package, ClipboardCheck, Headset, FileSignature, ArrowLeft, Lock,
} from 'lucide-react'
import type { Project } from '@/types/database'
import { TailgateGate } from '@/components/field-ops/TailgateGate'
import { FieldLifecycle } from '@/components/field-ops/FieldLifecycle'
import { SmartHub } from '@/components/field-ops/SmartHub'
import { ChangeOrderField } from '@/components/field-ops/ChangeOrderField'
import { VanStock } from '@/components/field-ops/VanStock'
import { QCAudit } from '@/components/field-ops/QCAudit'
import { FieldServiceDesk } from '@/components/field-ops/FieldServiceDesk'
import { CloseoutSOS } from '@/components/field-ops/CloseoutSOS'

const FIELD_TABS = [
  { id: 'tailgate', label: 'Tailgate', icon: ShieldCheck },
  { id: 'lifecycle', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'smarthub', label: 'Smart Hub', icon: MapPin },
  { id: 'co', label: 'Change Orders', icon: RefreshCw },
  { id: 'vanstock', label: 'Van Stock', icon: Package },
  { id: 'qc', label: 'QC Audit', icon: ClipboardCheck },
  { id: 'service', label: 'Service', icon: Headset },
  { id: 'closeout', label: 'Closeout', icon: FileSignature },
] as const

type FieldTab = (typeof FIELD_TABS)[number]['id']

export default function FieldOpsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FieldTab>('tailgate')
  const [tailgatePassed, setTailgatePassed] = useState(false)

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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background gap-2">
        <p className="text-sm text-muted-foreground">Project not found</p>
        <Link href="/org/projects" className="text-sm text-primary hover:underline">Back to projects</Link>
      </div>
    )
  }

  const isLocked = !tailgatePassed && tab !== 'tailgate'

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-card">
        <div className="flex items-center gap-2">
          <Link href={`/org/projects/${project.id}`} className="p-1 hover:bg-muted rounded">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <p className="text-xs font-bold text-foreground">{project.pn} — Field Ops</p>
            <p className="text-[10px] text-muted-foreground">{project.name}</p>
          </div>
        </div>
        {!tailgatePassed && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            <Lock className="h-2.5 w-2.5" /> Tailgate Required
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {isLocked ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <Lock className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Complete the Tailgate briefing first</p>
            <button
              onClick={() => setTab('tailgate')}
              className="mt-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Go to Tailgate
            </button>
          </div>
        ) : (
          <>
            {tab === 'tailgate' && (
              <TailgateGate
                projectId={project.id}
                project={project}
                onPass={() => { setTailgatePassed(true); setTab('lifecycle') }}
              />
            )}
            {tab === 'lifecycle' && <FieldLifecycle project={project} />}
            {tab === 'smarthub' && <SmartHub projectId={project.id} />}
            {tab === 'co' && <ChangeOrderField projectId={project.id} />}
            {tab === 'vanstock' && <VanStock projectId={project.id} />}
            {tab === 'qc' && <QCAudit projectId={project.id} />}
            {tab === 'service' && <FieldServiceDesk projectId={project.id} />}
            {tab === 'closeout' && <CloseoutSOS projectId={project.id} projectName={project.name} />}
          </>
        )}
      </div>

      {/* Bottom Tab Bar (mobile-style) */}
      <div className="border-t border-border bg-card px-1 py-1 safe-area-inset-bottom">
        <div className="flex items-center justify-around">
          {FIELD_TABS.map(t => {
            const Icon = t.icon
            const isActive = tab === t.id
            const isDisabled = !tailgatePassed && t.id !== 'tailgate'

            return (
              <button
                key={t.id}
                onClick={() => !isDisabled && setTab(t.id)}
                disabled={isDisabled}
                className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 transition-colors ${
                  isActive
                    ? 'text-primary'
                    : isDisabled
                    ? 'text-muted-foreground/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[9px] font-medium leading-none">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
