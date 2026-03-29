'use client'

import React, { useRef, useCallback } from 'react'
import { C } from './constants'
import { classifyDori, calculatePpfAtDistance } from '@/lib/calculators'
import type { DoriClassification } from '@/lib/calculators'
import type { DesignDevice } from '@/types/database'
import type { SystemStorageOutput } from '@/lib/calculators/system-storage'

interface ReportGeneratorProps {
  designName: string
  areaName?: string
  devices: DesignDevice[]
  storageOutput?: SystemStorageOutput | null
  canvasSnapshotFn?: () => string | null
  onClose?: () => void
}

const DORI_COLORS: Record<DoriClassification, string> = {
  identification: '#22c55e',
  recognition: '#eab308',
  observation: '#f97316',
  detection: '#ef4444',
  inspection: '#8b5cf6',
  monitor: '#6b7280',
  none: '#78716c',
}

const CAMERA_TYPES = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual']

/**
 * Report Generator — creates a printable site report with:
 * - Canvas snapshot
 * - Device BOM (Bill of Materials)
 * - Bandwidth & storage summary
 * - Camera coverage analysis (PPF/DORI per device)
 *
 * Uses a hidden iframe with window.print() — no external PDF library needed.
 */
export function ReportGenerator({
  designName, areaName, devices, storageOutput, canvasSnapshotFn, onClose,
}: ReportGeneratorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const cameras = devices.filter((d) => CAMERA_TYPES.includes(d.category))
  const nonCameras = devices.filter((d) => !CAMERA_TYPES.includes(d.category))

  // Group devices by category
  const devicesByCategory = new Map<string, DesignDevice[]>()
  for (const d of devices) {
    const existing = devicesByCategory.get(d.category) ?? []
    existing.push(d)
    devicesByCategory.set(d.category, existing)
  }

  // Camera coverage data
  const cameraData = cameras.map((d) => {
    const props = (d.properties ?? {}) as Record<string, unknown>
    const resW = (props.resolution_w as number) || 0
    const sensorW = (props.sensor_width as number) || 0
    const focalLength = (props.focal_length as number) || 0
    const targetDist = (props.target_distance as number) || 30

    let ppf = 0
    let dori: DoriClassification = 'none'
    if (resW && sensorW && focalLength) {
      ppf = calculatePpfAtDistance(resW, sensorW, focalLength, targetDist)
      dori = classifyDori(ppf)
    }

    return {
      label: d.label,
      category: d.category,
      resW,
      focalLength,
      targetDist,
      ppf: Math.round(ppf),
      dori,
      mount: d.mount_type || (props.mount_type as string) || '—',
    }
  })

  const generateReport = useCallback(() => {
    let snapshot: string | null = null
    if (canvasSnapshotFn) {
      snapshot = canvasSnapshotFn()
    }

    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${designName} — Site Report</title>
  <style>
    /* Fonts: Inter for UI, SF Mono/Cascadia Code/Consolas for monospace */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', 'Segoe UI', sans-serif; color: #1a1a2e; padding: 24px; font-size: 11px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; color: #1a1a2e; }
    h3 { font-size: 12px; margin: 12px 0 6px; color: #3b82f6; }
    .meta { color: #666; font-size: 10px; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 10px; }
    th { background: #f1f5f9; padding: 6px 8px; text-align: left; font-weight: 700; border: 1px solid #e2e8f0; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; }
    tr:nth-child(even) { background: #f8fafc; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 700; }
    .snapshot { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; margin: 8px 0; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 8px 0; }
    .metric-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; text-align: center; }
    .metric-value { font-size: 18px; font-weight: 700; font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; }
    .metric-label { font-size: 9px; color: #666; text-transform: uppercase; margin-top: 2px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #999; text-align: center; }
    @media print {
      body { padding: 12px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${designName}</h1>
  <div class="meta">${areaName ? `Area: ${areaName} • ` : ''}Generated: ${dateStr} • ${devices.length} devices</div>

  ${snapshot ? `<h2>Site Layout</h2><img src="${snapshot}" class="snapshot" alt="Canvas snapshot" />` : ''}

  ${storageOutput ? `
  <h2>System Summary</h2>
  <div class="metric-grid">
    <div class="metric-box">
      <div class="metric-value">${cameras.length}</div>
      <div class="metric-label">Cameras</div>
    </div>
    <div class="metric-box">
      <div class="metric-value">${Math.round(storageOutput.totalBandwidthMbps)} Mbps</div>
      <div class="metric-label">Bandwidth</div>
    </div>
    <div class="metric-box">
      <div class="metric-value">${storageOutput.totalStorageTB.toFixed(1)} TB</div>
      <div class="metric-label">Storage (30d)</div>
    </div>
    <div class="metric-box">
      <div class="metric-value">${storageOutput.poeBudget.totalWatts} W</div>
      <div class="metric-label">PoE Budget</div>
    </div>
  </div>

  <h3>RAID ${storageOutput.raidAnalysis.raidLevel} Analysis</h3>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Usable Storage</td><td>${storageOutput.raidAnalysis.usableStorageTB.toFixed(1)} TB</td></tr>
    <tr><td>Raw Storage</td><td>${storageOutput.raidAnalysis.rawStorageTB.toFixed(1)} TB</td></tr>
    <tr><td>Drive Count</td><td>${storageOutput.raidAnalysis.driveCount}× ${storageOutput.raidAnalysis.driveSizeTB} TB</td></tr>
    <tr><td>Utilization</td><td>${((storageOutput.totalStorageTB / storageOutput.raidAnalysis.usableStorageTB) * 100).toFixed(0)}%</td></tr>
  </table>
  ` : ''}

  <h2>Camera Coverage Analysis</h2>
  <table>
    <tr>
      <th>Camera</th><th>Type</th><th>Resolution</th><th>Focal</th><th>Mount</th>
      <th>Dist</th><th>PPF</th><th>DORI</th>
    </tr>
    ${cameraData.map((c) => `
    <tr>
      <td>${c.label}</td>
      <td>${c.category}</td>
      <td>${c.resW ? c.resW + 'px' : '—'}</td>
      <td>${c.focalLength ? c.focalLength + 'mm' : '—'}</td>
      <td>${c.mount}</td>
      <td>${c.targetDist} ft</td>
      <td><span class="badge" style="background:${DORI_COLORS[c.dori]}15;color:${DORI_COLORS[c.dori]}">${c.ppf}</span></td>
      <td><span class="badge" style="background:${DORI_COLORS[c.dori]}15;color:${DORI_COLORS[c.dori]}">${c.dori.toUpperCase()}</span></td>
    </tr>
    `).join('')}
  </table>

  <h2>Bill of Materials</h2>
  <table>
    <tr><th>Category</th><th>Qty</th><th>Devices</th></tr>
    ${Array.from(devicesByCategory.entries()).map(([cat, devs]) => `
    <tr>
      <td style="font-weight:600">${cat.replace(/_/g, ' ').toUpperCase()}</td>
      <td>${devs.length}</td>
      <td>${devs.map(d => d.label).join(', ')}</td>
    </tr>
    `).join('')}
    <tr style="font-weight:700;background:#f1f5f9">
      <td>TOTAL</td>
      <td>${devices.length}</td>
      <td></td>
    </tr>
  </table>

  <div class="footer">
    Generated by Panteray Design Engine • ${dateStr}
  </div>
</body>
</html>`

    // Open in new window for print
    const printWindow = window.open('', '_blank', 'width=800,height=1000')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      setTimeout(() => printWindow.print(), 500)
    }
  }, [designName, areaName, devices, storageOutput, canvasSnapshotFn, cameras, cameraData, devicesByCategory])

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      background: C.bgPanel, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: '24px 28px', zIndex: 50, boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      minWidth: 320, maxWidth: 400,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Generate Site Report</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>
        Creates a printable PDF with canvas snapshot, camera coverage, BOM, and storage analysis.
      </div>

      {/* Summary */}
      <div style={{ background: C.bgSurface, borderRadius: 6, padding: '10px 14px', marginBottom: 16, border: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
          <span>Cameras</span>
          <span style={{ color: C.text, fontWeight: 600 }}>{cameras.length}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
          <span>Other devices</span>
          <span style={{ color: C.text, fontWeight: 600 }}>{nonCameras.length}</span>
        </div>
        {storageOutput && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
              <span>Bandwidth</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{Math.round(storageOutput.totalBandwidthMbps)} Mbps</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted }}>
              <span>Storage (30d)</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{storageOutput.totalStorageTB.toFixed(1)} TB</span>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={generateReport} style={{
          flex: 1, padding: '10px 16px', background: C.accent, color: '#fff', border: 'none',
          borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = C.accentHover}
        onMouseLeave={(e) => e.currentTarget.style.background = C.accent}
        >
          Generate & Print
        </button>
        {onClose && (
          <button onClick={onClose} style={{
            padding: '10px 16px', background: C.bg, color: C.textMuted, border: `1px solid ${C.border}`,
            borderRadius: 6, fontSize: 12, cursor: 'pointer',
          }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
