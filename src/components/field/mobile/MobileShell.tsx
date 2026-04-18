'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  backHref: string
  pn: string | null
  name: string
  status: string
  siteAddress?: string | null
  tabs: ReactNode
  children: ReactNode
}

const STATUS_COLOR: Record<string, string> = {
  planning:    'bg-blue-100 text-blue-700',
  active:      'bg-emerald-100 text-emerald-700',
  on_hold:     'bg-amber-100 text-amber-700',
  punch_list:  'bg-orange-100 text-orange-700',
  closeout:    'bg-purple-100 text-purple-700',
  completed:   'bg-neutral-100 text-neutral-600',
  cancelled:   'bg-red-100 text-red-700',
}

export function MobileShell({ backHref, pn, name, status, siteAddress, tabs, children }: Props) {
  return (
    <div className="-m-6 flex h-[calc(100dvh-56px)] flex-col bg-neutral-50 md:h-[calc(100vh-56px)]">
      <div className="bg-neutral-900 px-4 pt-4 pb-5 text-white">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={backHref}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 active:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[status] ?? 'bg-neutral-100 text-neutral-700'}`}>
            {status.replace('_', ' ')}
          </span>
        </div>
        <div className="font-mono text-[11px] text-blue-300">PN {pn ?? '—'}</div>
        <h1 className="mt-0.5 text-xl font-semibold leading-tight">{name}</h1>
        {siteAddress && <p className="mt-1 text-xs text-neutral-400">{siteAddress}</p>}
      </div>
      {tabs}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

interface TabsProps {
  active: 'tasks' | 'daily' | 'qc'
  onChange: (t: 'tasks' | 'daily' | 'qc') => void
  counts?: { tasks?: number; daily?: number; qc?: number }
}

export function MobileTabs({ active, onChange, counts }: TabsProps) {
  const tabs: Array<{ key: 'tasks' | 'daily' | 'qc'; label: string }> = [
    { key: 'tasks', label: 'Tasks' },
    { key: 'daily', label: 'Daily' },
    { key: 'qc',    label: 'QC'    },
  ]
  return (
    <div className="flex shrink-0 border-b border-neutral-200 bg-white">
      {tabs.map((t) => {
        const count = counts?.[t.key]
        const isActive = active === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex-1 border-b-2 px-3 py-3 text-sm font-semibold transition ${
              isActive
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-neutral-500 active:bg-neutral-50'
            }`}
          >
            {t.label}
            {typeof count === 'number' && count > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                isActive ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-600'
              }`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
