// Design Canvas — Constants & Color Tokens
// Ported from CASDEX, adapted for Panteray

export type IconTabId =
  | 'layers'
  | 'camera'
  | 'door'
  | 'network'
  | 'av'
  | 'sensors'
  | 'other'

export type RequirementStatus = 'normal' | 'missing' | 'deficient'

export type MountType = 'ceiling' | 'wall' | 'pole' | 'pendant'

export type RecordingMode = 'continuous' | 'motion' | 'motion_object' | 'none'

export type CanvasTool = 'select' | 'place' | 'cable' | 'mdf_idf' | 'zone' | 'measure' | 'scale' | 'door' | 'pan'

export interface IconTab {
  id: IconTabId
  label: string
}

export const ICON_TABS: IconTab[] = [
  { id: 'layers', label: 'Layers' },
  { id: 'camera', label: 'Camera' },
  { id: 'door', label: 'Door/ACS' },
  { id: 'network', label: 'Network' },
  { id: 'av', label: 'AV' },
  { id: 'sensors', label: 'Sensors' },
  { id: 'other', label: 'Other' },
]

export const COLORS_16 = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#6366f1', '#a855f7', '#f43f5e',
  '#fb923c', '#84cc16', '#10b981', '#0ea5e9',
] as const

/** 48-color expanded swatch grid — 6 rows × 8 columns, full spectrum */
export const COLORS_48 = [
  // Row 1 — reds & pinks
  '#ef4444', '#dc2626', '#f43f5e', '#e11d48', '#ec4899', '#db2777', '#d946ef', '#c026d3',
  // Row 2 — purples & blues
  '#a855f7', '#9333ea', '#8b5cf6', '#7c3aed', '#6366f1', '#4f46e5', '#3b82f6', '#2563eb',
  // Row 3 — blues & cyans
  '#0ea5e9', '#0284c7', '#06b6d4', '#0891b2', '#14b8a6', '#0d9488', '#10b981', '#059669',
  // Row 4 — greens
  '#22c55e', '#16a34a', '#84cc16', '#65a30d', '#a3e635', '#4ade80', '#34d399', '#2dd4bf',
  // Row 5 — yellows & oranges
  '#eab308', '#ca8a04', '#f59e0b', '#d97706', '#f97316', '#ea580c', '#fb923c', '#fdba74',
  // Row 6 — neutrals & earth tones
  '#78716c', '#57534e', '#a8a29e', '#d6d3d1', '#fbbf24', '#b45309', '#92400e', '#451a03',
] as const

/** Default cable colors by cable type */
export const CABLE_DEFAULT_COLORS: Record<string, string> = {
  cat6: '#3b82f6',        // blue
  composite: '#8b5cf6',   // purple
  '2_conductor': '#ef4444', // red
  '4_conductor': '#f97316', // orange
  hdmi: '#22c55e',        // green
  fiber_sm: '#eab308',    // yellow
  fiber_mm: '#06b6d4',    // cyan
  other: '#78716c',       // gray
}

/** Door-related device sub-types */
export const DOOR_DEVICE_TYPES = [
  'door', 'door_controller', 'card_reader', 'electric_strike',
  'maglock', 'rim_strike', 'mortise_lock', 'elr',
] as const

/** Gate-related device sub-types */
export const GATE_DEVICE_TYPES = [
  'gate', 'gate_controller', 'gate_operator', 'loop_detector',
] as const

/** Intercom device sub-types (access_control category, NOT av) */
export const INTERCOM_DEVICE_TYPES = [
  'intercom', 'video_intercom', 'audio_intercom',
] as const

/** Vape/environmental device sub-types */
export const VAPE_ENV_DEVICE_TYPES = [
  'vape_detector', 'environmental_detector',
] as const

// ---- Helper functions ----

export function isDoorType(subType: string): boolean {
  return (DOOR_DEVICE_TYPES as readonly string[]).includes(subType)
}

export function isGateType(subType: string): boolean {
  return (GATE_DEVICE_TYPES as readonly string[]).includes(subType)
}

export function isIntercomType(subType: string): boolean {
  return (INTERCOM_DEVICE_TYPES as readonly string[]).includes(subType)
}

export function isVapeEnvType(subType: string): boolean {
  return (VAPE_ENV_DEVICE_TYPES as readonly string[]).includes(subType)
}

/** Get default cable color for a cable type */
export function getCableColor(cableType: string): string {
  return CABLE_DEFAULT_COLORS[cableType] ?? CABLE_DEFAULT_COLORS.other
}

export const PPF_CHART = [
  { min: 100, label: 'Facial Recognition', color: '#22c55e' },
  { min: 76, label: 'Identification', color: '#22c55e' },
  { min: 50, label: 'ID + LPR/ANPR', color: '#eab308' },
  { min: 38, label: 'Recognition', color: '#eab308' },
  { min: 19, label: 'Observation', color: '#f97316' },
  { min: 8, label: 'Detection', color: '#ef4444' },
  { min: 0, label: 'Monitor Only', color: '#ef4444' },
] as const

/** Color tokens for dark-themed design canvas */
export const C = {
  bg: '#0f1117',
  bgSurface: '#161922',
  bgPanel: '#1a1d28',
  bgHover: '#252836',
  bgActive: '#2a2d3a',
  border: '#2a2d3a',
  borderSubtle: '#1f2230',
  text: '#e4e6eb',
  textMuted: '#8b8fa3',
  textDim: '#5c6078',
  accent: '#3b82f6',
  accentHover: '#2563eb',
  accentSubtle: 'rgba(59,130,246,0.12)',
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  orange: '#f97316',
} as const

/** Grid dot spacing (px) at zoom 100% */
export const GRID_SIZE = 24

/** Canvas zoom limits */
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4.0

/** Snap grid size (same as visual grid) */
export const SNAP_SIZE = GRID_SIZE

/** Undo stack depth */
export const UNDO_STACK_DEPTH = 50

/** Auto-save interval (ms) */
export const AUTOSAVE_INTERVAL_MS = 30_000
