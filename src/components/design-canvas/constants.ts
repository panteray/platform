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
