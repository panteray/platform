'use client'

import { useState, useRef } from 'react'
import { Upload, Save, FileDown, Grid3X3 } from 'lucide-react'
import { C } from './constants'
import { AreaTabs } from './area-tabs'
import { CanvasArea } from './canvas-area'
import { useDesignCanvas } from '@/hooks/useDesignCanvas'
import type { DesignFloorPlan } from '@/types/database'

interface DesignCanvasProps {
  designId: string
}

export function DesignCanvas({ designId }: DesignCanvasProps) {
  const {
    design,
    areas,
    floorPlans,
    loading,
    error,
    activeAreaId,
    setActiveAreaId,
    addArea,
    updateArea,
    deleteArea,
    uploadFloorPlan,
  } = useDesignCanvas(designId)

  const [showGrid, setShowGrid] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeArea = areas.find((a) => a.id === activeAreaId) ?? null
  const activeFloorPlan: DesignFloorPlan | null =
    floorPlans.find((fp) => fp.area_id === activeAreaId) ?? null

  const opp = design?.opportunities as Record<string, unknown> | undefined
  const projectName = opp?.project_name
    ? `${opp.opp_number} / ${opp.project_name}`
    : design?.name ?? 'Design Canvas'

  async function handleFloorPlanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeAreaId) return
    await uploadFloorPlan(activeAreaId, file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 500, background: C.bg, borderRadius: 8, color: C.textMuted, fontSize: 13 }}>
        Loading design...
      </div>
    )
  }

  if (error || !design) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 500, background: C.bg, borderRadius: 8, color: C.red, fontSize: 13 }}>
        {error ?? 'Design not found'}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', background: C.bg, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: C.bgSurface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{projectName}</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{design.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setShowGrid(!showGrid)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', fontSize: 11, borderRadius: 6,
              border: `0.5px solid ${showGrid ? C.accent : C.border}`,
              background: showGrid ? C.accentSubtle : 'transparent',
              color: showGrid ? C.accent : C.textMuted, cursor: 'pointer',
            }}
          >
            <Grid3X3 size={14} /> Grid
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', fontSize: 11, borderRadius: 6,
              border: `0.5px solid ${C.border}`,
              background: 'transparent', color: C.textMuted, cursor: 'pointer',
            }}
          >
            <Upload size={14} /> Floor plan
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFloorPlanUpload}
            style={{ display: 'none' }}
          />
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', fontSize: 11, borderRadius: 6,
              border: `0.5px solid ${C.border}`,
              background: 'transparent', color: C.textMuted, cursor: 'pointer',
            }}
          >
            <FileDown size={14} /> Export
          </button>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', fontSize: 11, borderRadius: 6,
              background: C.text, color: C.bg, cursor: 'pointer', border: 'none',
              fontWeight: 500,
            }}
          >
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      {/* Requirements bar placeholder — built in 7P */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 16px', background: C.bgSurface, borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textDim, flexShrink: 0 }}>
        <span>Cameras: <span style={{ fontWeight: 500, color: C.textMuted }}>0</span></span>
        <span>PoE: <span style={{ fontWeight: 500, color: C.textMuted }}>0W</span></span>
        <span>Ports: <span style={{ fontWeight: 500, color: C.textMuted }}>0</span></span>
        <span>Cable: <span style={{ fontWeight: 500, color: C.textMuted }}>0ft</span></span>
      </div>

      {/* Area tabs */}
      <AreaTabs
        areas={areas}
        activeAreaId={activeAreaId}
        onAreaChange={setActiveAreaId}
        onAddArea={(name, type) => addArea(name, type)}
        onDeleteArea={deleteArea}
        onRenameArea={(id, name) => updateArea(id, { name })}
      />

      {/* Main canvas area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left icon sidebar placeholder — built in 7C */}
        <div style={{ width: 52, background: C.bgPanel, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: C.accentSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
          </div>
        </div>

        {/* Fabric.js canvas */}
        <CanvasArea
          designId={designId}
          areaId={activeAreaId}
          floorPlan={activeFloorPlan}
          showGrid={showGrid}
          onZoomChange={setZoomLevel}
        />

        {/* Right panel placeholder — built in 7D */}
        <div style={{ width: 260, background: C.bgPanel, borderLeft: `1px solid ${C.border}`, padding: 12, flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>Properties</div>
          <div style={{ fontSize: 11, color: C.textDim }}>
            Select a device on the canvas to view its properties.
          </div>
          {activeArea && (
            <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: C.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Active area</div>
              <div style={{ fontSize: 12, color: C.text }}>{activeArea.name}</div>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>Type: {activeArea.canvas_type}</div>
              {activeArea.scale_calibration && (
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>Scale: {activeArea.scale_calibration} px/ft</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
