'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  ZoomIn, ZoomOut, Move, MousePointer, Upload,
} from 'lucide-react'
import type { SurveyFloorPlan, SurveyDevice } from '@/types/database'
import {
  SURVEY_SYSTEM_TYPES, SURVEY_DEVICE_TYPES, SYSTEM_TYPE_COLORS,
  DEFAULT_FOV_ANGLES, generateDeviceLabel, resetLabelCounters,
} from '@/lib/survey-constants'
import { SurveyDevicePanel } from './SurveyDevicePanel'

interface Props {
  surveyId: string
  floorPlan: SurveyFloorPlan
  devices: SurveyDevice[]
  allDevices: SurveyDevice[]
  onDevicesChanged: (devices: SurveyDevice[]) => void
  readOnly?: boolean
}

type Tool = 'select' | 'pan'

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

  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null

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

  // Add device via click on canvas
  const handleCanvasClick = async (e: React.MouseEvent) => {
    if (tool !== 'select' || readOnly || isPanning || draggingDevice) return

    // If clicking on empty space, deselect
    const target = e.target as HTMLElement
    if (target === canvasRef.current || target.dataset.canvasBg === 'true') {
      setSelectedDeviceId(null)
    }
  }

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
            {devices.length} devices on this area
          </span>
        </div>

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

                  {/* Marker Dot */}
                  <div
                    className="absolute rounded-full border-2 shadow-sm transition-transform"
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: color,
                      borderColor: isSelected ? '#fff' : `${color}80`,
                      transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />

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
