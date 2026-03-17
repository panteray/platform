'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { Upload, Save, FileDown, Grid3X3, Ruler, Eye, EyeOff, ArrowLeft, Plus, BarChart3, X } from 'lucide-react'
import Link from 'next/link'
import { C, type CanvasTool, type IconTabId, type RequirementStatus } from './constants'
import { LABEL_PREFIX } from './icons'
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
const TAB_TO_CATEGORY: Record<string, string> = { camera: 'cctv', door: 'access_control', network: 'network', av: 'av', sensors: 'vape_environmental', other: 'other' }

type DesignView = 'physical' | 'topology' | 'rack' | 'vlan' | 'av' | 'msp'

const VIEWS: { id: DesignView; label: string }[] = [
  { id: 'physical', label: 'Physical' },
  { id: 'topology', label: 'Topology' },
  { id: 'rack', label: 'Rack' },
  { id: 'vlan', label: 'VLAN' },
  { id: 'av', label: 'AV Flow' },
  { id: 'msp', label: 'MSP/CYB' },
]

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
    addZone, updateZone, deleteZone,
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
  const [showRequirements, setShowRequirements] = useState(false)
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [editAreaValue, setEditAreaValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const placingRef = useRef(false)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)

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
    if (placingRef.current) return
    placingRef.current = true
    try {
      const category = TAB_TO_CATEGORY[activeIcon] || 'other'
      const subType = TAB_TO_SUBTYPE[activeIcon] || 'junction_box'
      const prefix = LABEL_PREFIX[subType] || 'DEV'
      await addDevice({ area_id: activeAreaId, category, position_x: x, position_y: y, color_hex: C.accent, label_prefix: prefix, properties: { sub_type: subType } })
    } finally {
      placingRef.current = false
    }
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

  // Zone handlers
  const handleZoneCreated = useCallback(async (zone: { name: string; color: string; x: number; y: number; width: number; height: number }) => {
    await addZone(zone)
  }, [addZone])
  const handleZoneMoved = useCallback(async (id: string, x: number, y: number) => { await updateZone(id, { x, y }) }, [updateZone])
  const handleZoneResized = useCallback(async (id: string, width: number, height: number) => { await updateZone(id, { width, height }) }, [updateZone])
  const handleSelectZone = useCallback((id: string | null) => { setSelectedZoneId(id); if (id) setSelectedDeviceId(null) }, [setSelectedDeviceId])
  const handleSelectDevice = useCallback((id: string | null) => { setSelectedDeviceId(id); if (id) setSelectedZoneId(null) }, [setSelectedDeviceId])
  const handleDeleteZone = useCallback(async (id: string) => { await deleteZone(id); if (selectedZoneId === id) setSelectedZoneId(null) }, [deleteZone, selectedZoneId])

  // Area rename handlers
  function handleAreaDoubleClick(areaId: string, name: string) {
    setEditingAreaId(areaId)
    setEditAreaValue(name)
  }
  function handleAreaRenameBlur(id: string) {
    if (editAreaValue.trim() && editAreaValue.trim() !== areas.find(a => a.id === id)?.name) {
      updateArea(id, { name: editAreaValue.trim() })
    }
    setEditingAreaId(null)
  }

  const selectedDevice = selectedDeviceId ? devices.find((d) => d.id === selectedDeviceId) ?? null : null
  const selectedZone = selectedZoneId ? zones.find((z) => z.id === selectedZoneId) ?? null : null

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: C.bg, color: C.textMuted, fontSize: 13 }}>Loading design...</div>
  if (error || !design) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: C.bg, color: C.red, fontSize: 13 }}>{error ?? 'Design not found'}</div>

  // --- Toolbar button style helper ---
  const toolBtn = (active: boolean, activeColor?: string) => ({
    display: 'flex' as const, alignItems: 'center' as const, gap: 3,
    padding: '3px 8px', fontSize: 10, fontWeight: 500 as const, fontFamily: 'inherit' as const,
    borderRadius: 5, cursor: 'pointer' as const,
    border: `0.5px solid ${active ? (activeColor || C.accent) : C.border}`,
    background: active ? `${activeColor || C.accent}18` : 'transparent',
    color: active ? (activeColor || C.accent) : C.textMuted,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, overflow: 'hidden' }}>
      {/* ========== SINGLE CONSOLIDATED TOP BAR — 40px ========== */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 40, minHeight: 40,
        padding: '0 10px', gap: 6,
        background: C.bgSurface, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
      }}>
        {/* LEFT: Back + Project Name */}
        <Link href="/org/designs" style={{ display: 'flex', alignItems: 'center', color: C.textMuted, textDecoration: 'none' }}>
          <ArrowLeft size={14} />
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: 8, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: C.textDim, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{projectName}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{design.name}</div>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }} />

        {/* CENTER: View Tabs */}
        <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          {VIEWS.map((v) => (
            <button key={v.id} onClick={() => setActiveView(v.id)}
              style={{
                padding: '4px 8px', fontSize: 10, fontWeight: activeView === v.id ? 600 : 400,
                color: activeView === v.id ? C.accent : C.textMuted,
                background: activeView === v.id ? C.accentSubtle : 'transparent',
                border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Separator — only in physical view when areas exist */}
        {activeView === 'physical' && areas.length > 0 && (
          <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }} />
        )}

        {/* AREA TABS — compact inline pills, physical view only */}
        {activeView === 'physical' && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', overflow: 'hidden', flexShrink: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 2, overflow: 'auto', alignItems: 'center' }}>
              {areas.map((area) => {
                const isActive = activeAreaId === area.id
                const isEditing = editingAreaId === area.id
                return (
                  <div key={area.id}
                    onClick={() => { setActiveAreaId(area.id); setActiveTool('select'); setActiveIcon('layers') }}
                    onDoubleClick={() => handleAreaDoubleClick(area.id, area.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '2px 8px', height: 24, fontSize: 10, fontWeight: isActive ? 600 : 400,
                      color: isActive ? C.text : C.textMuted,
                      background: isActive ? C.bgActive : 'transparent',
                      border: isActive ? `1px solid ${C.border}` : '1px solid transparent',
                      borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}>
                    {isEditing ? (
                      <input value={editAreaValue} onChange={(e) => setEditAreaValue(e.target.value)}
                        onBlur={() => handleAreaRenameBlur(area.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAreaRenameBlur(area.id); if (e.key === 'Escape') setEditingAreaId(null) }}
                        autoFocus
                        style={{ background: 'transparent', border: 'none', color: C.text, fontSize: 10, width: 60, outline: 'none', fontFamily: 'inherit' }}
                      />
                    ) : (
                      <span>{area.name}</span>
                    )}
                    {isActive && areas.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); deleteArea(area.id) }}
                        style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', padding: 0, display: 'flex', lineHeight: 1 }}>
                        <X size={10} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <button onClick={() => addArea(`Area ${String.fromCharCode(65 + areas.length)}`, 'FLOOR_PLAN')}
              style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 4, color: C.textDim, cursor: 'pointer', flexShrink: 0 }}>
              <Plus size={11} />
            </button>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Mode indicator */}
        {activeTool !== 'select' && activeTool !== 'place' && (
          <span style={{ fontSize: 9, color: C.green, background: 'rgba(34,197,94,0.12)', padding: '2px 7px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase' }}>{activeTool}</span>
        )}

        {/* RIGHT: Tool buttons */}
        <button onClick={() => setShowFovCones(!showFovCones)} style={toolBtn(showFovCones)}>
          {showFovCones ? <Eye size={12} /> : <EyeOff size={12} />} <span>FOV</span>
        </button>
        <button onClick={() => { setActiveTool('scale'); }} style={toolBtn(activeTool === 'scale', C.yellow)}>
          <Ruler size={12} /> <span>Scale</span>
        </button>
        <button onClick={() => setShowGrid(!showGrid)} style={toolBtn(showGrid)}>
          <Grid3X3 size={12} />
        </button>
        <button onClick={() => fileInputRef.current?.click()} style={toolBtn(false)}>
          <Upload size={12} />
        </button>
        <input ref={fileInputRef} type="file" accept=".svg,.pdf,.png,.jpg,.jpeg" onChange={handleFloorPlanUpload} style={{ display: 'none' }} />
        <button style={toolBtn(false)}>
          <FileDown size={12} />
        </button>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px',
          fontSize: 10, fontWeight: 600, fontFamily: 'inherit', borderRadius: 5,
          background: C.accent, color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          <Save size={12} />
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }} />

        {/* Requirements toggle */}
        <button onClick={() => setShowRequirements(!showRequirements)} style={toolBtn(showRequirements)}
          title="Toggle requirements bar">
          <BarChart3 size={12} />
        </button>
      </div>

      {/* ========== COLLAPSIBLE REQUIREMENTS BAR ========== */}
      {showRequirements && <RequirementsBar requirements={requirements} cableEstimate={cableEstimate} />}

      {/* Floor plan error banner */}
      {floorPlanError && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.3)', fontSize: 11, color: '#ef4444', flexShrink: 0 }}>
          <span>{floorPlanError}</span>
          <button onClick={() => setFloorPlanError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>x</button>
        </div>
      )}

      {/* ========== MAIN CONTENT — CANVAS + OVERLAY PANELS ========== */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeView === 'physical' && (
          <>
            <IconSidebar activeIcon={activeIcon} onIconChange={handleIconChange} />

            {/* Left panel — OVERLAY, does not push canvas */}
            {showLeftPanel && (
              <div style={{
                position: 'absolute', left: 52, top: 0, bottom: 0, zIndex: 10,
                boxShadow: '4px 0 12px rgba(0,0,0,0.3)',
              }}>
                <LeftPanel devices={areaDevices} selectedId={selectedDeviceId}
                  onSelectDevice={(id) => { handleSelectDevice(id); setActiveTool('select') }}
                  zones={zones} selectedZoneId={selectedZoneId}
                  onSelectZone={(id) => { handleSelectZone(id); setActiveTool('select') }}
                  onDeleteZone={handleDeleteZone} />
              </div>
            )}

            <CanvasArea designId={designId} areaId={activeAreaId} floorPlan={activeFloorPlan}
              devices={areaDevices} cables={areaCables} showGrid={showGrid} activeTool={activeTool}
              selectedDeviceId={selectedDeviceId} showFovCones={showFovCones} fovData={fovData}
              scalePxPerFt={scalePxPerFt}
              zones={zones} selectedZoneId={selectedZoneId}
              onZoneCreated={handleZoneCreated} onZoneMoved={handleZoneMoved}
              onZoneResized={handleZoneResized} onSelectZone={handleSelectZone}
              onZoomChange={() => {}} onSelectDevice={handleSelectDevice}
              onDeviceMoved={handleDeviceMoved} onDeviceRotated={handleDeviceRotated}
              onCanvasClick={handleCanvasClick} onDeviceCopy={handleDeviceCopy} onDeviceDelete={handleDeviceDelete}
              onCableCreated={handleCableCreated}
              onToolChange={(t) => setActiveTool(t)}
              onScaleCalibrated={(px) => setScalePxPerFt(px)}
              onFloorPlanError={(msg) => setFloorPlanError(msg)} />

            {/* Right panel — OVERLAY, when device or zone selected */}
            {(selectedDevice || selectedZone) && (
              <div style={{
                position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10,
                boxShadow: '-4px 0 12px rgba(0,0,0,0.3)',
              }}>
                <RightPanel device={selectedDevice}
                  onClose={() => setSelectedDeviceId(null)} onDuplicate={handleDeviceCopy} onDelete={handleDeviceDelete}
                  onUpdateDevice={(id, updates) => updateDevice(id, updates as Record<string, unknown>)}
                  selectedZone={selectedZone}
                  onUpdateZone={(id, updates) => updateZone(id, updates)}
                  onDeleteZone={handleDeleteZone}
                  onCloseZone={() => setSelectedZoneId(null)} />
              </div>
            )}
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
}
