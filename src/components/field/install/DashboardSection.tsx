'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, ClipboardCheck, Hammer, Users, AlertTriangle, Package, FileSignature } from 'lucide-react'
import type { Project, ProjectTeam, DailyReport, QcChecklist, InventoryTxn, Opportunity } from '@/types/database'

interface Props {
  project: Project
}

type TeamRow = ProjectTeam & {
  users: { id: string; first_name: string | null; last_name: string | null; role: string; avatar_url?: string | null } | null
}

const ROLE_LABEL: Record<ProjectTeam['role'], string> = {
  PM:         'Project Manager',
  LEAD_TECH:  'Lead Tech',
  FIELD_TECH: 'Field Tech',
  SUB:        'Subcontractor',
  PRESALES:   'Presales',
  ENGINEER:   'Engineer',
}

export function DashboardSection({ project }: Props) {
  const [team, setTeam] = useState<TeamRow[]>([])
  const [dailyCount, setDailyCount] = useState<number | null>(null)
  const [qcPendingCount, setQcPendingCount] = useState<number | null>(null)
  const [materialsNet, setMaterialsNet] = useState<number | null>(null)
  const [poStatus, setPoStatus] = useState<'received' | 'pending' | 'unknown'>('unknown')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [teamRes, dailyRes, qcRes, invRes] = await Promise.all([
        fetch(`/api/org/projects/${project.id}/team`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/org/projects/${project.id}/daily-reports`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/org/projects/${project.id}/qc`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/org/projects/${project.id}/inventory`).then((r) => (r.ok ? r.json() : [])),
      ])
      if (cancelled) return
      setTeam(teamRes as TeamRow[])
      setDailyCount((dailyRes as DailyReport[]).length)
      setQcPendingCount((qcRes as QcChecklist[]).filter((q) => q.status !== 'approved').length)
      const txns = invRes as InventoryTxn[]
      const net = txns.reduce((acc, t) => acc + (t.type === 'CREDIT' ? t.quantity : -t.quantity), 0)
      setMaterialsNet(net)
    }
    load()
    return () => { cancelled = true }
  }, [project.id])

  useEffect(() => {
    if (!project.opp_id) { setPoStatus('unknown'); return }
    let cancelled = false
    fetch(`/api/org/opportunities/${project.opp_id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((opp: Opportunity | null) => {
        if (cancelled) return
        if (!opp) setPoStatus('unknown')
        else setPoStatus(opp.po_received_at ? 'received' : 'pending')
      })
    return () => { cancelled = true }
  }, [project.opp_id])

  const days = useMemo(() => buildTwoWeekGrid(new Date()), [])

  return (
    <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-3 md:p-6">
      <div className="space-y-6 md:col-span-2">
        <CalendarCard days={days} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            icon={<Hammer className="h-4 w-4" />}
            title="Daily Reports"
            count={dailyCount}
            unit={dailyCount === 1 ? 'report' : 'reports'}
          />
          <ActionCard
            icon={<ClipboardCheck className="h-4 w-4" />}
            title="QC Checklists"
            count={qcPendingCount}
            unit={qcPendingCount === 1 ? 'pending' : 'pending'}
          />
        </div>
      </div>

      <div className="space-y-6">
        <TeamCard team={team} />
        <VitalsCard
          riskLevel={project.risk_level}
          poStatus={poStatus}
          materialsNet={materialsNet}
        />
      </div>
    </div>
  )
}

function CalendarCard({ days }: { days: Date[] }) {
  const today = new Date()
  const todayKey = ymd(today)
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Calendar className="h-4 w-4 text-primary" /> Install Schedule (2-Week)
        </h3>
        <span className="text-[10px] font-medium text-muted-foreground">Events wire in step #7</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={`h-${i}`} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const isToday = ymd(d) === todayKey
          return (
            <div
              key={d.toISOString()}
              className={`flex h-20 flex-col rounded-lg border p-1.5 ${
                isToday ? 'border-primary bg-primary/5' : 'border-border bg-background'
              }`}
            >
              <span className={`text-[10px] font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                {d.getDate()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  count,
  unit,
}: {
  icon: React.ReactNode
  title: string
  count: number | null
  unit: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="rounded-md bg-muted p-2 text-foreground">{icon}</div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        <p className="text-base font-semibold text-foreground">
          {count === null ? '…' : `${count} ${unit}`}
        </p>
      </div>
    </div>
  )
}

function TeamCard({ team }: { team: TeamRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" /> Project Team
        </h3>
        <span className="text-[10px] font-medium text-muted-foreground">
          {team.length} member{team.length === 1 ? '' : 's'}
        </span>
      </div>
      {team.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No team members assigned</p>
      ) : (
        <ul className="space-y-2.5">
          {team.map((row) => {
            const u = row.users
            const initial = (u?.first_name ?? '?')[0]
            return (
              <li key={row.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-[11px] font-bold uppercase">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold leading-tight">
                    {u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || '—' : '—'}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {ROLE_LABEL[row.role] ?? row.role}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function VitalsCard({
  riskLevel,
  poStatus,
  materialsNet,
}: {
  riskLevel: string | null
  poStatus: 'received' | 'pending' | 'unknown'
  materialsNet: number | null
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Project Vital Signs
      </h3>
      <div className="space-y-2.5">
        <Vital
          icon={<FileSignature className="h-3.5 w-3.5" />}
          label="PO Status"
          value={poStatus === 'received' ? 'Received' : poStatus === 'pending' ? 'Pending' : '—'}
          tone={poStatus === 'received' ? 'good' : poStatus === 'pending' ? 'warn' : 'neutral'}
        />
        <Vital
          icon={<Package className="h-3.5 w-3.5" />}
          label="Materials"
          value={materialsNet === null ? '…' : `${materialsNet} on hand`}
          tone="neutral"
        />
        <Vital
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Risk Level"
          value={riskLevel ?? '—'}
          tone={
            riskLevel?.toLowerCase() === 'high' ? 'bad' :
            riskLevel?.toLowerCase() === 'medium' ? 'warn' :
            riskLevel?.toLowerCase() === 'low' ? 'good' : 'neutral'
          }
        />
      </div>
    </div>
  )
}

function Vital({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'good' | 'warn' | 'bad' | 'neutral'
}) {
  const toneClass =
    tone === 'good' ? 'text-emerald-600' :
    tone === 'warn' ? 'text-amber-600' :
    tone === 'bad'  ? 'text-red-600'    : 'text-muted-foreground'
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 last:border-0">
      <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={`text-xs font-semibold ${toneClass}`}>{value}</span>
    </div>
  )
}

function buildTwoWeekGrid(start: Date): Date[] {
  const d = new Date(start)
  const day = d.getDay() // 0=Sun..6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offsetToMonday)
  d.setHours(0, 0, 0, 0)
  return Array.from({ length: 14 }, (_, i) => {
    const day = new Date(d)
    day.setDate(d.getDate() + i)
    return day
  })
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
