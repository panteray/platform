'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { Upload, Save, FileDown, Grid3X3, Ruler, Eye, EyeOff } from 'lucide-react'
import { C, type CanvasTool, type IconTabId, type RequirementStatus } from './constants'
import { LABEL_PREFIX } from './icons'
import { AreaTabs } from './area-tabs'
import { CanvasArea, type DeviceFovData } from './canvas-area'
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
import { calculateFovDori, getFovConeTiers } from '@/lib/calculators'
import type { DesignFloorPlan } from '@/types/database'

const TAB_TO_SUBTYPE: Record<string, string> = { camera: 'dome', door: 'door', network: 'switch', av: 'speaker', sensors: 'junction_box', other: 'junction_box' }

type DesignView = 'physical' | 'topology' | 'rack' | 'vlan' | 'av' | 'msp'

interface DesignCanvasProps { designId: string }

export function DesignCanvas({ designId }: DesignCanvasProps) {
  const state = useDesignCanvas(designId)
  const {
    design, areas, devices, cables, mdfIdfs, floorPlans, zones, racks, vlans, topologyNodes, topologyLinks, avoipDevices,
    loading, error, activeAreaId, selectedDeviceId,
    setActiveAreaId, setSelectedDeviceId,
    addArea, updateArea, deleteArea, uploadFloorPlan,
    addDevice, updateDevice, deleteDevice,
    addCable,
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
  const [showFovCones, setShowFovCones] = useState(false)
  const [scalePxPerFt, setScalePxPerFt] = useState(10)
  const [floorPlanError, setFloorPlanError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeArea = areas.find((a) => a.id === activeAreaId) ?? null
  const activeFloorPlan: DesignFloorPlan | null = floorPlans.find((fp) => fp.area_id === activeAreaId) ?? null
  const areaDevices = devices.filter((d) => d.area_id === activeAreaId)
  const areaCables = cables.filter((c) => c.area_id === activeAreaId)

  const opp = design?.opportunities as Record<string, unknown> | undefined
  const projectName = opp?.project_name ? `${opp.opp_number} / ${opp.project_name}` : design?.name ?? 'Design Canvas'

  // ---- FOV data from calculator engine ----
  const fovData = useMemo(() => {
    const map = new Map<string, DeviceFovData>()
    const cameraTypes = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']
    for (const d of areaDevices) {
      if (!cameraTypes.includes(d.category)) continue
      const props = (d.properties ?? {}) as Record<string, unknown>
      const focalLength = Number(props.focal_length) || 0
      const sensorW = Number(props.sensor_width) || 0
      const sensorH = Number(props.sensor_height) || 0
      const resW = Number(props.resolution_w) || 0
      const resH = Number(props.resolution_h) || 0
      const mountHeight = Number(props.mount_height) || 10
      const targetDist = Number(props.target_distance) || 30
      const tiltAngle = Number(props.tilt_angle) || 15

      if (!focalLength || !sensorW || !resW) {
        // Fallback: show a generic cone if no lens data
        map.set(d.id, {
          hFov: 90, rotation: d.rotation || 0,
          tiers: [
            { distanceFt: targetDist, color: C.green, opacity: 0.12 },
            { distanceFt: targetDist * 0.6, color: C.yellow, opacity: 0.15 },
            { distanceFt: targetDist * 0.3, color: C.red, opacity: 0.2 },
          ],
        })
        continue
      }

      try {
        const input = { resolutionW: resW, resolutionH: resH || resW * 0.5625, sensorW, sensorH: sensorH || sensorW * 0.5625, focalLength, mountHeight, targetDistance: targetDist, tiltAngle }
        const result = calculateFovDori(input)
        const tiers = getFovConeTiers(input)
        map.set(d.id, {
          hFov: result.hFov,
          rotation: d.rotation || 0,
          tiers: tiers.map((t) => ({ distanceFt: t.distanceFt, color: t.color, opacity: t.opacity })),
        })
      } catch {
        // Engine didn't run — skip
      }
    }
    return map
  }, [areaDevices])

  // ---- Requirements ----
  const cameraTypes = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']
  const networkTypes = ['network', 'switch', 'access_switch', 'rack', 'nvr', 'router', 'firewall', 'wireless_ap', 'bridge', 'server']
  const requirements: RequirementItem[] = useMemo(() => {
    const camCount = areaDevices.filter((d) => cameraTypes.includes(d.category)).length
    const doorCount = areaDevices.filter((d) => d.category === 'access_control' || d.category === 'door').length
    const netCount = areaDevices.filter((d) => networkTypes.includes(d.category)).length
    const cableCount = areaCables.length
    const totalCableFt = areaCables.reduce((sum, c) => sum + (c.total_length_ft ?? 0), 0)
    return [
      { label: 'Cameras', value: camCount, unit: '', status: 'normal' as RequirementStatus },
      { label: 'Doors', value: doorCount, unit: '', status: 'normal' as RequirementStatus },
      { label: 'Network', value: netCount, unit: '', status: 'normal' as RequirementStatus },
      { label: 'Cables', value: cableCount, unit: '', status: 'normal' as RequirementStatus },
      { label: 'Total', value: areaDevices.length, unit: 'devices', status: 'normal' as RequirementStatus },
    ]
  }, [areaDevices, areaCables])
  const cableEstimate = useMemo(() => {
    const total = areaCables.reduce((sum, c) => sum + (c.total_length_ft ?? 0), 0)
    return total > 0 ? `${total.toLocaleString()} ft` : undefined
  }, [areaCables])

  // ---- Handlers ----
  async function handleFloorPlanUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !activeAreaId) return
    setFloorPlanError(null)
    const result = await uploadFloorPlan(activeAreaId, file)
    if (!result) setFloorPlanError('Upload failed — check file type and try again.')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  function handleIconChange(tabId: IconTabId) {
    setActiveIcon(tabId)
    if (tabId === 'layers') { setShowLeftPanel(true); setActiveTool('select') }
    else { setShowLeftPanel(true); setActiveTool('place') }
  }
  const handleCanvasClick = useCallback(async (x: number, y: number) => {
    if (activeTool !== 'place' || !activeAreaId || activeIcon === 'layers') return
    const subType = TAB_TO_SUBTYPE[activeIcon] || 'junction_box'
    const prefix = LABEL_PREFIX[subType] || 'DEV'
    await addDevice({ area_id: activeAreaId, category: subType, position_x: x, position_y: y, color_hex: C.accent, label_prefix: prefix, properties: { sub_type: subType } })
  }, [activeTool, activeAreaId, activeIcon, addDevice])
  const handleDeviceMoved = useCallback(async (id: string, x: number, y: number) => { await updateDevice(id, { position_x: x, position_y: y }) }, [updateDevice])
  const handleDeviceRotated = useCallback(async (id: string, angle: number) => { await updateDevice(id, { rotation: angle }) }, [updateDevice])
  const handleDeviceCopy = useCallback(async (id: string) => {
    const src = devices.find((d) => d.id === id); if (!src) return
    const prefix = LABEL_PREFIX[src.category] || 'DEV'
    await addDevice({ area_id: src.area_id, category: src.category, position_x: src.position_x + 40, position_y: src.position_y + 40, color_hex: src.color_hex, rotation: src.rotation, label_prefix: prefix, properties: src.properties, device_library_item_id: src.device_library_item_id, mount_type: src.mount_type, status: src.status })
  }, [devices, addDevice])
  const handleDeviceDelete = useCallback(async (id: string) => { await deleteDevice(id) }, [deleteDevice])
  const handleCableCreated = useCallback(async (cable: { from_device_id: string; to_device_id: string | null; waypoints: Array<{ x: number; y: number }>; length_ft: number }) => {
    await addCable({ area_id: activeAreaId, from_device_id: cable.from_device_id, to_device_id: cable.to_device_id, waypoints: cable.waypoints, length_ft: cable.length_ft, cable_type: 'cat6' })
  }, [addCable, activeAreaId])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 500, background: C.bg, borderRadius: 8, color: C.textMuted, fontSize: 13 }}>Loading design...</div>
  if (error || !design) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 500, background: C.bg, borderRadius: 8, color: C.red, fontSize: 13 }}>{error ?? 'Design not found'}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', background: C.bg, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: C.bgSurface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{projectName}</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{design.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {activeTool !== 'select' && activeTool !== 'place' && (
            <span style={{ fontSize: 10, color: C.green, background: 'rgba(34,197,94,0.12)', padding: '2px 8px', borderRadius: 4, fontWeight: 600, textTransform: 'uppercase' }}>{activeTool} MODE</span>
          )}
          <button onClick={() => setShowFovCones(!showFovCones)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6, border: `0.5px solid ${showFovCones ? C.accent : C.border}`, background: showFovCones ? C.accentSubtle : 'transparent', color: showFovCones ? C.accent : C.textMuted, cursor: 'pointer' }}>
            {showFovCones ? <Eye size={14} /> : <EyeOff size={14} />} FOV
          </button>
          <button onClick={() => { setActiveTool('scale'); onToolChangeLocal('scale') }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6, border: `0.5px solid ${activeTool === 'scale' ? C.yellow : C.border}`, background: activeTool === 'scale' ? 'rgba(234,179,8,0.1)' : 'transparent', color: activeTool === 'scale' ? C.yellow : C.textMuted, cursor: 'pointer' }}>
            <Ruler size={14} /> Scale
          </button>
          <button onClick={() => setShowGrid(!showGrid)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6, border: `0.5px solid ${showGrid ? C.accent : C.border}`, background: showGrid ? C.accentSubtle : 'transparent', color: showGrid ? C.accent : C.textMuted, cursor: 'pointer' }}><Grid3X3 size={14} /> Grid</button>
          <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.border}`, background: 'transparent', color: C.textMuted, cursor: 'pointer' }}><Upload size={14} /> Floor plan</button>
          <input ref={fileInputRef} type="file" accept=".svg,.pdf,.png,.jpg,.jpeg" onChange={handleFloorPlanUpload} style={{ display: 'none' }} />
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6, border: `0.5px solid ${C.border}`, background: 'transparent', color: C.textMuted, cursor: 'pointer' }}><FileDown size={14} /> Export</button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, borderRadius: 6, background: C.text, color: C.bg, cursor: 'pointer', border: 'none', fontWeight: 500 }}><Save size={14} /> Save</button>
        </div>
      </div>

      <RequirementsBar requirements={requirements} cableEstimate={cableEstimate} />

      {floorPlanError && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', background: 'rgba(239,68,68,0.1)', borderBottom: `1px solid rgba(239,68,68,0.3)`, fontSize: 12, color: '#ef4444', flexShrink: 0 }}>
          <span>{floorPlanError}</span>
          <button onClick={() => setFloorPlanError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>x</button>
        </div>
      )}

      {/* View switcher */}
      <div style={{ display: 'flex', gap: 0, background: C.bgSurface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {([
          { id: 'physical', label: 'Physical' }, { id: 'topology', label: 'Topology' },
          { id: 'rack', label: 'Rack Elevation' }, { id: 'vlan', label: 'VLAN / Subnets' },
          { id: 'av', label: 'AV Signal Flow' }, { id: 'msp', label: 'MSP / CYB' },
        ] as const).map((v) => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            style={{ padding: '6px 14px', fontSize: 10, fontWeight: activeView === v.id ? 600 : 400, color: activeView === v.id ? C.accent : C.textMuted, background: activeView === v.id ? C.accentSubtle : 'transparent', border: 'none', borderBottom: activeView === v.id ? `2px solid ${C.accent}` : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
            {v.label}
          </button>
        ))}
      </div>

      {activeView === 'physical' && (
        <AreaTabs areas={areas} activeAreaId={activeAreaId}
          onAreaChange={(id) => { setActiveAreaId(id); setActiveTool('select'); setActiveIcon('layers') }}
          onAddArea={(name, type) => addArea(name, type)} onDeleteArea={deleteArea}
          onRenameArea={(id, name) => updateArea(id, { name })} />
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {activeView === 'physical' && (
          <>
            <IconSidebar activeIcon={activeIcon} onIconChange={handleIconChange} />
            {showLeftPanel && <LeftPanel devices={areaDevices} selectedId={selectedDeviceId} onSelectDevice={(id) => { setSelectedDeviceId(id); setActiveTool('select') }} />}
            <CanvasArea designId={designId} areaId={activeAreaId} floorPlan={activeFloorPlan}
              devices={areaDevices} cables={areaCables} showGrid={showGrid} activeTool={activeTool}
              selectedDeviceId={selectedDeviceId} showFovCones={showFovCones} fovData={fovData}
              scalePxPerFt={scalePxPerFt}
              onZoomChange={() => {}} onSelectDevice={setSelectedDeviceId}
              onDeviceMoved={handleDeviceMoved} onDeviceRotated={handleDeviceRotated}
              onCanvasClick={handleCanvasClick} onDeviceCopy={handleDeviceCopy} onDeviceDelete={handleDeviceDelete}
              onCableCreated={handleCableCreated}
              onToolChange={(t) => setActiveTool(t)}
              onScaleCalibrated={(px) => setScalePxPerFt(px)}
              onFloorPlanError={(msg) => setFloorPlanError(msg)} />
            <RightPanel device={selectedDeviceId ? devices.find((dev) => dev.id === selectedDeviceId) ?? null : null}
              onClose={() => setSelectedDeviceId(null)} onDuplicate={handleDeviceCopy} onDelete={handleDeviceDelete}
              onUpdateDevice={(id, updates) => updateDevice(id, updates as Record<string, unknown>)} />
          </>
        )}
        {activeView === 'topology' && <TopologyView designId={designId} nodes={topologyNodes} links={topologyLinks} onAddNode={addTopologyNode} onUpdateNode={updateTopologyNode} onDeleteNode={deleteTopologyNode} onAddLink={addTopologyLink} onDeleteLink={deleteTopologyLink} />}
        {activeView === 'rack' && <RackElevationView designId={designId} racks={racks} infrastructure={mdfIdfs} onAddRack={addRack} onUpdateRack={updateRack} onDeleteRack={deleteRack} />}
        {activeView === 'vlan' && <VlanPlanner designId={designId} vlans={vlans} onAddVlan={addVlan} onUpdateVlan={updateVlan} onDeleteVlan={deleteVlan} />}
        {activeView === 'av' && <AvSignalFlow designId={designId} avoipDevices={avoipDevices} onAddDevice={addAvoipDevice} onUpdateDevice={updateAvoipDevice} onDeleteDevice={deleteAvoipDevice} />}
        {activeView === 'msp' && <MspCanvas designId={designId} />}
      </div>
    </div>
  )

  function onToolChangeLocal(t: CanvasTool) { setActiveTool(t) }
}
