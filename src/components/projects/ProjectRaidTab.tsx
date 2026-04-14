'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, AlertTriangle, Activity, CircleDot, GitBranch, Trash2 } from 'lucide-react'
import type { RaidItem } from '@/types/database'

interface Props { projectId: string }

const TYPE_CONFIG = {
  RISK: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
  ACTION: { icon: Activity, color: 'text-blue-500', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  ISSUE: { icon: CircleDot, color: 'text-amber-500', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
  DECISION: { icon: GitBranch, color: 'text-purple-500', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
} as const

const STATUS_OPTIONS = [
  'open', 'in_progress', 'ongoing', 'on_track', 'needs_review',
  'approved', 'overdue', 'on_hold', 'resolved', 'closed',
]

const PRACTICE_AREAS = [
  'project_management', 'design', 'installation', 'programming',
  'commissioning', 'operations', 'customer_management', 'presales',
  'procurement', 'subcontractor', 'safety', 'quality', 'communication', 'documentation',
]

const RESPONSE_TYPES = ['avoid', 'mitigate', 'transfer', 'accept']

type RaidType = 'RISK' | 'ACTION' | 'ISSUE' | 'DECISION'

export function ProjectRaidTab({ projectId }: Props) {
  const [items, setItems] = useState<RaidItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<RaidType | 'ALL'>('ALL')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form
  const [formType, setFormType] = useState<RaidType>('RISK')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [probability, setProbability] = useState(5)
  const [impact, setImpact] = useState(5)
  const [severity, setSeverity] = useState('medium')
  const [category, setCategory] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const url = filter === 'ALL'
      ? `/api/org/projects/${projectId}/raid`
      : `/api/org/projects/${projectId}/raid?type=${filter}`
    const res = await fetch(url)
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [projectId, filter])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!title.trim()) return
    setCreating(true)
    const payload: Record<string, unknown> = {
      title: title.trim(),
      type: formType,
      description: description.trim() || null,
      category: category || null,
    }
    if (formType === 'RISK') {
      payload.probability = probability
      payload.impact = impact
    }
    if (formType === 'ISSUE') {
      payload.severity = severity
    }

    const res = await fetch(`/api/org/projects/${projectId}/raid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      await load()
      setShowForm(false)
      setTitle('')
      setDescription('')
    }
    setCreating(false)
  }

  const updateItem = async (item: RaidItem, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/org/projects/${projectId}/raid?item_id=${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) await load()
  }

  const deleteItem = async (id: string) => {
    const res = await fetch(`/api/org/projects/${projectId}/raid?item_id=${id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  const riskColor = (rating: number | null) => {
    if (!rating) return 'text-muted-foreground'
    if (rating >= 70) return 'text-red-600 font-bold'
    if (rating >= 40) return 'text-amber-600 font-bold'
    return 'text-emerald-600'
  }

  const riskBg = (rating: number | null) => {
    if (!rating) return ''
    if (rating >= 70) return 'bg-red-50 border-red-200'
    if (rating >= 40) return 'bg-amber-50 border-amber-200'
    return 'bg-emerald-50 border-emerald-200'
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const counts = {
    RISK: items.filter(i => i.type === 'RISK').length,
    ACTION: items.filter(i => i.type === 'ACTION').length,
    ISSUE: items.filter(i => i.type === 'ISSUE').length,
    DECISION: items.filter(i => i.type === 'DECISION').length,
  }

  const filteredItems = filter === 'ALL' ? items : items.filter(i => i.type === filter)

  return (
    <div className="space-y-4">
      {/* Header + Counts */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">RAID Log</h3>
          <p className="text-xs text-muted-foreground">Risks, Actions, Issues, Decisions</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Item
          </button>
        )}
      </div>

      {/* Type Filter */}
      <div className="flex gap-1.5">
        {(['ALL', 'RISK', 'ACTION', 'ISSUE', 'DECISION'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
              filter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'ALL' ? `All (${items.length})` : `${t.charAt(0)}${t.slice(1).toLowerCase()} (${counts[t]})`}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex gap-1.5">
            {(['RISK', 'ACTION', 'ISSUE', 'DECISION'] as const).map(t => {
              const cfg = TYPE_CONFIG[t]
              return (
                <button
                  key={t}
                  onClick={() => setFormType(t)}
                  className={`rounded-md px-3 py-1.5 text-[10px] font-bold transition-colors ${
                    formType === t ? cfg.badge : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={`${formType.charAt(0) + formType.slice(1).toLowerCase()} title...`}
            className="w-full rounded border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary"
            autoFocus
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description..."
            rows={2}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
              >
                <option value="">Select...</option>
                {PRACTICE_AREAS.map(a => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            {formType === 'RISK' && (
              <>
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                    Probability (1-10): {probability}
                  </label>
                  <input
                    type="range" min={1} max={10} value={probability}
                    onChange={e => setProbability(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                    Impact (1-10): {impact}
                  </label>
                  <input
                    type="range" min={1} max={10} value={impact}
                    onChange={e => setImpact(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </>
            )}
            {formType === 'ISSUE' && (
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!title.trim() || creating}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {creating ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Items */}
      {filteredItems.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <AlertTriangle className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm">No {filter === 'ALL' ? 'RAID' : filter.toLowerCase()} items</p>
        </div>
      )}

      <div className="space-y-2">
        {filteredItems.map(item => {
          const cfg = TYPE_CONFIG[item.type]
          const Icon = cfg.icon
          const expanded = expandedId === item.id
          const isOpen = !['resolved', 'closed'].includes(item.status)

          return (
            <div
              key={item.id}
              className={`rounded-lg border ${
                item.type === 'RISK' && item.risk_rating ? riskBg(item.risk_rating) : 'border-border bg-card'
              } overflow-hidden`}
            >
              <button
                onClick={() => setExpandedId(expanded ? null : item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">{item.raid_number}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${cfg.badge}`}>
                      {item.type}
                    </span>
                    {isOpen && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    )}
                    {!isOpen && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                        {item.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground mt-0.5 truncate">{item.title}</p>
                </div>
                {item.type === 'RISK' && item.risk_rating != null && (
                  <span className={`text-sm font-bold ${riskColor(item.risk_rating)}`}>
                    {item.risk_rating}
                  </span>
                )}
              </button>

              {expanded && (
                <div className="border-t border-border/50 px-3 py-3 space-y-2">
                  {item.description && <p className="text-xs text-foreground">{item.description}</p>}

                  {item.type === 'RISK' && (
                    <div className="flex gap-4 text-[10px]">
                      <span>P: <strong>{item.probability}</strong></span>
                      <span>I: <strong>{item.impact}</strong></span>
                      <span>Rating: <strong className={riskColor(item.risk_rating)}>{item.risk_rating}</strong></span>
                      {item.response_type && <span>Response: <strong>{item.response_type}</strong></span>}
                    </div>
                  )}

                  {item.category && (
                    <p className="text-[10px] text-muted-foreground">Category: {item.category.replace(/_/g, ' ')}</p>
                  )}

                  {/* Status update */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Status:</span>
                    <select
                      value={item.status}
                      onChange={e => updateItem(item, { status: e.target.value })}
                      className="rounded border border-border bg-background px-2 py-1 text-[10px] outline-none"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="ml-auto text-[10px] text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
