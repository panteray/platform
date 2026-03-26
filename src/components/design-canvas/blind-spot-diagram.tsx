'use client'

import { C } from './constants'

interface BlindSpotDiagramProps {
  installHeight: number  // ft
  tiltAngle: number      // degrees (0 = horizontal, positive = downward)
  blindSpotFt: number    // computed distance from camera base
  targetDistFt: number   // target distance for reference
  vFov?: number          // vertical FOV in degrees
}

/**
 * Side-view cross-section diagram showing camera mount height, tilt angle,
 * FOV wedge projected downward, blind spot zone, and target distance.
 * Modeled after IPVM's blind spot visualization.
 */
export function BlindSpotDiagram({
  installHeight,
  tiltAngle,
  blindSpotFt,
  targetDistFt,
  vFov = 45,
}: BlindSpotDiagramProps) {
  const W = 260
  const H = 130
  const PAD_L = 30
  const PAD_R = 16
  const PAD_T = 14
  const PAD_B = 24
  const groundY = H - PAD_B
  const drawW = W - PAD_L - PAD_R
  const drawH = groundY - PAD_T

  // Scale: fit both targetDist and blindSpot in the horizontal axis
  const maxDist = Math.max(targetDistFt, blindSpotFt, 10)
  const pxPerFt = drawW / maxDist

  // Camera position (left side, at mount height)
  const camX = PAD_L
  const camY = groundY - Math.min(installHeight * (drawH / Math.max(installHeight, 10)), drawH * 0.8)

  // Tilt and FOV angles (convert to radians, measured from horizontal)
  const tiltRad = tiltAngle * Math.PI / 180
  const halfVFov = (vFov / 2) * Math.PI / 180

  // FOV near edge (closer to camera — determines blind spot)
  const nearAngle = tiltRad + halfVFov
  // FOV far edge (further from camera — determines max visible ground)
  const farAngle = tiltRad - halfVFov

  // Project FOV edges to ground (or clamp to diagram bounds)
  const nearGroundX = nearAngle < Math.PI / 2
    ? camX + (installHeight / Math.tan(nearAngle)) * pxPerFt
    : camX
  const farGroundX = farAngle > 0
    ? camX + (installHeight / Math.tan(farAngle)) * pxPerFt
    : camX + drawW

  // Blind spot zone on ground
  const blindEndX = camX + blindSpotFt * pxPerFt

  // Target distance marker
  const targetX = camX + targetDistFt * pxPerFt

  // Person silhouette at target (simplified)
  const personH = Math.min(30, drawH * 0.5)
  const personW = personH * 0.35

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Ground line */}
      <line x1={PAD_L - 4} y1={groundY} x2={W - PAD_R} y2={groundY}
        stroke={C.textDim} strokeWidth={1} />

      {/* Vertical mount pole */}
      <line x1={camX} y1={groundY} x2={camX} y2={camY}
        stroke={C.textMuted} strokeWidth={2} strokeDasharray="3 2" />

      {/* Camera icon (small rectangle) */}
      <rect x={camX - 6} y={camY - 4} width={12} height={8}
        rx={2} fill={C.accent} stroke="none" />
      <circle cx={camX + 4} cy={camY} r={2} fill="#fff" opacity={0.8} />

      {/* FOV wedge — two lines from camera to ground */}
      <line x1={camX} y1={camY} x2={Math.min(nearGroundX, W - PAD_R)} y2={groundY}
        stroke={C.orange} strokeWidth={1} opacity={0.6} />
      <line x1={camX} y1={camY} x2={Math.min(farGroundX, W - PAD_R)} y2={groundY}
        stroke={C.orange} strokeWidth={1} opacity={0.6} />

      {/* FOV fill triangle */}
      <polygon
        points={`${camX},${camY} ${Math.min(nearGroundX, W - PAD_R)},${groundY} ${Math.min(farGroundX, W - PAD_R)},${groundY}`}
        fill={C.orange} opacity={0.06}
      />

      {/* Blind spot shaded zone on ground */}
      {blindSpotFt > 0.5 && (
        <>
          <rect
            x={camX} y={groundY - 6}
            width={Math.max(0, Math.min(blindEndX - camX, drawW))} height={6}
            fill="#f97316" opacity={0.25} rx={1}
          />
          {/* Hatching pattern for blind zone */}
          {Array.from({ length: Math.min(Math.floor((blindEndX - camX) / 6), 20) }, (_, i) => (
            <line key={i}
              x1={camX + i * 6 + 3} y1={groundY - 6}
              x2={camX + i * 6} y2={groundY}
              stroke="#f97316" strokeWidth={0.5} opacity={0.4}
            />
          ))}
          {/* Blind spot distance label */}
          <text
            x={camX + Math.min(blindEndX - camX, drawW) / 2}
            y={groundY + 14}
            textAnchor="middle" fontSize={8} fontWeight={600}
            fill="#f97316" fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace"
          >
            {Math.round(blindSpotFt * 10) / 10}ft blind
          </text>
        </>
      )}

      {/* Target distance person silhouette */}
      {targetX < W - PAD_R && (
        <g transform={`translate(${targetX}, ${groundY})`}>
          {/* Person body */}
          <ellipse cx={0} cy={-personH + 3} rx={personW * 0.4} ry={3}
            fill={C.textMuted} opacity={0.7} />
          <rect x={-personW / 2} y={-personH + 6} width={personW} height={personH * 0.45}
            rx={2} fill={C.textMuted} opacity={0.5} />
          <line x1={-personW * 0.15} y1={-personH * 0.45} x2={-personW * 0.15} y2={0}
            stroke={C.textMuted} strokeWidth={personW * 0.25} opacity={0.4} />
          <line x1={personW * 0.15} y1={-personH * 0.45} x2={personW * 0.15} y2={0}
            stroke={C.textMuted} strokeWidth={personW * 0.25} opacity={0.4} />
          {/* Distance label */}
          <text x={0} y={14} textAnchor="middle" fontSize={7}
            fill={C.textDim} fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace">
            {Math.round(targetDistFt)}ft
          </text>
        </g>
      )}

      {/* Height label on mount pole */}
      <text x={camX - 8} y={(camY + groundY) / 2} textAnchor="middle"
        fontSize={7} fill={C.textDim} fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace"
        transform={`rotate(-90, ${camX - 8}, ${(camY + groundY) / 2})`}>
        {Math.round(installHeight)}ft
      </text>

      {/* Tilt angle arc indicator */}
      {tiltAngle > 1 && (() => {
        const arcR = 16
        const startAngle = 0
        const endAngle = -tiltRad
        const x1 = camX + arcR * Math.cos(startAngle)
        const y1 = camY + arcR * Math.sin(startAngle)
        const x2 = camX + arcR * Math.cos(endAngle)
        const y2 = camY + arcR * Math.sin(endAngle)
        return (
          <>
            <path
              d={`M ${x1} ${y1} A ${arcR} ${arcR} 0 0 0 ${x2} ${y2}`}
              fill="none" stroke={C.accent} strokeWidth={0.8} opacity={0.6}
            />
            <text x={camX + arcR + 4} y={camY + 3} fontSize={7}
              fill={C.accent} fontFamily="'SF Mono', 'Cascadia Code', 'Consolas', monospace">
              {Math.round(tiltAngle)}°
            </text>
          </>
        )
      })()}
    </svg>
  )
}
