'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, CheckCircle2, Circle, Clock, AlertTriangle, XCircle } from 'lucide-react'
import type { ProjectTask } from '@/types/database'

interface Props { projectId: string }

const STATUS_ICON: Record<string, typeof Circle> = {
  todo: Circle,
  in_progress: Clock,
  blocked: AlertTriangle,
  done: CheckCircle2,
  cancelled: XCircle,
}
const STATUS_COLOR: Record<string, string> = {
  todo: 'text-muted-foreground',
  in_progress: 'text-blue-500',
  blocked: 'text-red-500',
  done: 'text-emerald-500',
  cancelled: 'text-neutral-400',
}

export function ProjectTasksTab({ projectId }: Props) {
  const [tasks, setTasks] = useState<(ProjectTask & { assignee?: { first_name: string; last_name: string } | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/tasks`)
    if (res.ok) setTasks(await res.json())
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const createTask = async () => {
    const title = newTitle.trim()
    if (!title) return
    const res = await fetch(`/api/org/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (res.ok) {
      setNewTitle('')
      await load()
    }
  }

  const updateStatus = async (taskId: string, status: string) => {
    await fetch(`/api/org/projects/${projectId}/tasks?task_id=${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  const deleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/org/projects/${projectId}/tasks?task_id=${taskId}`, { method: 'DELETE' })
    await load()
  }

  if (loading) return <div className="flex h-32 items-center justify-center"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  const todoCount = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length
  const doneCount = tasks.filter(t => t.status === 'done').length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tasks</h3>
          <p className="text-[10px] text-muted-foreground">{todoCount} open · {doneCount} completed</p>
        </div>
      </div>

      {/* Quick Add */}
      <div className="flex items-center gap-2">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createTask()}
          placeholder="Add a task..."
          className="flex-1 rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
        />
        <button
          onClick={createTask}
          disabled={!newTitle.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Circle className="mb-2 h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs">No tasks yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tasks.map(task => {
            const Icon = STATUS_ICON[task.status] ?? Circle
            const color = STATUS_COLOR[task.status] ?? 'text-muted-foreground'

            return (
              <div
                key={task.id}
                className={`flex items-center gap-2 rounded-md border border-border px-2.5 py-2 ${
                  task.status === 'done' ? 'opacity-60' : ''
                }`}
              >
                <button
                  onClick={() => updateStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                  className={`flex-shrink-0 ${color}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {task.assignee && <span>{task.assignee.first_name} {task.assignee.last_name}</span>}
                    {task.due_date && <span>Due {new Date(task.due_date).toLocaleDateString()}</span>}
                    {task.priority !== 'MEDIUM' && (
                      <span className={task.priority === 'HIGH' || task.priority === 'URGENT' ? 'text-red-500 font-bold' : ''}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                </div>
                <select
                  value={task.status}
                  onChange={e => updateStatus(task.id, e.target.value)}
                  className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] outline-none"
                >
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
