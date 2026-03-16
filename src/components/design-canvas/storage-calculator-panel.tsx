"use client";
import React from "react";
import {
  calculateSystemStorage,
  canvasDevicesToCameraSpecs,
  type CameraSpec,
  type SystemStorageOutput,
} from "@/lib/calculators/system-storage";
import type { DesignDevice } from "@/types/database";

export interface StorageCalculatorPanelProps {
  /** Placed CCTV devices from canvas — used to build camera specs */
  devices?: DesignDevice[];
  /** Fallback: total cameras if devices not provided */
  cameraCount?: number;
  /** Retention days — user must set at project level */
  retentionDays?: number;
}

export function StorageCalculatorPanel({
  devices,
  cameraCount,
  retentionDays = 30,
}: StorageCalculatorPanelProps) {
  const cameraSpecs: CameraSpec[] = devices
    ? canvasDevicesToCameraSpecs(
        devices.map((d) => ({
          id: d.id,
          label: d.label || "",
          category: d.category || "other",
          properties: (d.properties ?? {}) as Record<string, unknown>,
        }))
      )
    : [];

  const totalCameras = cameraSpecs.length || cameraCount || 0;

  const output: SystemStorageOutput | null =
    cameraSpecs.length > 0
      ? calculateSystemStorage({ cameras: cameraSpecs, retentionDays, raidLevel: 6, driveSizeTB: 10 })
      : null;

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-border bg-muted/30">
        <h2 className="text-lg font-bold text-foreground">Storage &amp; System</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Based on {totalCameras} camera{totalCameras !== 1 ? "s" : ""} on canvas
        </p>
      </div>
      {totalCameras === 0 ? (
        <div className="p-6 text-center text-muted-foreground text-sm">
          Add cameras to see storage and bandwidth estimates.
        </div>
      ) : !output ? (
        <div className="p-6 text-center text-muted-foreground text-sm">
          Place devices on the canvas to calculate storage from actual specs.
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/30 rounded border border-border">
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Bandwidth
              </p>
              <p className="text-xl font-bold text-foreground">
                {Math.round(output.totalBandwidthMbps)} Mbps
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded border border-border">
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Storage ({retentionDays}d)
              </p>
              <p className="text-xl font-bold text-foreground">
                {output.totalStorageTB.toFixed(1)} TB
              </p>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">
              PoE budget
            </h4>
            <p className="text-lg font-bold text-foreground">
              {output.poeBudget.totalWatts} W
            </p>
            <p className="text-xs text-muted-foreground">
              Switch capacity: {output.poeBudget.recommendedSwitchWatts} W
            </p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">
              RAID {output.raidAnalysis.raidLevel}
            </h4>
            <div className="p-2 bg-muted/30 rounded border border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usable</span>
                <span className="font-bold text-foreground">{output.raidAnalysis.usableStorageTB.toFixed(1)} TB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Drives</span>
                <span className="font-bold text-foreground">{output.raidAnalysis.driveCount}x {output.raidAnalysis.driveSizeTB} TB</span>
              </div>
            </div>
          </div>
          {output.tco ? (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-bold uppercase text-muted-foreground">
                5-year TCO
              </p>
              <div className="flex gap-4 mt-1">
                <div>
                  <p className="text-xs text-muted-foreground">Local NVR</p>
                  <p className="text-sm font-bold text-foreground">
                    ${output.tco.localNvrCost.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cloud (5yr)</p>
                  <p className="text-sm font-bold text-foreground">
                    ${output.tco.cloud5YearCost.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {output.tco.recommendation}
              </p>
            </div>
          ) : (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Provide cloud and local storage pricing to see TCO comparison.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
