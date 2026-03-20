import * as React from 'react'
import { useMemo } from 'react'
import { X, Maximize2 } from 'lucide-react'
import { C } from './constants'
import type { DesignDevice, DesignFloorPlan } from '@/types/database'

interface Camera3dPreviewProps {
  device: DesignDevice
  floorPlan: DesignFloorPlan | null
  scalePxPerFt: number
  onClose: () => void
}

// Implementation Plan Status:
// ### [Component Name]
// - [x] **Camera3dPreview**: New component for pseudo-3D perspective simulation.
// - [x] **DesignCanvas**: Integrated 3D preview state and modal.
// - [x] **CanvasArea**: Added 3D Preview option to device context menu.
// - [x] **Type Safety**: Resolved missing types and implicit any errors across the design canvas module.
export function Camera3dPreview({ device, floorPlan, scalePxPerFt, onClose }: Camera3dPreviewProps) {
  const deviceProps = (device.properties as Record<string, number | string | undefined>) || {}
  const mountH = Number(deviceProps.mount_height) || 10
  const tilt = Number(deviceProps.tilt_angle) || 15
  const rotation = device.rotation || 0
  
  // Simulation params
  const perspective = 800
  const rotateX = 60 + (tilt / 3) // Adjust floor tilt based on camera tilt
  
  // Calculate crop and position
  const sceneWidth = 600
  const sceneHeight = 400
  
  const floorPlanStyle = useMemo(() => {
    if (!floorPlan?.file_url) return {}
    
    // We want to center the "camera" in the view
    // The camera is at device.position_x, device.position_y
    // We need to shift the background so that point is at the "bottom center" of the tilted plane
    const offsetX = (sceneWidth / 2) - device.position_x
    const offsetY = (sceneHeight * 0.8) - device.position_y
    
    return {
      backgroundImage: `url(${floorPlan.file_url})`,
      backgroundSize: 'auto',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: `${offsetX}px ${offsetY}px`,
      width: '4000px', // Large enough to cover the view
      height: '4000px',
      position: 'absolute' as const,
      left: '50%',
      top: '50%',
      transform: `translate(-50%, -50%) rotateX(${rotateX}deg) rotateZ(${-rotation}deg)`,
      transformOrigin: 'center center',
      opacity: 0.8,
      transition: 'all 0.5s ease-out',
    }
  }, [floorPlan, device, rotation, rotateX])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, 
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
      padding: 40,
    }}>
      <div style={{
        width: '100%', maxWidth: 900, height: '100%', maxHeight: 650,
        background: C.bgPanel, borderRadius: 12, border: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: device.color_hex || C.accent }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              3D View: {device.label}
            </span>
            <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', background: C.bgActive, padding: '2px 6px', borderRadius: 4 }}>
              H: {mountH}ft | Tilt: {tilt}°
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Viewport content */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', perspective: `${perspective}px`, background: '#000' }}>
          {/* The Floor Plan "Ground" */}
          {floorPlan ? (
            <div style={floorPlanStyle} />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontSize: 12 }}>
              Upload a floor plan to enable 3D preview
            </div>
          )}

          {/* Vignette Overlay */}
          <div style={{ 
            position: 'absolute', inset: 0, 
            background: 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.5) 100%)',
            pointerEvents: 'none',
          }} />

          {/* Scanline Effect */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 2px)',
            pointerEvents: 'none',
            opacity: 0.3,
          }} />

          {/* Camera UI Overlay (Reticle, etc.) */}
          <div style={{ 
            position: 'absolute', inset: 0, 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
             {/* Simple crosshair */}
             <div style={{ width: 40, height: 40, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%' }} />
             <div style={{ position: 'absolute', width: 2, height: 20, background: 'rgba(255,255,255,0.3)' }} />
             <div style={{ position: 'absolute', width: 20, height: 2, background: 'rgba(255,255,255,0.3)' }} />
          </div>

          {/* Bottom telemetry overlay */}
          <div style={{ 
            position: 'absolute', bottom: 20, left: 20, right: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            pointerEvents: 'none',
          }}>
            <div style={{ 
              background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10, color: '#0f0', textShadow: '0 0 4px #0f0',
            }}>
              <div>LATENCY: 42ms</div>
              <div>BITRATE: 4.2 Mbps</div>
              <div>FPS: 30.0</div>
            </div>

            <div style={{ 
              background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10, color: '#0f0', textShadow: '0 0 4px #0f0',
              textAlign: 'right',
            }}>
              <div>REC ●</div>
              <div>{new Date().toLocaleTimeString()}</div>
              <div>CAM_01_FEED</div>
            </div>
          </div>
        </div>

        {/* Controls footer */}
        <div style={{ padding: '10px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 12, background: 'rgba(255,255,255,0.01)' }}>
           <div style={{ fontSize: 11, color: C.textDim, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Maximize2 size={12} />
              Digital Zoom: 1.0x
           </div>
           <div style={{ flex: 1 }} />
           <button onClick={onClose} style={{ 
             padding: '6px 16px', borderRadius: 6, background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer'
           }}>
             Close Preview
           </button>
        </div>
      </div>
    </div>
  )
}
