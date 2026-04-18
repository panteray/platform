'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { ProjectTask, User } from '@/types/database'

type TaskWithAssignee = ProjectTask & {
  assignee?: Pick<User, 'id' | 'first_name' | 'last_name'> | null
}

interface Props {
  projectId: string
  onCountChange?: (total: number, done: number) => void
}

export function TaskList({ projectId, onCountChange }: Props) {
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [mutating, setMutating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/org/projects/${projectId}/tasks`)
    if (res.ok) {
      const data: TaskWithAssignee[] = await res.json()
      setTasks(data)
      onCountChange?.(data.length, data.filter((t) => t.status === 'done').length)
    }
    setLoading(false)
  }, [projectId, onCountChange])

  useEffect(() => { load() }, [load])

  const toggle = async (task: TaskWithAssignee) => {
    if (mutating) return
    setMutating(task.id)
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    const res = await fetch(`/api/org/projects/${projectId}/tasks?task_id=${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t))
        onCountChange?.(next.length, next.filter((t) => t.status === 'done').length)
        return next
      })
    }
    setMutating(null)
  }

  const addTask = async () => {
    const title = newTitle.trim()
    if (!title) return
    const res = await fetch(`/api/org/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, status: 'todo', sort_order: tasks.length }),
    })
    if (res.ok) {
      const created = await res.json()
      setTasks((prev) => {
        const next = [...prev, created]
        onCountChange?.(next.length, next.filter((t) => t.status === 'done').length)
        return next
      })
      setNewTitle('')
      setAdding(false)
    }
  }

  const removeTask = async (taskId: string) => {
    setMutating(taskId)
    const res = await fetch(`/api/org/projects/${projectId}/tasks?task_id=${taskId}`, { method: 'DELETE' })
    if (res.ok) {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== taskId)
        onCountChange?.(next.length, next.filter((t) => t.status === 'done').length)
        return next
      })
    }
    setMutating(null)
  }

  const done = tasks.filter((t) => t.status === 'done').length
  const total = tasks.length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  if (loading) {
    return <div className="flex h-48 items-center justify-center text-sm text-neutral-400">Loading…</div>
  }

  return (
    <div className="p-4 pb-24">
      <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>{done} of {total} complete</span>
          <span className="font-semibold text-neutral-900">{pct}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => {
          const isDone = task.status === 'done'
          const assignee = task.assignee
          const who = assignee ? `${assignee.first_name ?? ''} ${assignee.last_name ?? ''}`.trim() : null
          return (
            <div
              key={task.id}
              className={`group flex items-start gap-3 rounded-xl border bg-white p-3.5 ${
                isDone ? 'border-neutral-100' : 'border-neutral-200'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(task)}
                disabled={mutating === task.id}
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-[1.5px] transition ${
                  isDone
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-neutral-300 active:border-blue-500'
                }`}
              >
                {isDone && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`text-sm leading-snug ${isDone ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>
                  {task.title}
                </div>
                {(who || task.completed_at) && (
                  <div className="mt-1 text-[11px] text-neutral-400">
                    {isDone && task.completed_at
                      ? `✓ ${who ?? 'Done'} · ${new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : who
                        ? `Assigned: ${who}`
                        : 'Unassigned'}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeTask(task.id)}
                disabled={mutating === task.id}
                className="opacity-0 transition group-hover:opacity-100 active:opacity-100"
              >
                <X className="h-4 w-4 text-neutral-300" />
              </button>
            </div>
          )
        })}
        {tasks.length === 0 && !adding && (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-10 text-center">
            <p className="text-sm text-neutral-500">No tasks yet</p>
            <p className="mt-1 text-xs text-neutral-400">Tap + below to add one</p>
          </div>
        )}
      </div>

      {adding ? (
        <div className="mt-3 flex gap-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTask()
              if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
            }}
            placeholder="Describe the task…"
            className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={addTask}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white active:bg-blue-700"
          >
            Add
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white py-3.5 text-sm font-semibold text-neutral-600 active:bg-neutral-50"
        >
          <Plus className="h-4 w-4" />
          Add task
        </button>
      )}
    </div>
  )
}
