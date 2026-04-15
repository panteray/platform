'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  ZoomIn, ZoomOut, Move, MousePointer, Upload, Ruler, Cable as CableIcon,
} from 'lucide-react'
import type { SurveyFloorPlan, SurveyDevice, SurveyCable } from '@/types/database'
import {
  SURVEY_SYSTEM_TYPES, SURVEY_DEVICE_TYPES, SYSTEM_TYPE_COLORS,
  DEFAULT_FOV_ANGLES, generateDeviceLabel, resetLabelCounters,
} from '@/lib/survey-constants'
import { SurveyDevicePanel } from './SurveyDevicePanel'
import { SurveyDeviceIcon } from './survey-device-icons'

interface Props {
  surveyId: string
  floorPlan: SurveyFloorPlan
  devices: SurveyDevice[]
  allDevices: SurveyDevice[]
  onDevicesChanged: (devices: SurveyDevice[]) => void
  readOnly?: boolean
}

type Tool = 'select' | 'pan' | 'calibrate' | 'cable'

export function SurveyCanvas({
  surveyId,
  floorPlan,
  devices,
  allDevices,
  onDevicesChanged,
  readOnly = false,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0 })
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [draggingDevice, setDraggingDevice] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [activeSystem, setActiveSystem] = useState<string>('cctv')
  const [bgImage, setBgImage] = useState<string | null>(floorPlan.image_url)

  // G8: scale calibration — two-point click flow
  const [calibratePoints, setCalibratePoints] = useState<{ x: number; y: number }[]>([])
  const [scalePxPerFt, setScalePxPerFt] = useState<number | null>(floorPlan.scale_px_per_ft ?? null)

  // G8: cable polyline drawing
  const [cables, setCables] = useState<SurveyCable[]>([])
  const [draftCable, setDraftCable] = useState<[number, number][]>([])
  const [cableType, setCableType] = useState<string>('Cat6')
  const [cableColor, setCableColor] = useState<string>('#2563eb')
  const [cableSlack, setCableSlack] = useState<number>(10)

  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null

  // Load cables for this floor plan
  useEffect(() => {
    let cancelled = false
    fetch(`/api/org/surveys/${surveyId}/cables`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: SurveyCable[]) => {
        if (cancelled) return
        setCables((data || []).filter(c => c.floor_plan_id === floorPlan.id))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [surveyId, floorPlan.id])

  // Persist calibration to floor plan
  const saveCalibration = async (pxPerFt: number) => {
    setScalePxPerFt(pxPerFt)
    await fetch(`/api/org/surveys/${surveyId}/floor-plans?fp_id=${floorPlan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scale_px_per_ft: pxPerFt }),
    })
  }

  // Compute length of a polyline in feet using current scale
  const polylineLengthFt = (pts: [number, number][]): number | null => {
    if (!scalePxPerFt || pts.length < 2) return null
    let px = 0
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0]
      const dy = pts[i][1] - pts[i - 1][1]
      px += Math.sqrt(dx * dx + dy * dy)
    }
    const baseFt = px / scalePxPerFt
    return baseFt * (1 + cableSlack / 100)
  }

  // Save a completed cable
  const saveCable = async (polyline: [number, number][]) => {
    if (polyline.length < 2) return
    const lengthFt = polylineLengthFt(polyline)
    const res = await fetch(`/api/org/surveys/${surveyId}/cables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        floor_plan_id: floorPlan.id,
        label: `C-${cables.length + 1}`,
        cable_type: cableType,
        color_hex: cableColor,
        slack_pct: cableSlack,
        polyline,
        length_ft: lengthFt,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setCables((prev) => [...prev, created])
    }
  }

  const deleteCable = async (id: string) => {
    const res = await fetch(`/api/org/surveys/${surveyId}/cables?cable_id=${id}`, { method: 'DELETE' })
    if (res.ok) setCables((prev) => prev.filter(c => c.id !== id))
  }

  // WPtP pair rendering — find matched A/B pairs
  const wptpPairs = (() => {
    const byPair = new Map<string, SurveyDevice[]>()
    for (const d of devices) {
      if (d.wptp_pair_id) {
        const arr = byPair.get(d.wptp_pair_id) || []
        arr.push(d)
        byPair.set(d.wptp_pair_id, arr)
      }
    }
    return Array.from(byPair.values()).filter(pair => pair.length === 2)
  })()

  // Handle floor plan image upload
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Convert to base64 for now — in production would upload to storage
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setBgImage(dataUrl)

      // Update floor plan with image URL
      // For uploaded files, we'd normally upload to storage first
      // This stores as data URL for offline support
    }
    reader.readAsDataURL(file)
  }

  // Zoom
  const handleZoom = (delta: number) => {
    setZoom(prev => Math.max(0.25, Math.min(4, prev + delta)))
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.max(0.25, Math.min(4, prev + delta)))
  }, [])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'pan' || e.button === 1) {
      setIsPanning(true)
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
      return
    }

    if (draggingDevice) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y

      onDevicesChanged(
        allDevices.map(d => d.id === draggingDevice ? { ...d, position_x: x, position_y: y } : d)
      )
    }
  }

  const handleMouseUp = async () => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (draggingDevice) {
      const device = allDevices.find(d => d.id === draggingDevice)
      if (device) {
        await fetch(`/api/org/surveys/${surveyId}/devices?device_id=${device.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position_x: device.position_x, position_y: device.position_y }),
        })
      }
      setDraggingDevice(null)
    }
  }

  // Convert a mouse event to canvas (world) coordinates
  const toCanvasXY = (e: React.MouseEvent): { x: number; y: number } | null => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    }
  }

  // Add device via click on canvas / handle tool-specific clicks
  const handleCanvasClick = async (e: React.MouseEvent) => {
    if (readOnly || isPanning || draggingDevice) return

    // Calibrate tool — collect two points, prompt for feet, save scale
    if (tool === 'calibrate') {
      const pt = toCanvasXY(e)
      if (!pt) return
      const next = [...calibratePoints, pt]
      if (next.length === 2) {
        const dx = next[1].x - next[0].x
        const dy = next[1].y - next[0].y
        const px = Math.sqrt(dx * dx + dy * dy)
        const ftStr = typeof window !== 'undefined' ? window.prompt(`Distance between points is ${px.toFixed(1)}px. Enter real-world length in feet:`) : null
        const ft = ftStr ? parseFloat(ftStr) : NaN
        if (ft > 0) {
          await saveCalibration(px / ft)
        }
        setCalibratePoints([])
        setTool('select')
      } else {
        setCalibratePoints(next)
      }
      return
    }

    // Cable tool — append points to draft polyline
    if (tool === 'cable') {
      const pt = toCanvasXY(e)
      if (!pt) return
      setDraftCable((prev) => [...prev, [pt.x, pt.y]])
      return
    }

    // Default: deselect on empty canvas click
    if (tool !== 'select') return
    const target = e.target as HTMLElement
    if (target === canvasRef.current || target.dataset.canvasBg === 'true') {
      setSelectedDeviceId(null)
    }
  }

  // Finish a draft cable on double-click / Enter
  const finishDraftCable = async () => {
    if (draftCable.length >= 2) {
      await saveCable(draftCable)
    }
    setDraftCable([])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tool === 'cable' && (e.key === 'Enter' || e.key === 'Escape')) {
        if (e.key === 'Enter') finishDraftCable()
        else setDraftCable([])
      }
      if (tool === 'calibrate' && e.key === 'Escape') {
        setCalibratePoints([])
        setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, draftCable, calibratePoints])

  // Add device from palette
  const handleAddDevice = async (systemType: string, deviceType: string) => {
    if (readOnly) return

    resetLabelCounters()
    const label = generateDeviceLabel(
      systemType,
      deviceType,
      allDevices.map(d => d.label)
    )

    const fovAngle = systemType === 'cctv' ? (DEFAULT_FOV_ANGLES[deviceType] || 90) : undefined

    const res = await fetch(`/api/org/surveys/${surveyId}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        floor_plan_id: floorPlan.id,
        system_type: systemType,
        device_type: deviceType,
        label,
        position_x: 300 + Math.random() * 200,
        position_y: 200 + Math.random() * 200,
        fov_angle: fovAngle,
        color_hex: SYSTEM_TYPE_COLORS[systemType] || '#6b7280',
      }),
    })

    if (res.ok) {
      const device = await res.json()
      onDevicesChanged([...allDevices, device])
      setSelectedDeviceId(device.id)
    }
  }

  // Delete device
  const handleDeleteDevice = async (deviceId: string) => {
    const res = await fetch(`/api/org/surveys/${surveyId}/devices?device_id=${deviceId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      onDevicesChanged(allDevices.filter(d => d.id !== deviceId))
      if (selectedDeviceId === deviceId) setSelectedDeviceId(null)
    }
  }

  // Update device property
  const handleUpdateDevice = async (deviceId: string, updates: Partial<SurveyDevice>) => {
    const res = await fetch(`/api/org/surveys/${surveyId}/devices?device_id=${deviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      const updated = await res.json()
      onDevicesChanged(allDevices.map(d => d.id === deviceId ? { ...d, ...updated } : d))
    }
  }

  // Device marker start drag
  const handleDeviceMouseDown = (e: React.MouseEvent, deviceId: string) => {
    if (readOnly) return
    e.stopPropagation()
    const device = devices.find(d => d.id === deviceId)
    if (!device) return

    setSelectedDeviceId(deviceId)

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    dragOffset.current = {
      x: (e.clientX - rect.left - pan.x) / zoom - device.position_x,
      y: (e.clientY - rect.top - pan.y) / zoom - device.position_y,
    }
    setDraggingDevice(deviceId)
  }

  return (
    <div className="flex" style={{ minHeight: 500 }}>
      {/* Device Palette — Left Sidebar */}
      {!readOnly && (
        <div className="w-48 border-r border-border bg-muted/30 overflow-y-auto" style={{ maxHeight: 600 }}>
          <div className="px-2 py-2">
            {/* System Type Tabs */}
            <div className="flex flex-wrap gap-1 mb-2">
              {SURVEY_SYSTEM_TYPES.map((sys) => (
                <button
                  key={sys.value}
                  onClick={() => setActiveSystem(sys.value)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                    activeSystem === sys.value
                      ? 'text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                  style={activeSystem === sys.value ? { backgroundColor: sys.color } : undefined}
                >
                  {sys.label}
                </button>
              ))}
            </div>

            {/* Device Types */}
            <div className="space-y-0.5">
              {(SURVEY_DEVICE_TYPES[activeSystem as keyof typeof SURVEY_DEVICE_TYPES] || []).map((dt) => (
                <button
                  key={dt.value}
                  onClick={() => handleAddDevice(activeSystem, dt.value)}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[11px] text-foreground hover:bg-accent transition-colors"
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: SYSTEM_TYPE_COLORS[activeSystem] }}
                  />
                  {dt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-1 border-b border-border px-2 py-1">
          <button
            onClick={() => setTool('select')}
            className={`rounded p-1 ${tool === 'select' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <MousePointer className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setTool('pan')}
            className={`rounded p-1 ${tool === 'pan' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Move className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setTool('calibrate'); setCalibratePoints([]) }}
            title="Calibrate scale (click two points, enter distance in feet)"
            className={`rounded p-1 ${tool === 'calibrate' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Ruler className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { setTool('cable'); setDraftCable([]) }}
            title="Draw cable run (click to add points, Enter to finish, Esc to cancel)"
            className={`rounded p-1 ${tool === 'cable' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <CableIcon className="h-3.5 w-3.5" />
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button onClick={() => handleZoom(0.2)} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => handleZoom(-0.2)} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          {!bgImage && floorPlan.mode === 'floorplan' && (
            <label className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent">
              <Upload className="h-3 w-3" /> Upload Floor Plan
              <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" />
            </label>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground">
            {scalePxPerFt ? `${scalePxPerFt.toFixed(1)} px/ft` : 'No scale set'} · {devices.length} devices · {cables.length} cables
          </span>
        </div>

        {/* Cable tool config strip */}
        {tool === 'cable' && !readOnly && (
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-1 text-[10px]">
            <span className="text-muted-foreground">Type</span>
            <select
              value={cableType}
              onChange={(e) => setCableType(e.target.value)}
              className="rounded border border-border bg-background px-1 py-0.5"
            >
              {['Cat5e', 'Cat6', 'Cat6a', 'Fiber MM', 'Fiber SM', '18/2', '22/4', 'Coax RG6', 'Speaker 16/2'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span className="text-muted-foreground">Color</span>
            <input
              type="color"
              value={cableColor}
              onChange={(e) => setCableColor(e.target.value)}
              className="h-4 w-6 cursor-pointer"
            />
            <span className="text-muted-foreground">Slack %</span>
            <input
              type="number"
              value={cableSlack}
              onChange={(e) => setCableSlack(Number(e.target.value) || 0)}
              className="w-12 rounded border border-border bg-background px-1 py-0.5"
            />
            <button
              onClick={finishDraftCable}
              disabled={draftCable.length < 2}
              className="rounded bg-primary px-2 py-0.5 text-white disabled:opacity-40"
            >
              Finish ({draftCable.length} pts)
            </button>
            <button
              onClick={() => setDraftCable([])}
              className="rounded border border-border px-2 py-0.5"
            >
              Clear
            </button>
            {!scalePxPerFt && (
              <span className="text-amber-500">⚠ Calibrate scale first for length</span>
            )}
          </div>
        )}

        {/* Canvas Surface */}
        <div
          ref={canvasRef}
          className="relative flex-1 overflow-hidden bg-neutral-950"
          style={{ cursor: tool === 'pan' || isPanning ? 'grab' : 'default', minHeight: 450 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              inset: 0,
            }}
          >
            {/* Background Image */}
            {bgImage && (
              <img
                src={bgImage}
                alt="Floor plan"
                data-canvas-bg="true"
                className="pointer-events-none select-none"
                style={{ maxWidth: 'none' }}
                draggable={false}
              />
            )}

            {/* Grid for grid mode */}
            {floorPlan.mode === 'grid' && (
              <svg width="800" height="600" className="absolute inset-0" data-canvas-bg="true">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            )}

            {/* Cables + WPtP pairs + calibrate preview (G8) */}
            <svg
              className="absolute pointer-events-none"
              style={{ left: 0, top: 0, width: 4000, height: 3000, overflow: 'visible' }}
              data-canvas-bg="true"
            >
              {/* Saved cables */}
              {cables.map((c) => {
                const pts = (c.polyline || []) as [number, number][]
                if (pts.length < 2) return null
                const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
                return (
                  <g key={c.id} style={{ pointerEvents: 'auto' }} onDoubleClick={() => !readOnly && deleteCable(c.id)}>
                    <path d={d} fill="none" stroke={c.color_hex || '#2563eb'} strokeWidth={2.5} />
                    {c.length_ft != null && (
                      <text
                        x={pts[Math.floor(pts.length / 2)][0]}
                        y={pts[Math.floor(pts.length / 2)][1] - 6}
                        fill="#fff"
                        fontSize="10"
                        textAnchor="middle"
                        style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 2 }}
                      >
                        {c.label} · {c.length_ft.toFixed(0)}ft
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Draft cable */}
              {draftCable.length >= 2 && (
                <path
                  d={draftCable.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')}
                  fill="none"
                  stroke={cableColor}
                  strokeWidth={2}
                  strokeDasharray="5,3"
                />
              )}
              {draftCable.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={cableColor} />
              ))}

              {/* Calibrate preview points + line */}
              {calibratePoints.length > 0 && (
                <g>
                  {calibratePoints.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
                  ))}
                  {calibratePoints.length === 2 && (
                    <line
                      x1={calibratePoints[0].x} y1={calibratePoints[0].y}
                      x2={calibratePoints[1].x} y2={calibratePoints[1].y}
                      stroke="#f59e0b" strokeWidth={2} strokeDasharray="4,3"
                    />
                  )}
                </g>
              )}

              {/* WPtP A↔B pair lines (dotted teal) */}
              {wptpPairs.map((pair, i) => (
                <line
                  key={`wptp-${i}`}
                  x1={pair[0].position_x} y1={pair[0].position_y}
                  x2={pair[1].position_x} y2={pair[1].position_y}
                  stroke="#14b8a6"
                  strokeWidth={2}
                  strokeDasharray="6,4"
                  opacity={0.85}
                />
              ))}
            </svg>

            {/* Device Markers */}
            {devices.map((device) => {
              const color = device.color_hex || SYSTEM_TYPE_COLORS[device.system_type] || '#6b7280'
              const isSelected = device.id === selectedDeviceId
              const size = 24

              return (
                <div
                  key={device.id}
                  onMouseDown={(e) => handleDeviceMouseDown(e, device.id)}
                  onClick={(e) => { e.stopPropagation(); setSelectedDeviceId(device.id) }}
                  className="absolute"
                  style={{
                    left: device.position_x - size / 2,
                    top: device.position_y - size / 2,
                    width: size,
                    height: size,
                    cursor: readOnly ? 'pointer' : 'grab',
                    zIndex: isSelected ? 20 : 10,
                  }}
                >
                  {/* FOV Cone for CCTV */}
                  {device.system_type === 'cctv' && device.fov_angle && device.fov_angle < 360 && (
                    <svg
                      className="absolute pointer-events-none"
                      style={{
                        left: size / 2,
                        top: size / 2,
                        width: 200,
                        height: 200,
                        transform: `translate(-100px, -100px)`,
                        opacity: isSelected ? 0.4 : 0.2,
                      }}
                    >
                      <path
                        d={(() => {
                          const cx = 100
                          const cy = 100
                          const r = 80
                          const rot = (device.fov_rotation || 0) - 90
                          const half = (device.fov_angle || 90) / 2
                          const a1 = ((rot - half) * Math.PI) / 180
                          const a2 = ((rot + half) * Math.PI) / 180
                          const x1 = cx + r * Math.cos(a1)
                          const y1 = cy + r * Math.sin(a1)
                          const x2 = cx + r * Math.cos(a2)
                          const y2 = cy + r * Math.sin(a2)
                          const large = device.fov_angle > 180 ? 1 : 0
                          return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`
                        })()}
                        fill={color}
                        stroke={color}
                        strokeWidth={1}
                      />
                    </svg>
                  )}

                  {/* Circular coverage for speakers / vape sensors */}
                  {(device.system_type === 'vape_environmental' || device.system_type === 'av') && (
                    <div
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        left: size / 2 - 40,
                        top: size / 2 - 40,
                        width: 80,
                        height: 80,
                        border: `1.5px solid ${color}`,
                        backgroundColor: `${color}10`,
                        opacity: isSelected ? 0.5 : 0.2,
                      }}
                    />
                  )}

                  {/* SVG device marker (G8) */}
                  <div
                    className="absolute transition-transform"
                    style={{
                      width: size,
                      height: size,
                      transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                      filter: isSelected ? 'drop-shadow(0 0 4px #fff)' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                    }}
                  >
                    <SurveyDeviceIcon
                      systemType={device.system_type}
                      deviceType={device.device_type}
                      color={color}
                      size={size}
                    />
                  </div>

                  {/* Label */}
                  <div
                    className="absolute whitespace-nowrap text-[9px] font-bold pointer-events-none"
                    style={{
                      left: size + 4,
                      top: size / 2 - 6,
                      color: '#fff',
                      textShadow: '0 0 3px rgba(0,0,0,0.8)',
                    }}
                  >
                    {device.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right Panel — Device Properties */}
      {selectedDevice && (
        <SurveyDevicePanel
          device={selectedDevice}
          surveyId={surveyId}
          onUpdate={(updates) => handleUpdateDevice(selectedDevice.id, updates)}
          onDelete={() => handleDeleteDevice(selectedDevice.id)}
          onClose={() => setSelectedDeviceId(null)}
          readOnly={readOnly}
        />
      )}
    </div>
  )
}
