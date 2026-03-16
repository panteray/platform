'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Save, FileDown, Grid3X3 } from 'lucide-react'
import { C, type CanvasTool, type IconTabId } from './constants'
import { LABEL_PREFIX, CATEGORY_TO_ICON } from './icons'
import { AreaTabs } from './area-tabs'
import { CanvasArea } from './canvas-area'
import { IconSidebar } from './icon-sidebar'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { useDesignCanvas } from '@/hooks/useDesignCanvas'
import type { DesignFloorPlan } from '@/types/database'

// Map icon tab to the default device sub-type placed on click
const TAB_TO_DEFAULT_SUBTYPE: Record<string, string> = {
  camera: 'dome',
  door: 'door',
  network: 'switch',
  av: 'speaker',
  sensors: 'junction_box',
  other: 'junction_box',
}

// Map icon tab to device category enum
const TAB_TO_CATEGORY: Record<string, string> = {
  camera: 'cctv',
  door: 'access_control',
  network: 'network',
  av: 'av',
  sensors: 'vape_environmental',
  other: 'other',
}

interface DesignCanvasProps {
  designId: string
}

export function DesignCanvas({ designId }: DesignCanvasProps) {
  const {
    design,
    areas,
    devices,
    floorPlans,
    loading,
    error,
    activeAreaId,
    selectedDeviceId,
    setActiveAreaId,
    setSelectedDeviceId,
    addArea,
    updateArea,
    deleteArea,
    uploadFloorPlan,
    addDevice,
    updateDevice,
    deleteDevice,
    refetch,
  } = useDesignCanvas(designId)

  const [showGrid, setShowGrid] = useState(true)
  const [activeTool, setActiveTool] = useState<CanvasTool>('select')
  const [activeIcon, setActiveIcon] = useState<IconTabId>('layers')
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeArea = areas.find((a) => a.id === activeAreaId) ?? null
  const activeFloorPlan: DesignFloorPlan | null =
    floorPlans.find((fp) => fp.area_id === activeAreaId) ?? null
  const areaDevices = devices.filter((d) => d.area_id === activeAreaId)

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

  // When a category icon is clicked, enter place mode
  function handleIconChange(tabId: IconTabId) {
    setActiveIcon(tabId)
    if (tabId === 'layers') {
      setShowLeftPanel(true)
      setActiveTool('select')
    } else {
      setShowLeftPanel(true)
      setActiveTool('place')
    }
  }

  // Canvas click in place mode — create device at click point
  const handleCanvasClick = useCallback(async (x: number, y: number) => {
    if (activeTool !== 'place' || !activeAreaId) return
    if (activeIcon === 'layers') return

    const category = TAB_TO_CATEGORY[activeIcon] || 'other'
    const subType = TAB_TO_DEFAULT_SUBTYPE[activeIcon] || 'junction_box'
    const prefix = LABEL_PREFIX[subType] || 'DEV'

    await addDevice({
      area_id: activeAreaId,
      category: subType,
      position_x: x,
      position_y: y,
      color_hex: C.accent,
      label_prefix: prefix,
      properties: { sub_type: subType },
    })
  }, [activeTool, activeAreaId, activeIcon, addDevice])

  // Device move/rotate handlers
  const handleDeviceMoved = useCallback(async (id: string, x: number, y: number) => {
    await updateDevice(id, { position_x: x, position_y: y })
  }, [updateDevice])

  const handleDeviceRotated = useCallback(async (id: string, angle: number) => {
    await updateDevice(id, { rotation: angle })
  }, [updateDevice])

  // Context menu actions
  const handleDeviceCopy = useCallback(async (id: string) => {
    const src = devices.find((d) => d.id === id)
    if (!src) return
    const prefix = LABEL_PREFIX[src.category] || 'DEV'
    await addDevice({
      area_id: src.area_id,
      category: src.category,
      position_x: src.position_x + 40,
      position_y: src.position_y + 40,
      color_hex: src.color_hex,
      rotation: src.rotation,
      label_prefix: prefix,
      properties: src.properties,
      device_library_item_id: src.device_library_item_id,
      mount_type: src.mount_type,
      status: src.status,
    })
  }, [devices, addDevice])

  const handleDeviceDelete = useCallback(async (id: string) => {
    await deleteDevice(id)
  }, [deleteDevice])

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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Tool indicator */}
          {activeTool === 'place' && (
            <span style={{ fontSize: 10, color: C.green, background: 'rgba(34,197,94,0.12)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
              PLACE MODE
            </span>
          )}
          <button onClick={() => setShowGrid(!showGrid)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6,
              border: `0.5px solid ${showGrid ? C.accent : C.border}`, background: showGrid ? C.accentSubtle : 'transparent',
              color: showGrid ? C.accent : C.textMuted, cursor: 'pointer' }}>
            <Grid3X3 size={14} /> Grid
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6,
              border: `0.5px solid ${C.border}`, background: 'transparent', color: C.textMuted, cursor: 'pointer' }}>
            <Upload size={14} /> Floor plan
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFloorPlanUpload} style={{ display: 'none' }} />
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6,
            border: `0.5px solid ${C.border}`, background: 'transparent', color: C.textMuted, cursor: 'pointer' }}>
            <FileDown size={14} /> Export
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6,
            background: C.text, color: C.bg, cursor: 'pointer', border: 'none', fontWeight: 500 }}>
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      {/* Requirements bar placeholder */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 16px', background: C.bgSurface, borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textDim, flexShrink: 0 }}>
        <span>Cameras: <span style={{ fontWeight: 500, color: C.textMuted }}>{areaDevices.filter((d) => d.category === 'cctv' || ['dome','bullet','turret','ptz','fisheye','multisensor_quad','multisensor_dual'].includes(d.category)).length}</span></span>
        <span>Doors: <span style={{ fontWeight: 500, color: C.textMuted }}>{areaDevices.filter((d) => d.category === 'access_control' || d.category === 'door').length}</span></span>
        <span>Network: <span style={{ fontWeight: 500, color: C.textMuted }}>{areaDevices.filter((d) => d.category === 'network' || ['switch','access_switch','rack','nvr','router','firewall','wireless_ap','bridge','server'].includes(d.category)).length}</span></span>
        <span>Total: <span style={{ fontWeight: 500, color: C.textMuted }}>{areaDevices.length}</span></span>
      </div>

      {/* Area tabs */}
      <AreaTabs
        areas={areas}
        activeAreaId={activeAreaId}
        onAreaChange={(id) => { setActiveAreaId(id); setActiveTool('select'); setActiveIcon('layers') }}
        onAddArea={(name, type) => addArea(name, type)}
        onDeleteArea={deleteArea}
        onRenameArea={(id, name) => updateArea(id, { name })}
      />

      {/* Main canvas area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Icon sidebar */}
        <IconSidebar activeIcon={activeIcon} onIconChange={handleIconChange} />

        {/* Left panel (device list) */}
        {showLeftPanel && (
          <LeftPanel
            devices={areaDevices}
            selectedId={selectedDeviceId}
            onSelectDevice={(id) => { setSelectedDeviceId(id); setActiveTool('select') }}
          />
        )}

        {/* Fabric.js canvas */}
        <CanvasArea
          designId={designId}
          areaId={activeAreaId}
          floorPlan={activeFloorPlan}
          devices={areaDevices}
          showGrid={showGrid}
          activeTool={activeTool}
          selectedDeviceId={selectedDeviceId}
          onZoomChange={() => {}}
          onSelectDevice={setSelectedDeviceId}
          onDeviceMoved={handleDeviceMoved}
          onDeviceRotated={handleDeviceRotated}
          onCanvasClick={handleCanvasClick}
          onDeviceCopy={handleDeviceCopy}
          onDeviceDelete={handleDeviceDelete}
        />

        {/* Right panel */}
        <RightPanel
          device={selectedDeviceId ? devices.find((dev) => dev.id === selectedDeviceId) ?? null : null}
          onClose={() => setSelectedDeviceId(null)}
          onDuplicate={handleDeviceCopy}
          onDelete={handleDeviceDelete}
          onUpdateDevice={(id, updates) => updateDevice(id, updates as Record<string, unknown>)}
        />
      </div>
    </div>
  )
}
