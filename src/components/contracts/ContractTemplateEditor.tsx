'use client'

import { useEffect, useRef, useState } from 'react'
import type { ContractTemplate, ContractClause } from '@/types/database'
import { CONTRACT_TEMPLATE_TYPES, CONTRACT_TEMPLATE_TYPE_LABELS } from '@/types/database'

interface Variable { key: string; label: string; default?: string }
interface Props { templateId: string }

export default function ContractTemplateEditor({ templateId }: Props) {
  const [template, setTemplate] = useState<ContractTemplate | null>(null)
  const [clauses, setClauses] = useState<ContractClause[]>([])
  const [libraryClauses, setLibraryClauses] = useState<ContractClause[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showClauseLib, setShowClauseLib] = useState(false)
  const [newVar, setNewVar] = useState({ key: '', label: '' })
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  async function load() {
    setLoading(true)
    const [tplRes, clauseRes] = await Promise.all([
      fetch(`/api/org/contracts/templates/${templateId}`),
      fetch('/api/org/contracts/clauses'),
    ])
    if (tplRes.ok) {
      const data = await tplRes.json()
      setTemplate(data)
      setClauses(data.clauses ?? [])
    }
    if (clauseRes.ok) setLibraryClauses(await clauseRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [templateId])

  async function save() {
    if (!template) return
    setSaving(true)
    await fetch(`/api/org/contracts/templates/${templateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: template.name,
        type: template.type,
        status: template.status,
        body_md: template.body_md,
        variables: template.variables,
      }),
    })
    setSaving(false)
  }

  function insertAtCursor(text: string) {
    const ta = bodyRef.current
    if (!ta || !template) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = template.body_md.substring(0, start)
    const after = template.body_md.substring(end)
    const newBody = `${before}${text}${after}`
    setTemplate({ ...template, body_md: newBody })
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + text.length, start + text.length)
    })
  }

  function addVariable() {
    if (!template || !newVar.key) return
    const vars = [...((template.variables as Variable[]) ?? []), { key: newVar.key, label: newVar.label || newVar.key }]
    setTemplate({ ...template, variables: vars })
    setNewVar({ key: '', label: '' })
  }

  function removeVariable(key: string) {
    if (!template) return
    setTemplate({
      ...template,
      variables: ((template.variables as Variable[]) ?? []).filter((v) => v.key !== key),
    })
  }

  if (loading || !template) return <div className="p-6 text-sm text-slate-500">Loading...</div>

  const variables = (template.variables as Variable[]) ?? []

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_200px_180px] gap-3">
          <input
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            placeholder="Template name"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select
            value={template.type}
            onChange={(e) => setTemplate({ ...template, type: e.target.value as ContractTemplate['type'] })}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {CONTRACT_TEMPLATE_TYPES.map((t) => (
              <option key={t} value={t}>{CONTRACT_TEMPLATE_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <select
            value={template.status}
            onChange={(e) => setTemplate({ ...template, status: e.target.value as ContractTemplate['status'] })}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-slate-600">Body (Markdown)</label>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClauseLib(!showClauseLib)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
              >
                {showClauseLib ? 'Hide' : 'Show'} Clause Library
              </button>
            </div>
          </div>
          <textarea
            ref={bodyRef}
            value={template.body_md}
            onChange={(e) => setTemplate({ ...template, body_md: e.target.value })}
            rows={24}
            placeholder="Use {{variable_key}} for substitutable fields"
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-slate-600">Variables</div>
          <div className="space-y-1">
            {variables.map((v) => (
              <div key={v.key} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1 text-xs">
                <button
                  onClick={() => insertAtCursor(`{{${v.key}}}`)}
                  className="flex-1 text-left font-mono text-slate-700 hover:text-slate-900"
                >
                  {`{{${v.key}}}`}
                </button>
                <button onClick={() => removeVariable(v.key)} className="text-red-500 hover:text-red-700">×</button>
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            <input
              value={newVar.key}
              onChange={(e) => setNewVar({ ...newVar, key: e.target.value })}
              placeholder="variable_key"
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
            />
            <input
              value={newVar.label}
              onChange={(e) => setNewVar({ ...newVar, label: e.target.value })}
              placeholder="Label (optional)"
              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <button onClick={addVariable} className="w-full rounded bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-800">
              + Add Variable
            </button>
          </div>
        </div>

        {showClauseLib && (
          <div className="rounded border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-600">Library</div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {libraryClauses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => insertAtCursor(`\n\n${c.body_md}\n\n`)}
                  className="w-full rounded bg-slate-50 p-2 text-left text-xs hover:bg-slate-100"
                >
                  <div className="font-medium text-slate-900">{c.name}</div>
                  {c.category && <div className="text-slate-500">{c.category}</div>}
                </button>
              ))}
              {libraryClauses.length === 0 && (
                <div className="text-xs text-slate-500">No clauses in library yet.</div>
              )}
            </div>
          </div>
        )}

        {clauses.length > 0 && (
          <div className="rounded border border-slate-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-600">Attached Clauses</div>
            <div className="space-y-1">
              {clauses.map((tc) => {
                const c = (tc as unknown as { clause: ContractClause }).clause
                return c ? <div key={c.id} className="text-xs text-slate-700">{c.name}</div> : null
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
