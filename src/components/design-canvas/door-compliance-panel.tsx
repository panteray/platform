"use client";
import React from "react";
import {
  runAcsEngine,
  type AcsBuildInput,
  type LockType,
  type DoorType,
} from "@/lib/calculators/acs-calculator";

export interface DoorForCompliance {
  id: string;
  doorName?: string;
  door_type?: string;
  lock_type?: string;
  device_id?: string;
  properties?: {
    facpConnected?: boolean;
    isEgressDoor?: boolean;
    hasPirRex?: boolean;
    hasPneumaticButton?: boolean;
    fireAlarmDropsLocks?: boolean;
    controllerDrawAmps?: number;
    lockDrawAmps?: number;
    hasAdo?: boolean;
  };
}

export interface DoorCompliancePanelProps {
  door: DoorForCompliance | null;
}

function mapLockType(s?: string): LockType {
  if (!s) return "other";
  const v = s.toLowerCase();
  if (v.includes("mag") || v.includes("magnetic")) return "maglock";
  if (v.includes("strike")) return "electric_strike";
  if (v.includes("mortise")) return "mortise";
  return "other";
}

function mapDoorType(s?: string): DoorType {
  if (!s) return "single";
  const v = s.toLowerCase();
  if (v.includes("mantrap")) return "mantrap";
  if (v.includes("double")) return "double";
  return "single";
}

export function DoorCompliancePanel({ door }: DoorCompliancePanelProps) {
  if (!door) return null;

  const input: AcsBuildInput = {
    doorType: mapDoorType(door.door_type),
    lockType: mapLockType(door.lock_type),
    controllerDrawAmps: door.properties?.controllerDrawAmps ?? 0.5,
    lockDrawAmps: door.properties?.lockDrawAmps ?? 0.3,
    hasAdo: door.properties?.hasAdo,
    isMantrap: door.door_type?.toLowerCase().includes("mantrap"),
  };
  const output = runAcsEngine(input);

  const hasViolations = output.compliance.violations.length > 0;
  const allMessages = [...output.compliance.violations, ...output.compliance.notes];

  const badgeClass = hasViolations
    ? "bg-red-100 text-red-800 border-red-400"
    : allMessages.length > 0
      ? "bg-yellow-100 text-yellow-800 border-yellow-400"
      : "bg-green-100 text-green-800 border-green-300";

  const badgeLabel = hasViolations ? "Non-compliant" : allMessages.length > 0 ? "Warning" : "Compliant";

  return (
    <div className="w-80 bg-white border-l shadow-xl flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-black">Door compliance</h2>
        <p className="text-sm font-medium truncate">
          {door.doorName || "Unnamed door"}
        </p>
        <div className="mt-2">
          <span
            className={`inline-block px-2 py-1 text-xs font-bold uppercase rounded border ${badgeClass}`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">
            Electrical load
          </h4>
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-gray-500">Total draw</p>
              <p className="text-lg font-bold">{output.electrical.totalDrawAmps} A</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Min PSU</p>
              <p className="text-lg font-bold">{output.electrical.minPsuAmps} A</p>
            </div>
          </div>
        </div>
        {allMessages.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">
              Compliance notes
            </h4>
            <ul className="space-y-1">
              {output.compliance.violations.map((msg: string, i: number) => (
                <li
                  key={`v-${i}`}
                  className="text-sm p-2 rounded border bg-red-50 border-red-200 text-red-800"
                >
                  {msg}
                </li>
              ))}
              {output.compliance.notes.map((msg: string, i: number) => (
                <li
                  key={`n-${i}`}
                  className="text-sm p-2 rounded border bg-yellow-50 border-yellow-200 text-yellow-800"
                >
                  {msg}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">
            Wiring schedule
          </h4>
          <ul className="space-y-2">
            {Object.entries(output.wiringSchedule).map(([circuit, spec]) => (
              <li
                key={circuit}
                className="p-2 bg-gray-50 rounded border text-sm"
              >
                <p className="font-bold">{circuit}</p>
                <p className="text-gray-600">{spec.type} {String((spec as unknown as Record<string,unknown>).gauge)} {spec.cond}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
