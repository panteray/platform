'use client'
/**
 * Renders an element's attribute_schema as a dynamic form.
 * Groups fields by schema.section, renders text inputs or multi-select chips
 * based on schema.type.
 */

import { useMemo } from 'react'
import type { DeviceElement, ElementAttributeSchemaEntry } from '@/types/database'

interface Props {
  element: DeviceElement
  values: Record<string, unknown>
  onChange: (attr: string, value: unknown) => void
  readOnly?: boolean
}

export function ElementAttributeForm({ element, values, onChange, readOnly = false }: Props) {
  const sections = useMemo(() => {
    const map = new Map<string, ElementAttributeSchemaEntry[]>()
    for (const entry of element.attribute_schema ?? []) {
      const sec = entry.section || 'General'
      if (!map.has(sec)) map.set(sec, [])
      map.get(sec)!.push(entry)
    }
    return Array.from(map.entries())
  }, [element.attribute_schema])

  if (sections.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No attribute schema defined for this element.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {sections.map(([section, entries]) => (
        <div key={section} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">
            {section}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {entries.map((entry) => (
              <AttrField
                key={`${section}::${entry.attr}`}
                entry={entry}
                value={values[entry.attr]}
                onChange={(v) => onChange(entry.attr, v)}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AttrField({
  entry, value, onChange, readOnly,
}: {
  entry: ElementAttributeSchemaEntry
  value: unknown
  onChange: (v: unknown) => void
  readOnly: boolean
}) {
  if (entry.type === 'multi' && entry.options && entry.options.length > 0) {
    const current = typeof value === 'string' ? value : ''
    return (
      <div className="space-y-1 col-span-2">
        <label className="text-[11px] text-muted-foreground">{entry.attr}</label>
        {readOnly ? (
          <p className="text-sm text-foreground">{current || '-'}</p>
        ) : (
          <select
            value={current}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            <option value="">— none —</option>
            {entry.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
      </div>
    )
  }

  const current = value == null ? '' : String(value)
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-muted-foreground">{entry.attr}</label>
      {readOnly ? (
        <p className="text-sm text-foreground break-words">{current || '-'}</p>
      ) : (
        <input
          type="text"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
        />
      )}
    </div>
  )
}
