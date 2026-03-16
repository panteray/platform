'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { C, GRID_SIZE, ZOOM_MIN, ZOOM_MAX } from './constants'
import type { DesignFloorPlan } from '@/types/database'

interface CanvasAreaProps {
  designId: string
  areaId: string | null
  floorPlan: DesignFloorPlan | null
  showGrid: boolean
  onZoomChange?: (zoom: number) => void
}

export function CanvasArea({
  designId,
  areaId,
  floorPlan,
  showGrid,
  onZoomChange,
}: CanvasAreaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<import('fabric').Canvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [fabricReady, setFabricReady] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)

  // Initialize Fabric.js canvas
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
        width,
        height,
        backgroundColor: C.bg,
        selection: true,
        preserveObjectStacking: true,
      })

      fabricRef.current = canvas
      setFabricReady(true)

      // Zoom with scroll wheel (centered on cursor)
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

      // Pan with middle mouse button or space+drag
      let isPanning = false
      let lastPanX = 0
      let lastPanY = 0
      let spaceHeld = false

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          spaceHeld = true
          if (container) container.style.cursor = 'grab'
        }
      }
      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          spaceHeld = false
          if (container) container.style.cursor = 'default'
        }
      }
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('keyup', handleKeyUp)

      canvas.on('mouse:down', (opt) => {
        const evt = opt.e as MouseEvent
        if (evt.button === 1 || spaceHeld) {
          isPanning = true
          lastPanX = evt.clientX
          lastPanY = evt.clientY
          canvas.selection = false
          if (container) container.style.cursor = 'grabbing'
        }
      })

      canvas.on('mouse:move', (opt) => {
        if (!isPanning) return
        const evt = opt.e as MouseEvent
        const vpt = canvas.viewportTransform
        if (vpt) {
          vpt[4] += evt.clientX - lastPanX
          vpt[5] += evt.clientY - lastPanY
        }
        lastPanX = evt.clientX
        lastPanY = evt.clientY
        canvas.requestRenderAll()
      })

      canvas.on('mouse:up', () => {
        if (isPanning) {
          isPanning = false
          canvas.selection = true
          if (container) container.style.cursor = spaceHeld ? 'grab' : 'default'
        }
      })

      // Cleanup on unmount stored for later
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
  }, [onZoomChange])

  // Resize canvas when container resizes
  useEffect(() => {
    if (!fabricRef.current || !containerRef.current) return

    const observer = new ResizeObserver(() => {
      const canvas = fabricRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      canvas.setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      })
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [fabricReady])

  // Load floor plan as background image
  useEffect(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current

    if (!floorPlan?.file_url) {
      canvas.backgroundImage = undefined
      canvas.requestRenderAll()
      return
    }

    async function loadFloorPlan() {
      const fabricModule = await import('fabric')
      const img = await fabricModule.FabricImage.fromURL(floorPlan!.file_url!, {
        crossOrigin: 'anonymous',
      })

      img.set({
        opacity: floorPlan!.opacity ?? 0.5,
        selectable: false,
        evented: false,
      })

      canvas.backgroundImage = img
      canvas.requestRenderAll()
    }

    void loadFloorPlan()
  }, [floorPlan, fabricReady])

  // Draw grid overlay
  const drawGrid = useCallback(() => {
    if (!fabricRef.current || !fabricReady) return
    const canvas = fabricRef.current

    // Remove old grid objects
    const gridObjects = canvas.getObjects().filter(
      (o) => (o as unknown as Record<string, unknown>).__isGrid === true
    )
    gridObjects.forEach((o) => canvas.remove(o))

    if (!showGrid) {
      canvas.requestRenderAll()
      return
    }

    // Draw dot grid
    import('fabric').then((fabricModule) => {
      const zoom = canvas.getZoom()
      const spacing = GRID_SIZE
      const width = (canvas.width ?? 800) / zoom + spacing * 2
      const height = (canvas.height ?? 600) / zoom + spacing * 2

      for (let x = 0; x < width; x += spacing) {
        for (let y = 0; y < height; y += spacing) {
          const dot = new fabricModule.Circle({
            left: x,
            top: y,
            radius: 1,
            fill: 'rgba(255,255,255,0.06)',
            selectable: false,
            evented: false,
          })
          ;(dot as unknown as Record<string, unknown>).__isGrid = true
          canvas.add(dot)
          canvas.sendObjectToBack(dot)
        }
      }
      canvas.requestRenderAll()
    })
  }, [showGrid, fabricReady])

  useEffect(() => {
    drawGrid()
  }, [drawGrid])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: C.bg,
      }}
    >
      <canvas ref={canvasRef} />

      {/* Zoom indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          display: 'flex',
          gap: 4,
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => {
            if (!fabricRef.current) return
            const newZoom = Math.max(ZOOM_MIN, zoomLevel - 0.1)
            fabricRef.current.setZoom(newZoom)
            setZoomLevel(newZoom)
          }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '0.5px solid rgba(255,255,255,0.15)',
            background: 'rgba(0,0,0,0.4)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          -
        </button>
        <span
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.5)',
            minWidth: 40,
            textAlign: 'center',
          }}
        >
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={() => {
            if (!fabricRef.current) return
            const newZoom = Math.min(ZOOM_MAX, zoomLevel + 0.1)
            fabricRef.current.setZoom(newZoom)
            setZoomLevel(newZoom)
          }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '0.5px solid rgba(255,255,255,0.15)',
            background: 'rgba(0,0,0,0.4)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>

      {/* Area ID indicator (dev) */}
      {areaId && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            fontSize: 9,
            color: C.textDim,
            fontFamily: 'monospace',
          }}
        >
          {designId.slice(0, 8)} / {areaId.slice(0, 8)}
        </div>
      )}
    </div>
  )
}
