"use client";
import React, { useState, useMemo } from "react";
import { X } from "lucide-react";
import {
  calculateSystemStorage,
  canvasDevicesToCameraSpecs,
  type SystemStorageOutput,
} from "@/lib/calculators/system-storage";
import { C } from "./constants";
import type { DesignDevice } from "@/types/database";

export interface StorageCalculatorPanelProps {
  /** Placed devices from canvas */
  devices?: DesignDevice[];
  /** Pre-computed output from design-canvas (avoids duplicate calc) */
  storageOutput?: SystemStorageOutput | null;
  /** Retention days — defaults to 30 */
  retentionDays?: number;
  /** Close handler */
  onClose?: () => void;
}

const CAMERA_TYPES = ['cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye', 'multisensor_quad', 'multisensor_dual'];

const RETENTION_OPTIONS = [7, 14, 30, 60, 90, 180, 365];
const RAID_OPTIONS: (5 | 6)[] = [5, 6];
const DRIVE_OPTIONS = [2, 4, 6, 8, 10, 12, 16, 18, 20];

export function StorageCalculatorPanel({
  devices,
  storageOutput: externalOutput,
  retentionDays: defaultRetention = 30,
  onClose,
}: StorageCalculatorPanelProps) {
  // ---- Interactive settings ----
  const [retentionDays, setRetentionDays] = useState(defaultRetention);
  const [raidLevel, setRaidLevel] = useState<5 | 6>(6);
  const [driveSizeTB, setDriveSizeTB] = useState(10);

  // Camera specs derived from placed devices
  const cameraSpecs = useMemo(() => {
    if (!devices || devices.length === 0) return [];
    const camDevices = devices
      .filter((d) => CAMERA_TYPES.includes(d.category))
      .map((d) => ({
        id: d.id,
        label: d.label || "",
        category: "cctv" as const,
        properties: (d.properties ?? {}) as Record<string, unknown>,
      }));
    return canvasDevicesToCameraSpecs(camDevices);
  }, [devices]);

  // Re-compute storage when settings change
  const output: SystemStorageOutput | null = useMemo(() => {
    if (cameraSpecs.length === 0) return externalOutput ?? null;
    try {
      return calculateSystemStorage({
        cameras: cameraSpecs,
        retentionDays,
        raidLevel,
        driveSizeTB,
      });
    } catch { return null; }
  }, [cameraSpecs, retentionDays, raidLevel, driveSizeTB, externalOutput]);

  const totalCameras = output?.totalCameras ?? 0;

  const metricBox = { padding: '10px 12px', background: C.bgSurface, borderRadius: 6, border: `1px solid ${C.border}` } as const;
  const metricLabel = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, color: C.textDim, letterSpacing: 0.5 };
  const metricValue = { fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.3 };
  const metricSmall = { fontSize: 11, color: C.textMuted };
  const sectionTitle = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, color: C.textDim, letterSpacing: 0.5, marginBottom: 8 };
  const selectStyle = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4,
    padding: '4px 8px', fontSize: 11, color: C.text, outline: 'none',
    fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace", cursor: 'pointer',
  };

  return (
    <div style={{ width: 300, background: C.bgPanel, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.bgSurface, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Storage &amp; System</div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
            Based on {totalCameras} camera{totalCameras !== 1 ? "s" : ""} on canvas
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', padding: 4, display: 'flex' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* ---- Settings Controls ---- */}
        <div style={{ marginBottom: 16 }}>
          <div style={sectionTitle}>Recording Settings</div>
          <div style={{ ...metricBox, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Retention */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>Retention</span>
              <select value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} style={selectStyle}>
                {RETENTION_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </div>
            {/* RAID Level */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>RAID Level</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {RAID_OPTIONS.map((r) => (
                  <button key={r} onClick={() => setRaidLevel(r)} style={{
                    padding: '3px 10px', fontSize: 11, fontWeight: 600,
                    borderRadius: 4, cursor: 'pointer', border: 'none',
                    background: raidLevel === r ? `${C.accent}20` : C.bg,
                    color: raidLevel === r ? C.accent : C.textMuted,
                    outline: raidLevel === r ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                  }}>
                    RAID {r}
                  </button>
                ))}
              </div>
            </div>
            {/* Drive Size */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>Drive Size</span>
              <select value={driveSizeTB} onChange={(e) => setDriveSizeTB(Number(e.target.value))} style={selectStyle}>
                {DRIVE_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d} TB</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {totalCameras === 0 ? (
          <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, padding: '32px 16px' }}>
            Place cameras on the canvas to see storage, bandwidth, and PoE estimates.
          </div>
        ) : !output ? (
          <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 12, padding: '32px 16px' }}>
            Camera specs incomplete — add resolution and compression data in device properties.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Bandwidth + Storage */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={metricBox}>
                <div style={metricLabel}>Bandwidth</div>
                <div style={metricValue}>{Math.round(output.totalBandwidthMbps)}<span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginLeft: 3 }}>Mbps</span></div>
              </div>
              <div style={metricBox}>
                <div style={metricLabel}>Storage ({retentionDays}d)</div>
                <div style={metricValue}>{output.totalStorageTB.toFixed(1)}<span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginLeft: 3 }}>TB</span></div>
              </div>
            </div>

            {/* PoE Budget */}
            <div>
              <div style={sectionTitle}>PoE Budget</div>
              <div style={metricBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={metricValue}>{output.poeBudget.totalWatts}<span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginLeft: 3 }}>W</span></div>
                  <div style={{ fontSize: 10, color: C.accent, fontWeight: 600 }}>{output.poeBudget.cameraCount} devices</div>
                </div>
                <div style={{ ...metricSmall, marginTop: 6 }}>
                  Recommended switch: <span style={{ fontWeight: 600, color: C.text }}>{output.poeBudget.recommendedSwitchWatts} W</span>
                </div>
                {output.poeBudget.byStandard.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {output.poeBudget.byStandard.filter(s => s.standard !== 'none').map((s) => (
                      <div key={s.standard} style={{ fontSize: 9, color: C.textDim, background: C.bgActive, padding: '2px 6px', borderRadius: 3 }}>
                        802.3{s.standard}: {s.count}x ({s.watts}W)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RAID Analysis */}
            <div>
              <div style={sectionTitle}>RAID {output.raidAnalysis.raidLevel}</div>
              <div style={metricBox}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={metricSmall}>Usable</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{output.raidAnalysis.usableStorageTB.toFixed(1)} TB</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={metricSmall}>Raw</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{output.raidAnalysis.rawStorageTB.toFixed(1)} TB</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={metricSmall}>Drives</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{output.raidAnalysis.driveCount}x {output.raidAnalysis.driveSizeTB} TB</span>
                  </div>
                  {/* Utilization bar */}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ height: 4, background: C.bgActive, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${Math.min(100, (output.totalStorageTB / output.raidAnalysis.usableStorageTB) * 100)}%`,
                        background: (output.totalStorageTB / output.raidAnalysis.usableStorageTB) > 0.85 ? C.red : C.green,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 9, color: C.textDim, marginTop: 2, textAlign: 'right' }}>
                      {((output.totalStorageTB / output.raidAnalysis.usableStorageTB) * 100).toFixed(0)}% utilized
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TCO */}
            {output.tco ? (
              <div>
                <div style={sectionTitle}>5-Year TCO</div>
                <div style={metricBox}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase' }}>Local NVR</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>${output.tco.localNvrCost.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: C.textDim, textTransform: 'uppercase' }}>Cloud (5yr)</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>${output.tco.cloud5YearCost.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ ...metricSmall, marginTop: 8 }}>{output.tco.recommendation}</div>
                </div>
              </div>
            ) : (
              <div>
                <div style={sectionTitle}>5-Year TCO</div>
                <div style={{ fontSize: 11, color: C.textDim, padding: '8px 0' }}>
                  Provide cloud and local storage pricing to see TCO comparison.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
