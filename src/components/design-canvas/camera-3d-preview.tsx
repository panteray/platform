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
  const deviceProps = (device.properties as Record<string, any>) || {}
  const mountH = Number(deviceProps.mount_height) || 10
  const tilt = Number(deviceProps.tilt_angle) || 15
  const sensorAngles = (deviceProps.sensor_angles as number[]) || []
  
  const [activeSensorIdx, setActiveSensorIdx] = React.useState(0)
  const [zoom, setZoom] = React.useState(1.0)
  
  const rotation = sensorAngles.length > activeSensorIdx 
    ? sensorAngles[activeSensorIdx] 
    : (device.rotation || 0)
  
  // Simulation params
  const perspective = 1000
  const rotateX = 65 + (tilt / 4) // Adjust floor tilt based on camera tilt
  
  // Viewport dimensions
  const sceneWidth = 800
  const sceneHeight = 500
  
  const floorPlanStyle = useMemo(() => {
    if (!floorPlan?.file_url) return {}
    
    // We want to center the "camera" in the view
    const offsetX = (sceneWidth / 2) - device.position_x
    const offsetY = (sceneHeight * 0.85) - device.position_y
    
    return {
      backgroundImage: `url(${floorPlan.file_url})`,
      backgroundSize: 'auto',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: `${offsetX}px ${offsetY}px`,
      width: '6000px', // Even larger plane for more immersion
      height: '6000px',
      position: 'absolute' as const,
      left: '50%',
      top: '50%',
      // Apply translation, then rotation for the 3D floor effect, then digital zoom
      transform: `translate(-50%, -50%) rotateX(${rotateX}deg) rotateZ(${-rotation}deg) scale(${zoom})`,
      transformOrigin: '50% 50%',
      opacity: 0.9,
      transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease',
    }
  }, [floorPlan, device, rotation, rotateX, zoom])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, 
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
      padding: 40,
    }}>
      <div style={{
        width: '100%', maxWidth: 1000, height: '100%', maxHeight: 750,
        background: '#09090b', borderRadius: 16, border: `1px solid rgba(255,255,255,0.1)`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 25px 70px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: `1px solid rgba(255,255,255,0.1)`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: device.color_hex || '#3b82f6', boxShadow: `0 0 10px ${device.color_hex || '#3b82f6'}` }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
              3D VIEW: {device.label}
            </span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
              <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
                H: {mountH}ft
              </span>
              <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
                TILT: {tilt}°
              </span>
              <span style={{ fontSize: 11, color: '#a1a1aa', fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
                ROT: {Math.round(rotation)}°
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: 4, transition: 'color 0.2s' }}>
            <X size={24} />
          </button>
        </div>

        {/* Multi-sensor Tabs if applicable */}
        {sensorAngles.length > 1 && (
          <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.3)', padding: '4px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {sensorAngles.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSensorIdx(idx)}
                style={{
                  padding: '6px 16px', borderRadius: '4px 4px 0 0', fontSize: 11, fontWeight: 600,
                  background: activeSensorIdx === idx ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: activeSensorIdx === idx ? '#3b82f6' : '#71717a',
                  border: 'none', borderBottom: activeSensorIdx === idx ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                SENSOR {idx + 1}
              </button>
            ))}
          </div>
        )}

        {/* Viewport content */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', perspective: `${perspective}px`, background: '#000' }}>
          {/* The Floor Plan "Ground" */}
          {floorPlan ? (
            <div style={floorPlanStyle} />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52525b', fontSize: 14 }}>
              Upload floor plan for immersive simulation
            </div>
          )}

          {/* Vignette Overlay */}
          <div style={{ 
            position: 'absolute', inset: 0, 
            background: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.7) 100%)',
            pointerEvents: 'none',
          }} />

          {/* HUD Overlay */}
          <div style={{ position: 'absolute', top: 20, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
             <div style={{ color: '#0f0', fontFamily: 'monospace', fontSize: 12, textShadow: '0 0 5px #0f0' }}>
               LIVE FEED - CAM_{String(activeSensorIdx + 1).padStart(2, '0')}
             </div>
             <div style={{ color: '#0f0', fontFamily: 'monospace', fontSize: 12, textShadow: '0 0 5px #0f0' }}>
               ISO 400 | f/1.8 | 1/60s
             </div>
          </div>

          <div style={{ 
            position: 'absolute', inset: 0, 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
             <div style={{ width: 100, height: 100, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%' }} />
             <div style={{ position: 'absolute', width: 1, height: 30, background: 'rgba(255,255,255,0.2)' }} />
             <div style={{ position: 'absolute', width: 30, height: 1, background: 'rgba(255,255,255,0.2)' }} />
             
             {/* Corner brackets */}
             <div style={{ position: 'absolute', top: '25%', left: '25%', width: 20, height: 20, borderTop: '2px solid rgba(255,255,255,0.2)', borderLeft: '2px solid rgba(255,255,255,0.2)' }} />
             <div style={{ position: 'absolute', top: '25%', right: '25%', width: 20, height: 20, borderTop: '2px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)' }} />
             <div style={{ position: 'absolute', bottom: '25%', left: '25%', width: 20, height: 20, borderBottom: '2px solid rgba(255,255,255,0.2)', borderLeft: '2px solid rgba(255,255,255,0.2)' }} />
             <div style={{ position: 'absolute', bottom: '25%', right: '25%', width: 20, height: 20, borderBottom: '2px solid rgba(255,255,255,0.2)', borderRight: '2px solid rgba(255,255,255,0.2)' }} />
          </div>

          {/* Bottom telemetry overlay */}
          <div style={{ 
            position: 'absolute', bottom: 24, left: 24, right: 24,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            pointerEvents: 'none',
          }}>
            <div style={{ 
              background: 'rgba(0,0,0,0.7)', padding: '12px 16px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
              fontSize: 11, color: '#0f0', textShadow: '0 0 5px #0f0',
              backdropFilter: 'blur(4px)',
            }}>
              <div style={{ marginBottom: 4 }}>ENC: H.265 (HEVC)</div>
              <div style={{ marginBottom: 4 }}>BPS: {(4.2 * zoom).toFixed(1)} Mbps</div>
              <div>PPF: {Math.round(80 * zoom)} @ CENTER</div>
            </div>

            <div style={{ 
              background: 'rgba(0,0,0,0.7)', padding: '12px 16px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
              fontSize: 11, color: '#0f0', textShadow: '0 0 5px #0f0',
              textAlign: 'right', backdropFilter: 'blur(4px)',
            }}>
              <div style={{ color: '#ef4444', animation: 'pulse 1s infinite', marginBottom: 4 }}>REC ●</div>
              <div style={{ marginBottom: 4 }}>{new Date().toLocaleTimeString()}</div>
              <div style={{ opacity: 0.7 }}>CH_{String(activeSensorIdx + 1).padStart(2, '0')}</div>
            </div>
          </div>
        </div>

        {/* Controls footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid rgba(255,255,255,0.1)`, display: 'flex', alignItems: 'center', gap: 20, background: 'rgba(0,0,0,0.2)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
              <Maximize2 size={14} style={{ color: '#a1a1aa' }} />
              <input 
                type="range" min="1" max="4" step="0.1" value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#3b82f6', height: 4 }}
              />
              <span style={{ fontSize: 11, color: '#fff', width: 30, fontFamily: 'monospace' }}>
                {zoom.toFixed(1)}x
              </span>
           </div>
           
           <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
             <button
               onClick={() => setZoom(1.0)}
               style={{ 
                 padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#fff', 
                 fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                 transition: 'background 0.2s'
               }}
               onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
               onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
             >
               RESET VIEW
             </button>
             <button onClick={onClose} style={{ 
               padding: '8px 24px', borderRadius: 8, background: '#3b82f6', color: '#fff', 
               fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
               boxShadow: '0 4px 12px rgba(59,130,246,0.3)', transition: 'transform 0.2s'
             }}
             onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
             onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
             >
               DISMISS
             </button>
           </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}} />
    </div>
  )
}
