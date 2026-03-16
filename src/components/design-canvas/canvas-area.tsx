'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { C, GRID_SIZE, ZOOM_MIN, ZOOM_MAX, type CanvasTool } from './constants'
import { DEVICE_SVG_STRINGS, CATEGORY_TO_ICON } from './icons'
import type { DesignDevice, DesignFloorPlan } from '@/types/database'

type FabricCanvas = import('fabric').Canvas
type FabricObject = import('fabric').FabricObject

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  deviceId: string | null
}

interface CanvasAreaProps {
  designId: string
  areaId: string | null
  floorPlan: DesignFloorPlan | null
  devices: DesignDevice[]
  showGrid: boolean
  activeTool: CanvasTool
  selectedDeviceId: string | null
  onZoomChange?: (zoom: number) => void
  onSelectDevice: (id: string | null) => void
  onDeviceMoved?: (id: string, x: number, y: number) => void
  onDeviceRotated?: (id: string, angle: number) => void
  onCanvasClick?: (x: number, y: number) => void
  onDeviceCopy?: (id: string) => void
  onDeviceDelete?: (id: string) => void
}

const deviceObjectMap = new Map<string, FabricObject>()

export function CanvasArea({
  designId,
  areaId,
  floorPlan,
  devices,
  showGrid,
  activeTool,
  selectedDeviceId,
  onZoomChange,
  onSelectDevice,
  onDeviceMoved,
  onDeviceRotated,
  onCanvasClick,
  onDeviceCopy,
  onDeviceDelete,
}: CanvasAreaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [fabricReady, setFabricReady] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, deviceId: null,
  })

  // ---- Initialize Fabric.js ----
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return
    let cancelled = false

    async function initFabric() {
      const fabricModule = await import('fabric')
      if (cancelled || !canvasRef.current) return

      const container = containerRef.current
      const width = container?.clientWidth ?? 800
      const height = container?.clientHeight ?? 600

      const canvas = new fabricModule.Canvas(canvasRef.current, {
        width, height,
        backgroundColor: C.bg,
        selection: true,
        preserveObjectStacking: true,
        fireRightClick: true,
        stopContextMenu: true,
      })

      fabricRef.current = canvas
      setFabricReady(true)

      // Zoom (scroll wheel centered on cursor)
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY
        let zoom = canvas.getZoom()
        zoom *= 0.999 ** delta
        zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
        const point = canvas.getScenePoint(opt.e)
        canvas.zoomToPoint(point, zoom)
        setZoomLevel(zoom)
        onZoomChange?.(zoom)
        opt.e.preventDefault()
        opt.e.stopPropagation()
      })

      // Pan (middle mouse or space+drag)
      let isPanning = false
      let lastPanX = 0
      let lastPanY = 0
      let spaceHeld = false

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') { spaceHeld = true; if (container) container.style.cursor = 'grab' }
        if (e.key === 'Escape') setContextMenu({ visible: false, x: 0, y: 0, deviceId: null })
      }
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') { spaceHeld = false; if (container) container.style.cursor = 'default' }
      }
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('keyup', handleKeyUp)

      canvas.on('mouse:down', (opt) => {
        const evt = opt.e as MouseEvent
        setContextMenu({ visible: false, x: 0, y: 0, deviceId: null })

        if (evt.button === 1 || spaceHeld) {
          isPanning = true; lastPanX = evt.clientX; lastPanY = evt.clientY
          canvas.selection = false
          if (container) container.style.cursor = 'grabbing'
          return
        }
        if (evt.button === 2 && opt.target) {
          const deviceId = (opt.target as unknown as Record<string, unknown>).deviceId as string
          if (deviceId) setContextMenu({ visible: true, x: evt.clientX, y: evt.clientY, deviceId })
          return
        }
        if (evt.button === 0 && !opt.target) onSelectDevice(null)
      })

      canvas.on('mouse:move', (opt) => {
        if (!isPanning) return
        const evt = opt.e as MouseEvent
        const vpt = canvas.viewportTransform
        if (vpt) { vpt[4] += evt.clientX - lastPanX; vpt[5] += evt.clientY - lastPanY }
        lastPanX = evt.clientX; lastPanY = evt.clientY
        canvas.requestRenderAll()
      })

      canvas.on('mouse:up', () => {
        if (isPanning) {
          isPanning = false; canvas.selection = true
          if (container) container.style.cursor = spaceHeld ? 'grab' : 'default'
        }
      })

      // Selection bridging
      canvas.on('selection:created', (e) => {
        const obj = e.selected?.[0]
        const did = obj ? (obj as unknown as Record<string, unknown>).deviceId as string : null
        if (did) onSelectDevice(did)
      })
      canvas.on('selection:updated', (e) => {
        const obj = e.selected?.[0]
        const did = obj ? (obj as unknown as Record<string, unknown>).deviceId as string : null
        if (did) onSelectDevice(did)
      })
      canvas.on('selection:cleared', () => onSelectDevice(null))

      // Object modified (move/rotate)
      canvas.on('object:modified', (e) => {
        const obj = e.target
        if (!obj) return
        const did = (obj as unknown as Record<string, unknown>).deviceId as string
        if (!did) return
        if (obj.left !== undefined && obj.top !== undefined) onDeviceMoved?.(did, Math.round(obj.left), Math.round(obj.top))
        if (obj.angle !== undefined) onDeviceRotated?.(did, Math.round(obj.angle))
      })

      ;(canvas as unknown as Record<string, unknown>).__cleanupListeners = () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('keyup', handleKeyUp)
      }
    }

    void initFabric()
    return () => {
      cancelled = true
      if (fabricRef.current) {
        const cleanup = (fabricRef.current as unknown as Record<string, unknown>).__cleanupListeners
        if (typeof cleanup === 'function') cleanup()
        fabricRef.current.dispose()
        fabricRef.current = null
        setFabricReady(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resize
  useEffect(() => {
    if (!fabricRef.current || !containerRef.current) return
    const observer = new ResizeObserver(() => {
      const canvas = fabricRef.current; const container = containerRef.current
      if (!canvas || !container) return
      canvas.setDimensions({ width: container.clientWidth, height: container.clientHeight })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [fabricReady])

  // Canvas click for place-mode
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    const handler = (opt: { e: Event; target?: FabricObject | null }) => {
      if (activeTool !== 'place' || opt.target) return
      const evt = opt.e as MouseEvent
      if (evt.button !== 0) return
      const point = canvas.getScenePoint(evt)
      onCanvasClick?.(Math.round(point.x), Math.round(point.y))
    }
    canvas.on('mouse:down', handler)
    return () => { canvas.off('mouse:down', handler) }
  }, [activeTool, fabricReady, onCanvasClick])

  // Cursor per tool
  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.style.cursor = activeTool === 'place' ? 'crosshair' : 'default'
  }, [activeTool])

  // ---- Sync devices to canvas ----
  useEffect(() => {
    if (!fabricReady || !fabricRef.current) return
    const canvas = fabricRef.current

    // Clear old
    deviceObjectMap.forEach((obj) => canvas.remove(obj))
    deviceObjectMap.clear()
    // Clear old labels
    canvas.getObjects().filter((o) => (o as unknown as Record<string, unknown>).__isLabel === true)
      .forEach((o) => canvas.remove(o))

    async function addDevices() {
      const fabric = await import('fabric')

      for (const device of devices) {
        const iconKey = CATEGORY_TO_ICON[device.category] || 'dome_camera'
        const svgString = DEVICE_SVG_STRINGS[iconKey]
        if (!svgString) continue

        const coloredSvg = svgString.replace(/#000/g, device.color_hex || C.accent)

        try {
          const result = await fabric.loadSVGFromString(coloredSvg)
          const group = fabric.util.groupSVGElements(
            result.objects.filter(Boolean) as FabricObject[],
            result.options,
          )

          group.set({
            left: device.position_x,
            top: device.position_y,
            angle: device.rotation || 0,
            scaleX: 0.5,
            scaleY: 0.5,
            originX: 'center',
            originY: 'center',
            hasControls: true,
            hasBorders: true,
            lockScalingX: true,
            lockScalingY: true,
          })

          ;(group as unknown as Record<string, unknown>).deviceId = device.id

          canvas.add(group)
          deviceObjectMap.set(device.id, group)

          // Label below device
          const labelText = new fabric.FabricText(device.label, {
            left: device.position_x,
            top: device.position_y + 22,
            fontSize: 10,
            fill: C.textMuted,
            fontFamily: 'IBM Plex Sans, sans-serif',
            originX: 'center',
            originY: 'top',
            selectable: false,
            evented: false,
          })
          ;(labelText as unknown as Record<string, unknown>).__isLabel = true
          ;(labelText as unknown as Record<string, unknown>).__forDevice = device.id
          canvas.add(labelText)
        } catch {
          // skip
        }
      }
      canvas.renderAll()
    }

    void addDevices()
  }, [devices, fabricReady])

  // Highlight selected
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    if (selectedDeviceId) {
      const obj = deviceObjectMap.get(selectedDeviceId)
      if (obj) { fabricRef.current.setActiveObject(obj); fabricRef.current.renderAll() }
    }
  }, [selectedDeviceId, fabricReady])

  // Floor plan background
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    if (!floorPlan?.file_url) {
      canvas.backgroundImage = undefined; canvas.requestRenderAll(); return
    }
    async function loadFloorPlan() {
      const fabricModule = await import('fabric')
      const img = await fabricModule.FabricImage.fromURL(floorPlan!.file_url!, { crossOrigin: 'anonymous' })
      img.set({ opacity: floorPlan!.opacity ?? 0.5, selectable: false, evented: false })
      canvas.backgroundImage = img; canvas.requestRenderAll()
    }
    void loadFloorPlan()
  }, [floorPlan, fabricReady])

  // Grid dots
  const drawGrid = useCallback(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current
    canvas.getObjects().filter((o) => (o as unknown as Record<string, unknown>).__isGrid === true)
      .forEach((o) => canvas.remove(o))

    if (!showGrid) { canvas.requestRenderAll(); return }

    import('fabric').then((fabricModule) => {
      const zoom = canvas.getZoom()
      const spacing = GRID_SIZE
      const width = (canvas.width ?? 800) / zoom + spacing * 2
      const height = (canvas.height ?? 600) / zoom + spacing * 2
      for (let x = 0; x < width; x += spacing) {
        for (let y = 0; y < height; y += spacing) {
          const dot = new fabricModule.Circle({ left: x, top: y, radius: 1, fill: 'rgba(255,255,255,0.06)', selectable: false, evented: false })
          ;(dot as unknown as Record<string, unknown>).__isGrid = true
          canvas.add(dot); canvas.sendObjectToBack(dot)
        }
      }
      canvas.requestRenderAll()
    })
  }, [showGrid, fabricReady])

  useEffect(() => { drawGrid() }, [drawGrid])

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: C.bg }}>
      <canvas ref={canvasRef} />

      {/* Context menu */}
      {contextMenu.visible && contextMenu.deviceId && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y,
          background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 6,
          padding: '4px 0', minWidth: 120, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {[
            { label: 'Copy', action: () => onDeviceCopy?.(contextMenu.deviceId!) },
            { label: 'Delete', action: () => onDeviceDelete?.(contextMenu.deviceId!) },
          ].map((item) => (
            <div key={item.label}
              onClick={() => { item.action(); setContextMenu({ visible: false, x: 0, y: 0, deviceId: null }) }}
              style={{ padding: '6px 14px', fontSize: 12, color: item.label === 'Delete' ? C.red : C.text, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.bgHover }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* Zoom controls */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={() => { if (!fabricRef.current) return; const z = Math.max(ZOOM_MIN, zoomLevel - 0.1); fabricRef.current.setZoom(z); setZoomLevel(z) }}
          style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', minWidth: 40, textAlign: 'center' }}>{Math.round(zoomLevel * 100)}%</span>
        <button onClick={() => { if (!fabricRef.current) return; const z = Math.min(ZOOM_MAX, zoomLevel + 0.1); fabricRef.current.setZoom(z); setZoomLevel(z) }}
          style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>

      {areaId && (
        <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, color: C.textDim, fontFamily: 'monospace' }}>
          {designId.slice(0, 8)} / {areaId.slice(0, 8)}
        </div>
      )}
    </div>
  )
}
