import type { DoorType, ElectrificationType, OccupancyType } from "./compatibility-data";

export interface DoorEntry {
  id: string;
  doorLabel: string;
  doorType: DoorType;
  fireRated: boolean;
  electrificationType: ElectrificationType;
  occupancyType: OccupancyType;
  cardReaderHeight?: number;
  rexHeight?: number;
  panicHardwareHeight?: number;
  doorHardwareHeight?: number;
  maglockJustification?: string;
  advisoryNotes: string[];
  createdAt: string;
}

function storageKey(oppId: string): string {
  return `door-entries-${oppId}`;
}

export function getDoors(oppId: string): DoorEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(storageKey(oppId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveDoor(oppId: string, door: DoorEntry): void {
  if (typeof window === "undefined") return;
  const doors = getDoors(oppId);
  const idx = doors.findIndex((d) => d.id === door.id);
  if (idx >= 0) {
    doors[idx] = door;
  } else {
    doors.push(door);
  }
  localStorage.setItem(storageKey(oppId), JSON.stringify(doors));
}

export function deleteDoor(oppId: string, id: string): void {
  if (typeof window === "undefined") return;
  const doors = getDoors(oppId).filter((d) => d.id !== id);
  localStorage.setItem(storageKey(oppId), JSON.stringify(doors));
}

export function generateId(): string {
  return `door-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
