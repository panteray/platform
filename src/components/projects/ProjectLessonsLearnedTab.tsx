'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, BookOpen, Lightbulb, Trash2 } from 'lucide-react'
import type { LessonLearned } from '@/types/database'

interface Props { projectId: string }

const PRACTICE_AREAS = [
  { value: 'project_management', label: 'Project Management' },
  { value: 'design', label: 'Design' },
  { value: 'installation', label: 'Installation' },
  { value: 'programming', label: 'Programming' },
  { value: 'commissioning', label: 'Commissioning' },
  { value: 'operations', label: 'Operations' },
  { value: 'customer_management', label: 'Customer Management' },
  { value: 'presales', label: 'Presales' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'safety', label: 'Safety' },
  { value: 'quality', label: 'Quality' },
  { value: 'communication', label: 'Communication' },
  { value: 'documentation', label: 'Documentation' },
]

const ISSUE_CATEGORIES = [
  { value: 'customer', label: 'Customer' },
  { value: 'design', label: 'Design' },
  { value: 'installation', label: 'Installation' },
  { value: 'operations', label: 'Operations' },
  { value: 'programming', label: 'Programming' },
  { value: 'project_management', label: 'Project Management' },
  { value: 'presales', label: 'Presales' },
]

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

export function ProjectLessonsLearnedTab({ projectId }: Props) {
  const [lessons, setLessons] = useState<LessonLearned[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form
  const [practiceArea, setPracticeArea] = useState('')
  const [issueCategory, setIssueCategory] = useState('')
  const [whatHappened, setWhatHappened] = useState('')
  const [impactText, setImpactText] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/lessons-learned`)
    if (res.ok) setLessons(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!whatHappened.trim() || !practiceArea || !issueCategory) return
    setCreating(true)

    const res = await fetch(`/api/org/projects/${projectId}/lessons-learned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        practice_area: practiceArea,
        issue_category: issueCategory,
        what_happened: whatHappened.trim(),
        impact: impactText.trim() || null,
        recommendation: recommendation.trim() || null,
        severity,
      }),
    })
    if (res.ok) {
      await load()
      setShowForm(false)
      setWhatHappened('')
      setImpactText('')
      setRecommendation('')
    }
    setCreating(false)
  }

  const markReviewed = async (id: string) => {
    await fetch(`/api/org/projects/${projectId}/lessons-learned?item_id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewed' }),
    })
    await load()
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Lessons Learned</h3>
          <p className="text-xs text-muted-foreground">{lessons.length} lessons captured</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Lesson
          </button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold">Capture Lesson Learned</h4>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Practice Area *</label>
              <select
                value={practiceArea}
                onChange={e => setPracticeArea(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              >
                <option value="">Select...</option>
                {PRACTICE_AREAS.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Issue Category *</label>
              <select
                value={issueCategory}
                onChange={e => setIssueCategory(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              >
                <option value="">Select...</option>
                {ISSUE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Severity</label>
              <select
                value={severity}
                onChange={e => setSeverity(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">What Happened *</label>
            <textarea
              value={whatHappened}
              onChange={e => setWhatHappened(e.target.value)}
              placeholder="Describe what occurred..."
              rows={2}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Impact</label>
              <textarea
                value={impactText}
                onChange={e => setImpactText(e.target.value)}
                placeholder="What was the impact..."
                rows={2}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Recommendation</label>
              <textarea
                value={recommendation}
                onChange={e => setRecommendation(e.target.value)}
                placeholder="What should be done differently..."
                rows={2}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!whatHappened.trim() || !practiceArea || !issueCategory || creating}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {creating ? 'Adding...' : 'Add Lesson'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty */}
      {lessons.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-12 text-muted-foreground">
          <BookOpen className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm">No lessons captured</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Document learnings to improve future projects</p>
        </div>
      )}

      {/* Lessons List */}
      {lessons.map(l => {
        const expanded = expandedId === l.id

        return (
          <div key={l.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpandedId(expanded ? null : l.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
            >
              <Lightbulb className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${SEVERITY_COLORS[l.severity] ?? 'bg-muted text-muted-foreground'}`}>
                    {l.severity.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                    {l.practice_area.replace(/_/g, ' ')}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                    {l.issue_category.replace(/_/g, ' ')}
                  </span>
                  {l.status === 'reviewed' && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                      Reviewed
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-foreground mt-0.5 truncate">{l.what_happened}</p>
              </div>
            </button>

            {expanded && (
              <div className="border-t border-border px-4 py-3 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground">What Happened</p>
                  <p className="text-xs text-foreground">{l.what_happened}</p>
                </div>
                {l.impact && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Impact</p>
                    <p className="text-xs text-foreground">{l.impact}</p>
                  </div>
                )}
                {l.recommendation && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Recommendation</p>
                    <p className="text-xs text-foreground">{l.recommendation}</p>
                  </div>
                )}
                {l.status !== 'reviewed' && (
                  <button
                    onClick={() => markReviewed(l.id)}
                    className="rounded-md bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-200"
                  >
                    Mark Reviewed
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
