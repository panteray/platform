'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { C } from './constants'
import type { DesignArea } from '@/types/database'

interface AreaTabsProps {
  areas: DesignArea[]
  activeAreaId: string | null
  onAreaChange: (id: string) => void
  onAddArea: (name: string, canvasType: string) => void
  onDeleteArea: (id: string) => void
  onRenameArea: (id: string, name: string) => void
}

export function AreaTabs({
  areas,
  activeAreaId,
  onAreaChange,
  onAddArea,
  onDeleteArea,
  onRenameArea,
}: AreaTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  function handleDoubleClick(area: DesignArea) {
    setEditingId(area.id)
    setEditValue(area.name)
  }

  function handleRenameBlur(id: string) {
    if (editValue.trim() && editValue.trim() !== areas.find(a => a.id === id)?.name) {
      onRenameArea(id, editValue.trim())
    }
    setEditingId(null)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 36,
        background: C.bgSurface,
        borderBottom: `1px solid ${C.border}`,
        padding: '0 8px',
        gap: 2,
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {areas.map((area) => {
        const isActive = activeAreaId === area.id
        const isEditing = editingId === area.id

        return (
          <div
            key={area.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 12px',
              height: 28,
              fontSize: 12,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? C.text : C.textMuted,
              background: isActive ? C.bgActive : 'transparent',
              border: isActive ? `1px solid ${C.border}` : '1px solid transparent',
              borderRadius: 5,
              borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.12s',
            }}
            onClick={() => onAreaChange(area.id)}
            onDoubleClick={() => handleDoubleClick(area)}
          >
            {isEditing ? (
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleRenameBlur(area.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameBlur(area.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.text,
                  fontSize: 12,
                  width: 100,
                  outline: 'none',
                }}
              />
            ) : (
              <span>{area.name}</span>
            )}
            {isActive && areas.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteArea(area.id)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.textDim,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}

      <button
        onClick={() => onAddArea(`Area ${String.fromCharCode(65 + areas.length)}`, 'FLOOR_PLAN')}
        style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: `1px dashed ${C.border}`,
          borderRadius: 5,
          color: C.textDim,
          cursor: 'pointer',
          marginLeft: 2,
          flexShrink: 0,
        }}
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
