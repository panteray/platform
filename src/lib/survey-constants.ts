// ============================================================
// Survey Module Constants
// Phase 1C — System types, device types, mount types, etc.
// ============================================================

// ---- System Types (6 categories) ----
export const SURVEY_SYSTEM_TYPES = [
  { value: 'cctv', label: 'CCTV', color: '#3b82f6' },
  { value: 'access_control', label: 'Access Control', color: '#f59e0b' },
  { value: 'network', label: 'Network', color: '#8b5cf6' },
  { value: 'av', label: 'AV', color: '#ec4899' },
  { value: 'vape_environmental', label: 'Vape / Environmental', color: '#14b8a6' },
  { value: 'other', label: 'Other', color: '#6b7280' },
] as const

export type SurveySystemType = (typeof SURVEY_SYSTEM_TYPES)[number]['value']

// ---- Device Types per System ----
export const SURVEY_DEVICE_TYPES: Record<SurveySystemType, readonly { value: string; label: string }[]> = {
  cctv: [
    { value: 'camera_fixed', label: 'Fixed Camera' },
    { value: 'camera_ptz', label: 'PTZ Camera' },
    { value: 'camera_dome', label: 'Dome Camera' },
    { value: 'camera_bullet', label: 'Bullet Camera' },
    { value: 'camera_turret', label: 'Turret Camera' },
    { value: 'camera_multisensor', label: 'Multi-Sensor Camera' },
    { value: 'camera_panoramic', label: 'Panoramic Camera' },
    { value: 'camera_fisheye', label: 'Fisheye Camera' },
    { value: 'camera_lpr', label: 'LPR Camera' },
    { value: 'camera_thermal', label: 'Thermal Camera' },
    { value: 'camera_body', label: 'Body Camera' },
    { value: 'nvr', label: 'NVR' },
    { value: 'dvr', label: 'DVR' },
    { value: 'encoder', label: 'Encoder' },
    { value: 'decoder', label: 'Decoder' },
    { value: 'vms_server', label: 'VMS Server' },
    { value: 'monitor', label: 'Monitor / Display' },
    { value: 'video_wall', label: 'Video Wall Controller' },
    { value: 'joystick', label: 'Joystick Controller' },
  ],
  access_control: [
    { value: 'reader_prox', label: 'Proximity Reader' },
    { value: 'reader_smart', label: 'Smart Card Reader' },
    { value: 'reader_bio', label: 'Biometric Reader' },
    { value: 'reader_mobile', label: 'Mobile Credential Reader' },
    { value: 'reader_multi', label: 'Multi-Technology Reader' },
    { value: 'reader_keypad', label: 'Keypad Reader' },
    { value: 'reader_long_range', label: 'Long Range Reader' },
    { value: 'controller_2door', label: '2-Door Controller' },
    { value: 'controller_4door', label: '4-Door Controller' },
    { value: 'controller_8door', label: '8-Door Controller' },
    { value: 'controller_single', label: 'Single-Door Controller' },
    { value: 'io_module', label: 'I/O Module' },
    { value: 'relay_module', label: 'Relay Module' },
    { value: 'lock_electric_strike', label: 'Electric Strike' },
    { value: 'lock_maglock', label: 'Magnetic Lock' },
    { value: 'lock_electrified', label: 'Electrified Lock' },
    { value: 'lock_wireless', label: 'Wireless Lock' },
    { value: 'rex', label: 'Request-to-Exit (REX)' },
    { value: 'door_contact', label: 'Door Contact / DPS' },
    { value: 'intercom', label: 'Intercom / Video Intercom' },
    { value: 'elevator_controller', label: 'Elevator Controller' },
    { value: 'turnstile', label: 'Turnstile / Gate' },
    { value: 'auto_operator', label: 'Auto Operator' },
    { value: 'acs_server', label: 'ACS Server' },
    { value: 'power_supply', label: 'ACS Power Supply' },
  ],
  network: [
    { value: 'switch_poe', label: 'PoE Switch' },
    { value: 'switch_managed', label: 'Managed Switch' },
    { value: 'switch_unmanaged', label: 'Unmanaged Switch' },
    { value: 'switch_industrial', label: 'Industrial Switch' },
    { value: 'switch_fiber', label: 'Fiber Switch' },
    { value: 'router', label: 'Router' },
    { value: 'firewall', label: 'Firewall' },
    { value: 'wap', label: 'Wireless Access Point' },
    { value: 'media_converter', label: 'Media Converter' },
    { value: 'fiber_patch', label: 'Fiber Patch Panel' },
    { value: 'copper_patch', label: 'Copper Patch Panel' },
    { value: 'ups', label: 'UPS' },
    { value: 'pdu', label: 'PDU' },
    { value: 'rack', label: 'Rack / Cabinet' },
    { value: 'injector', label: 'PoE Injector' },
    { value: 'extender', label: 'PoE Extender' },
    { value: 'server', label: 'Server' },
    { value: 'nas', label: 'NAS' },
  ],
  av: [
    { value: 'speaker_ceiling', label: 'Ceiling Speaker' },
    { value: 'speaker_wall', label: 'Wall Speaker' },
    { value: 'speaker_horn', label: 'Horn Speaker' },
    { value: 'speaker_pendant', label: 'Pendant Speaker' },
    { value: 'speaker_subwoofer', label: 'Subwoofer' },
    { value: 'amplifier', label: 'Amplifier' },
    { value: 'dsp', label: 'DSP / Audio Processor' },
    { value: 'mixer', label: 'Mixer' },
    { value: 'microphone', label: 'Microphone' },
    { value: 'display_flat', label: 'Flat Panel Display' },
    { value: 'projector', label: 'Projector' },
    { value: 'screen', label: 'Projection Screen' },
    { value: 'codec', label: 'Video Codec / Conferencing' },
    { value: 'matrix', label: 'Matrix Switcher' },
    { value: 'transmitter', label: 'AV-over-IP TX' },
    { value: 'receiver', label: 'AV-over-IP RX' },
    { value: 'control_panel', label: 'Control Panel / Touchscreen' },
    { value: 'control_processor', label: 'Control Processor' },
  ],
  vape_environmental: [
    { value: 'vape_sensor', label: 'Vape Sensor' },
    { value: 'air_quality', label: 'Air Quality Sensor' },
    { value: 'thd_sensor', label: 'THD Sensor' },
    { value: 'noise_sensor', label: 'Noise / Sound Sensor' },
    { value: 'occupancy_sensor', label: 'Occupancy Sensor' },
    { value: 'humidity_sensor', label: 'Humidity Sensor' },
    { value: 'temperature_sensor', label: 'Temperature Sensor' },
    { value: 'co_sensor', label: 'CO Sensor' },
    { value: 'co2_sensor', label: 'CO₂ Sensor' },
    { value: 'particulate_sensor', label: 'Particulate Sensor' },
    { value: 'gunshot_sensor', label: 'Gunshot Detection Sensor' },
    { value: 'panic_button', label: 'Panic Button' },
    { value: 'tamper_sensor', label: 'Tamper Sensor' },
    { value: 'gateway', label: 'Sensor Gateway' },
  ],
  other: [
    { value: 'custom', label: 'Custom Device' },
    { value: 'legacy', label: 'Legacy Device' },
    { value: 'placeholder', label: 'Placeholder' },
  ],
}

// ---- Device Statuses ----
export const SURVEY_DEVICE_STATUSES = [
  { value: 'new', label: 'New Install', color: '#22c55e' },
  { value: 'existing_keep', label: 'Existing — Keep', color: '#3b82f6' },
  { value: 'existing_remove', label: 'Existing — Remove', color: '#ef4444' },
  { value: 'relocate', label: 'Relocate', color: '#f59e0b' },
] as const

// ---- Device Conditions ----
export const SURVEY_CONDITIONS = [
  { value: 'good', label: 'Good', color: '#22c55e' },
  { value: 'fair', label: 'Fair', color: '#f59e0b' },
  { value: 'poor', label: 'Poor', color: '#ef4444' },
  { value: 'unknown', label: 'Unknown', color: '#6b7280' },
] as const

// ---- Mount Types ----
export const SURVEY_MOUNT_TYPES = [
  { value: 'ceiling', label: 'Ceiling' },
  { value: 'wall', label: 'Wall' },
  { value: 'corner', label: 'Corner' },
  { value: 'pole', label: 'Pole' },
  { value: 'pendant', label: 'Pendant' },
  { value: 'surface', label: 'Surface' },
  { value: 'under_eave', label: 'Under-eave' },
  { value: 'parapet', label: 'Parapet' },
  { value: 'recessed', label: 'Recessed' },
  { value: 'other', label: 'Other' },
] as const

// ---- Cable Types ----
export const SURVEY_CABLE_TYPES = [
  { value: 'cat5e', label: 'Cat 5e' },
  { value: 'cat6', label: 'Cat 6' },
  { value: 'cat6a', label: 'Cat 6A' },
  { value: 'fiber_sm', label: 'Fiber — Single Mode' },
  { value: 'fiber_mm', label: 'Fiber — Multi Mode' },
  { value: 'coax_rg59', label: 'Coax RG59' },
  { value: 'coax_rg6', label: 'Coax RG6' },
  { value: 'speaker_wire', label: 'Speaker Wire' },
  { value: '18_2', label: '18/2 (Access)' },
  { value: '18_4', label: '18/4 (Access)' },
  { value: '22_4', label: '22/4 (Access)' },
  { value: '22_6', label: '22/6 (Access)' },
  { value: 'composite', label: 'Composite / Siamese' },
  { value: 'hdmi', label: 'HDMI' },
  { value: 'usb', label: 'USB' },
  { value: 'power', label: 'Power (AC/DC)' },
  { value: 'other', label: 'Other' },
] as const

// ---- Infrastructure Types ----
export const SURVEY_INFRA_TYPES = [
  { value: 'mdf', label: 'MDF' },
  { value: 'idf', label: 'IDF' },
  { value: 'conduit', label: 'Conduit / Pathway' },
  { value: 'fiber', label: 'Fiber Infrastructure' },
  { value: 'power', label: 'Power / Electrical' },
  { value: 'other', label: 'Other' },
] as const

// ---- Floor Plan Modes ----
export const SURVEY_FLOOR_PLAN_MODES = [
  { value: 'floorplan', label: 'Floor Plan Upload' },
  { value: 'satellite', label: 'Satellite Capture' },
  { value: 'grid', label: 'Grid / Sketch' },
] as const

// ---- Survey Statuses ----
export const SURVEY_STATUSES = [
  { value: 'draft', label: 'Draft', color: '#6b7280' },
  { value: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { value: 'submitted', label: 'Submitted', color: '#22c55e' },
] as const

// ---- Resolution Options ----
export const SURVEY_RESOLUTIONS = [
  '1MP (720p)', '2MP (1080p)', '4MP (1440p)', '5MP', '6MP',
  '8MP (4K)', '12MP', '16MP', '20MP', '32MP', 'Other',
] as const

// ---- Vape / Environmental Detection Capabilities ----
export const VAPE_DETECTION_CAPABILITIES = [
  { value: 'vape_nicotine', label: 'Vape — Nicotine' },
  { value: 'vape_thc', label: 'Vape — THC' },
  { value: 'vape_general', label: 'Vape — General' },
  { value: 'smoke', label: 'Smoke Detection' },
  { value: 'co', label: 'Carbon Monoxide (CO)' },
  { value: 'co2', label: 'Carbon Dioxide (CO₂)' },
  { value: 'particulate', label: 'Particulate Matter' },
  { value: 'tvoc', label: 'Total VOC' },
  { value: 'noise', label: 'Noise Level' },
  { value: 'aggression', label: 'Aggression / Keywords' },
  { value: 'occupancy', label: 'Occupancy Count' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'humidity', label: 'Humidity' },
  { value: 'light', label: 'Light Level' },
  { value: 'tamper', label: 'Tamper Detection' },
] as const

// ---- ACS Door Config Defaults ----
export const DOOR_TYPES = [
  'Single', 'Double', 'Sliding', 'Revolving', 'Gate', 'Turnstile', 'Elevator', 'Other',
] as const

export const LOCK_TYPES = [
  'Electric Strike', 'Magnetic Lock', 'Electrified Mortise', 'Electrified Lever',
  'Wireless Lock', 'Crash Bar', 'Auto Operator', 'None', 'Other',
] as const

// ---- Auto Label Generator ----
let _labelCounters: Record<string, number> = {}

export function resetLabelCounters() {
  _labelCounters = {}
}

export function generateDeviceLabel(systemType: string, deviceType: string, existingLabels: string[]): string {
  const sys = SURVEY_SYSTEM_TYPES.find(s => s.value === systemType)
  const prefix = sys ? sys.label.replace(/\s*\/\s*/g, '-').replace(/\s+/g, '-').substring(0, 4).toUpperCase() : 'DEV'

  const key = `${systemType}_${deviceType}`
  if (!_labelCounters[key]) {
    // Count existing labels with this prefix pattern
    const pattern = new RegExp(`^${prefix}-\\d+$`)
    const existing = existingLabels.filter(l => pattern.test(l))
    _labelCounters[key] = existing.length
  }
  _labelCounters[key]++
  return `${prefix}-${String(_labelCounters[key]).padStart(3, '0')}`
}

// ---- System Type Colors for Canvas Markers ----
export const SYSTEM_TYPE_COLORS: Record<string, string> = {
  cctv: '#3b82f6',
  access_control: '#f59e0b',
  network: '#8b5cf6',
  av: '#ec4899',
  vape_environmental: '#14b8a6',
  other: '#6b7280',
}

// ---- Default FOV per CCTV device type ----
export const DEFAULT_FOV_ANGLES: Record<string, number> = {
  camera_fixed: 90,
  camera_ptz: 60,
  camera_dome: 90,
  camera_bullet: 80,
  camera_turret: 90,
  camera_multisensor: 90,
  camera_panoramic: 180,
  camera_fisheye: 360,
  camera_lpr: 30,
  camera_thermal: 50,
}

// ---- Risk Assessment Weights ----
export const RISK_WEIGHTS = {
  cctv: 0.25,
  access_control: 0.25,
  equipment: 0.20,
  installation: 0.30,
} as const
