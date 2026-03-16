'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { Upload, Save, FileDown, Grid3X3 } from 'lucide-react'
import { C, type CanvasTool, type IconTabId, type RequirementStatus } from './constants'
import { LABEL_PREFIX } from './icons'
import { AreaTabs } from './area-tabs'
import { CanvasArea } from './canvas-area'
import { IconSidebar } from './icon-sidebar'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { RequirementsBar, type RequirementItem } from './requirements-bar'
import { TopologyView } from './topology-view'
import { RackElevationView } from './rack-elevation-view'
import { VlanPlanner } from './vlan-planner'
import { AvSignalFlow } from './av-signal-flow'
import { MspCanvas } from './msp-canvas'
import { useDesignCanvas } from '@/hooks/useDesignCanvas'
import type { DesignFloorPlan } from '@/types/database'

const TAB_TO_DEFAULT_SUBTYPE: Record<string, string> = {
  camera: 'dome', door: 'door', network: 'switch', av: 'speaker', sensors: 'junction_box', other: 'junction_box',
}
const TAB_TO_CATEGORY: Record<string, string> = {
  camera: 'cctv', door: 'access_control', network: 'network', av: 'av', sensors: 'vape_environmental', other: 'other',
}

// Design view types
type DesignView = 'physical' | 'topology' | 'rack' | 'vlan' | 'av' | 'msp'

interface DesignCanvasProps {
  designId: string
}

export function DesignCanvas({ designId }: DesignCanvasProps) {
  const state = useDesignCanvas(designId)
  const {
    design, areas, devices, cables, mdfIdfs, floorPlans, zones, racks, vlans, topologyNodes, topologyLinks, avoipDevices,
    loading, error, activeAreaId, selectedDeviceId,
    setActiveAreaId, setSelectedDeviceId,
    addArea, updateArea, deleteArea, uploadFloorPlan,
    addDevice, updateDevice, deleteDevice,
    addCable, addInfrastructure,
    addTopologyNode, updateTopologyNode, deleteTopologyNode,
    addTopologyLink, deleteTopologyLink,
    addRack, updateRack, deleteRack,
    addVlan, updateVlan, deleteVlan,
    addAvoipDevice, updateAvoipDevice, deleteAvoipDevice,
  } = state

  const [showGrid, setShowGrid] = useState(true)
  const [activeTool, setActiveTool] = useState<CanvasTool>('select')
  const [activeIcon, setActiveIcon] = useState<IconTabId>('layers')
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [activeView, setActiveView] = useState<DesignView>('physical')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeArea = areas.find((a) => a.id === activeAreaId) ?? null
  const activeFloorPlan: DesignFloorPlan | null = floorPlans.find((fp) => fp.area_id === activeAreaId) ?? null
  const areaDevices = devices.filter((d) => d.area_id === activeAreaId)

  const opp = design?.opportunities as Record<string, unknown> | undefined
  const projectName = opp?.project_name ? `${opp.opp_number} / ${opp.project_name}` : design?.name ?? 'Design Canvas'

  // ---- Requirements calculation ----
  const cameraTypes = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']
  const networkTypes = ['network', 'switch', 'access_switch', 'rack', 'nvr', 'router', 'firewall', 'wireless_ap', 'bridge', 'server']

  const requirements: RequirementItem[] = useMemo(() => {
    const camCount = areaDevices.filter((d) => cameraTypes.includes(d.category)).length
    const doorCount = areaDevices.filter((d) => d.category === 'access_control' || d.category === 'door').length
    const netCount = areaDevices.filter((d) => networkTypes.includes(d.category)).length
    const cableCount = cables.filter((c) => c.area_id === activeAreaId).length
    const totalCableFt = cables.filter((c) => c.area_id === activeAreaId).reduce((sum, c) => sum + (c.total_length_ft ?? 0), 0)

    return [
      { label: 'Cameras', value: camCount, unit: '', status: 'normal' as RequirementStatus },
      { label: 'Doors', value: doorCount, unit: '', status: 'normal' as RequirementStatus },
      { label: 'Network', value: netCount, unit: '', status: 'normal' as RequirementStatus },
      { label: 'Cables', value: cableCount, unit: '', status: 'normal' as RequirementStatus },
      { label: 'Total', value: areaDevices.length, unit: 'devices', status: 'normal' as RequirementStatus },
    ]
  }, [areaDevices, cables, activeAreaId])

  const cableEstimate = useMemo(() => {
    const total = cables.filter((c) => c.area_id === activeAreaId).reduce((sum, c) => sum + (c.total_length_ft ?? 0), 0)
    return total > 0 ? `${total.toLocaleString()} ft` : undefined
  }, [cables, activeAreaId])

  async function handleFloorPlanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeAreaId) return
    await uploadFloorPlan(activeAreaId, file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleIconChange(tabId: IconTabId) {
    setActiveIcon(tabId)
    if (tabId === 'layers') { setShowLeftPanel(true); setActiveTool('select') }
    else { setShowLeftPanel(true); setActiveTool('place') }
  }

  const handleCanvasClick = useCallback(async (x: number, y: number) => {
    if (activeTool !== 'place' || !activeAreaId || activeIcon === 'layers') return
    const subType = TAB_TO_DEFAULT_SUBTYPE[activeIcon] || 'junction_box'
    const prefix = LABEL_PREFIX[subType] || 'DEV'
    await addDevice({ area_id: activeAreaId, category: subType, position_x: x, position_y: y, color_hex: C.accent, label_prefix: prefix, properties: { sub_type: subType } })
  }, [activeTool, activeAreaId, activeIcon, addDevice])

  const handleDeviceMoved = useCallback(async (id: string, x: number, y: number) => {
    await updateDevice(id, { position_x: x, position_y: y })
  }, [updateDevice])

  const handleDeviceRotated = useCallback(async (id: string, angle: number) => {
    await updateDevice(id, { rotation: angle })
  }, [updateDevice])

  const handleDeviceCopy = useCallback(async (id: string) => {
    const src = devices.find((d) => d.id === id)
    if (!src) return
    const prefix = LABEL_PREFIX[src.category] || 'DEV'
    await addDevice({ area_id: src.area_id, category: src.category, position_x: src.position_x + 40, position_y: src.position_y + 40, color_hex: src.color_hex, rotation: src.rotation, label_prefix: prefix, properties: src.properties, device_library_item_id: src.device_library_item_id, mount_type: src.mount_type, status: src.status })
  }, [devices, addDevice])

  const handleDeviceDelete = useCallback(async (id: string) => { await deleteDevice(id) }, [deleteDevice])

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 500, background: C.bg, borderRadius: 8, color: C.textMuted, fontSize: 13 }}>Loading design...</div>
  }
  if (error || !design) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 500, background: C.bg, borderRadius: 8, color: C.red, fontSize: 13 }}>{error ?? 'Design not found'}</div>
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
          {activeTool === 'place' && <span style={{ fontSize: 10, color: C.green, background: 'rgba(34,197,94,0.12)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>PLACE MODE</span>}
          <button onClick={() => setShowGrid(!showGrid)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6, border: `0.5px solid ${showGrid ? C.accent : C.border}`, background: showGrid ? C.accentSubtle : 'transparent', color: showGrid ? C.accent : C.textMuted, cursor: 'pointer' }}><Grid3X3 size={14} /> Grid</button>
          <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.border}`, background: 'transparent', color: C.textMuted, cursor: 'pointer' }}><Upload size={14} /> Floor plan</button>
          <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFloorPlanUpload} style={{ display: 'none' }} />
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.border}`, background: 'transparent', color: C.textMuted, cursor: 'pointer' }}><FileDown size={14} /> Export</button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6, background: C.text, color: C.bg, cursor: 'pointer', border: 'none', fontWeight: 500 }}><Save size={14} /> Save</button>
        </div>
      </div>

      {/* Requirements bar */}
      <RequirementsBar requirements={requirements} cableEstimate={cableEstimate} />

      {/* View switcher */}
      <div style={{ display: 'flex', gap: 0, background: C.bgSurface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {([
          { id: 'physical', label: 'Physical' },
          { id: 'topology', label: 'Topology' },
          { id: 'rack', label: 'Rack Elevation' },
          { id: 'vlan', label: 'VLAN / Subnets' },
          { id: 'av', label: 'AV Signal Flow' },
          { id: 'msp', label: 'MSP / CYB' },
        ] as const).map((v) => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            style={{ padding: '6px 14px', fontSize: 10, fontWeight: activeView === v.id ? 600 : 400, color: activeView === v.id ? C.accent : C.textMuted, background: activeView === v.id ? C.accentSubtle : 'transparent', border: 'none', borderBottom: activeView === v.id ? `2px solid ${C.accent}` : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Area tabs (only for physical view) */}
      {activeView === 'physical' && (
        <AreaTabs areas={areas} activeAreaId={activeAreaId}
          onAreaChange={(id) => { setActiveAreaId(id); setActiveTool('select'); setActiveIcon('layers') }}
          onAddArea={(name, type) => addArea(name, type)} onDeleteArea={deleteArea}
          onRenameArea={(id, name) => updateArea(id, { name })} />
      )}

      {/* Main content — switches by view */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {activeView === 'physical' && (
          <>
            <IconSidebar activeIcon={activeIcon} onIconChange={handleIconChange} />
            {showLeftPanel && <LeftPanel devices={areaDevices} selectedId={selectedDeviceId} onSelectDevice={(id) => { setSelectedDeviceId(id); setActiveTool('select') }} />}
            <CanvasArea designId={designId} areaId={activeAreaId} floorPlan={activeFloorPlan} devices={areaDevices} showGrid={showGrid} activeTool={activeTool} selectedDeviceId={selectedDeviceId} onZoomChange={() => {}} onSelectDevice={setSelectedDeviceId} onDeviceMoved={handleDeviceMoved} onDeviceRotated={handleDeviceRotated} onCanvasClick={handleCanvasClick} onDeviceCopy={handleDeviceCopy} onDeviceDelete={handleDeviceDelete} />
            <RightPanel device={selectedDeviceId ? devices.find((dev) => dev.id === selectedDeviceId) ?? null : null} onClose={() => setSelectedDeviceId(null)} onDuplicate={handleDeviceCopy} onDelete={handleDeviceDelete} onUpdateDevice={(id, updates) => updateDevice(id, updates as Record<string, unknown>)} />
          </>
        )}

        {activeView === 'topology' && (
          <TopologyView designId={designId} nodes={topologyNodes} links={topologyLinks}
            onAddNode={addTopologyNode} onUpdateNode={updateTopologyNode} onDeleteNode={deleteTopologyNode}
            onAddLink={addTopologyLink} onDeleteLink={deleteTopologyLink} />
        )}

        {activeView === 'rack' && (
          <RackElevationView designId={designId} racks={racks} infrastructure={mdfIdfs}
            onAddRack={addRack} onUpdateRack={updateRack} onDeleteRack={deleteRack} />
        )}

        {activeView === 'vlan' && (
          <VlanPlanner designId={designId} vlans={vlans}
            onAddVlan={addVlan} onUpdateVlan={updateVlan} onDeleteVlan={deleteVlan} />
        )}

        {activeView === 'av' && (
          <AvSignalFlow designId={designId} avoipDevices={avoipDevices}
            onAddDevice={addAvoipDevice} onUpdateDevice={updateAvoipDevice} onDeleteDevice={deleteAvoipDevice} />
        )}

        {activeView === 'msp' && (
          <MspCanvas designId={designId} />
        )}
      </div>
    </div>
  )
}
