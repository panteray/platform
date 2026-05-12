'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  PenLine,
  RefreshCw,
} from 'lucide-react'
import type { ProjectDocType, ProjectDocument } from '@/types/database'

interface Props {
  projectId: string
}

interface TileMeta {
  type: ProjectDocType
  label: string
  hint: string
  icon: typeof FileText
  /** Tailwind text color for the icon. */
  accent: string
}

const TILES: TileMeta[] = [
  { type: 'welcome_email',     label: 'Welcome Email',     hint: 'Kickoff message to the customer',     icon: Mail,            accent: 'text-sky-500' },
  { type: 'project_workbook',  label: 'Project Workbook',  hint: 'Tasks, milestones, COs as XLSX',      icon: FileSpreadsheet, accent: 'text-emerald-500' },
  { type: 'install_reminder',  label: 'Install Reminder',  hint: 'Pre-install heads-up to the customer', icon: Mail,           accent: 'text-amber-500' },
  { type: 'sign_off_sheet',    label: 'Sign Off Sheet',    hint: 'Acceptance form for closeout',         icon: PenLine,        accent: 'text-violet-500' },
  { type: 'change_order_form', label: 'Change Order Form', hint: 'Blank CO form to fill in',             icon: FileText,       accent: 'text-rose-500' },
]

export function DocumentsSection({ projectId }: Props) {
  const [docs, setDocs] = useState<ProjectDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<ProjectDocType | null>(null)
  const [expanded, setExpanded] = useState<ProjectDocType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/org/projects/${projectId}/documents`)
      if (!res.ok) throw new Error(`Failed to load documents (${res.status})`)
      const data = (await res.json()) as ProjectDocument[]
      setDocs(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  const byType = useMemo(() => {
    const map = new Map<ProjectDocType, ProjectDocument[]>()
    for (const d of docs) {
      const list = map.get(d.doc_type) ?? []
      list.push(d)
      map.set(d.doc_type, list)
    }
    for (const [, list] of map) list.sort((a, b) => b.version - a.version)
    return map
  }, [docs])

  async function generate(type: ProjectDocType) {
    setGenerating(type)
    setError(null)
    try {
      const res = await fetch(`/api/org/projects/${projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: type }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Generate failed (${res.status})`)
      }
      await reload()
      setExpanded(type)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setGenerating(null)
    }
  }

  async function download(doc: ProjectDocument) {
    try {
      const res = await fetch(`/api/org/projects/${projectId}/documents/${doc.id}/download`)
      if (!res.ok) throw new Error('Download failed')
      const data = (await res.json()) as { url: string }
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    }
  }

  return (
    <div className="space-y-3 p-4">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </div>
      )}

      {TILES.map((tile) => {
        const versions = byType.get(tile.type) ?? []
        const latest = versions[0] ?? null
        const isOpen = expanded === tile.type
        const isBusy = generating === tile.type
        const Icon = tile.icon

        return (
          <div
            key={tile.type}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="flex w-full items-center gap-3 px-4 py-4">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : tile.type)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted ${tile.accent}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="truncate text-sm font-semibold text-foreground">{tile.label}</h4>
                    {latest && (
                      <span className="shrink-0 text-[11px] font-mono text-muted-foreground">
                        v{latest.version} · {formatDate(latest.generated_at)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {loading ? 'Loading…' : latest ? tile.hint : `${tile.hint} — not generated yet`}
                  </p>
                </div>
              </button>
              {latest ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void download(latest)
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void generate(tile.type)
                  }}
                  disabled={isBusy || loading}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  Generate
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : tile.type)}
                aria-label={isOpen ? 'Collapse' : 'Expand'}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {isOpen && (
              <div className="border-t border-border bg-background/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {latest && (
                    <button
                      type="button"
                      onClick={() => download(latest)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download latest
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => generate(tile.type)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                  >
                    {isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : latest ? (
                      <RefreshCw className="h-3.5 w-3.5" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    {latest ? 'Generate new version' : 'Generate'}
                  </button>
                </div>

                {versions.length > 0 && (
                  <div className="mt-3">
                    <h5 className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      All versions
                    </h5>
                    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                      {versions.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-[11px] text-foreground">v{v.version}</div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {formatDate(v.generated_at)} · {formatBytes(v.byte_size)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => download(v)}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
