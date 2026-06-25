/**
 * G8: SVG device markers for survey canvas.
 *
 * One SVG per common device type. Scope doc requires SVG shapes
 * (not emoji, not generic badges). Icons are monochromatic — color is
 * injected from the calling canvas via the `color` prop.
 *
 * All icons render inside a 24×24 box, centered at (12,12). The parent
 * wrapper in SurveyCanvas handles positioning + selection styling.
 */

type IconProps = { color: string; size?: number }

// ─── CCTV ────────────────────────────────────────────────────────────────
function CameraFixed({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="8" width="14" height="8" rx="1" fill={color} stroke="#fff" strokeWidth="1.2" />
      <rect x="18" y="10" width="2" height="4" fill={color} stroke="#fff" strokeWidth="1" />
      <circle cx="7" cy="12" r="1.2" fill="#fff" />
    </svg>
  )
}

function CameraDome({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 14 A8 8 0 0 1 20 14 Z" fill={color} stroke="#fff" strokeWidth="1.2" />
      <circle cx="12" cy="13" r="2.2" fill="#fff" opacity="0.85" />
      <rect x="4" y="14" width="16" height="2" fill={color} opacity="0.7" />
    </svg>
  )
}

function CameraPtz({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" fill={color} stroke="#fff" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="3" fill="#fff" />
      <path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function CameraMulti({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill={color} stroke="#fff" strokeWidth="1.2" />
      <circle cx="8" cy="9" r="2" fill="#fff" />
      <circle cx="16" cy="9" r="2" fill="#fff" />
      <circle cx="8" cy="15" r="2" fill="#fff" />
      <circle cx="16" cy="15" r="2" fill="#fff" />
    </svg>
  )
}

// ─── ACCESS CONTROL ─────────────────────────────────────────────────────
function Door({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="12" height="18" fill={color} stroke="#fff" strokeWidth="1.2" />
      <circle cx="14" cy="12" r="1.2" fill="#fff" />
      <rect x="17" y="8" width="4" height="6" rx="0.5" fill={color} stroke="#fff" strokeWidth="1" />
    </svg>
  )
}

function Reader({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="7" y="4" width="10" height="16" rx="1.5" fill={color} stroke="#fff" strokeWidth="1.2" />
      <circle cx="12" cy="10" r="2.2" fill="#fff" />
      <rect x="9" y="14" width="6" height="1.4" fill="#fff" />
      <rect x="9" y="16.5" width="6" height="1.4" fill="#fff" />
    </svg>
  )
}

function Controller({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="1" fill={color} stroke="#fff" strokeWidth="1.2" />
      <rect x="5" y="8" width="3" height="2" fill="#fff" />
      <rect x="9" y="8" width="3" height="2" fill="#fff" />
      <rect x="13" y="8" width="3" height="2" fill="#fff" />
      <circle cx="6.5" cy="14" r="0.8" fill="#fff" />
      <circle cx="9" cy="14" r="0.8" fill="#fff" />
      <circle cx="11.5" cy="14" r="0.8" fill="#fff" />
    </svg>
  )
}

// ─── SERVERS / NVR ──────────────────────────────────────────────────────
function ServerRack({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="1" fill={color} stroke="#fff" strokeWidth="1.2" />
      <rect x="6" y="5" width="12" height="3" fill="#fff" opacity="0.25" />
      <circle cx="7.5" cy="6.5" r="0.6" fill="#fff" />
      <rect x="6" y="9.5" width="12" height="3" fill="#fff" opacity="0.25" />
      <circle cx="7.5" cy="11" r="0.6" fill="#fff" />
      <rect x="6" y="14" width="12" height="3" fill="#fff" opacity="0.25" />
      <circle cx="7.5" cy="15.5" r="0.6" fill="#fff" />
    </svg>
  )
}

// ─── NETWORK ────────────────────────────────────────────────────────────
function NetworkSwitch({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="8" width="20" height="8" rx="1" fill={color} stroke="#fff" strokeWidth="1.2" />
      {[4, 7, 10, 13, 16, 19].map((x) => (
        <rect key={x} x={x} y="10" width="1.6" height="4" fill="#fff" />
      ))}
    </svg>
  )
}

function WifiAp({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="16" r="3" fill={color} stroke="#fff" strokeWidth="1.2" />
      <path d="M6 12 A8 8 0 0 1 18 12" stroke={color} strokeWidth="1.8" fill="none" />
      <path d="M9 14 A4 4 0 0 1 15 14" stroke={color} strokeWidth="1.6" fill="none" />
    </svg>
  )
}

// ─── AV ─────────────────────────────────────────────────────────────────
function Speaker({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="1.5" fill={color} stroke="#fff" strokeWidth="1.2" />
      <circle cx="12" cy="9" r="2" fill="#fff" />
      <circle cx="12" cy="15" r="3" fill="#fff" />
      <circle cx="12" cy="15" r="1.2" fill={color} />
    </svg>
  )
}

function Display({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="13" rx="1" fill={color} stroke="#fff" strokeWidth="1.2" />
      <rect x="4" y="7" width="16" height="9" fill="#fff" opacity="0.15" />
      <rect x="9" y="19" width="6" height="1.4" fill="#fff" />
    </svg>
  )
}

// ─── VAPE / ENVIRONMENTAL ───────────────────────────────────────────────
function VapeSensor({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill={color} stroke="#fff" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="#fff" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="2" fill="#fff" />
    </svg>
  )
}

// ─── OTHER ──────────────────────────────────────────────────────────────
function GenericDevice({ color, size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="2" fill={color} stroke="#fff" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="3" fill="#fff" />
    </svg>
  )
}

// ─── Raw SVG strings (for Google Maps marker icons) ─────────────────────
// Parallel to the React components above — returns an SVG string for use
// as a data URL on a `google.maps.Marker`. Keep shape parity with the
// corresponding React component.

function svgRoot(body: string, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">${body}</svg>`
}

function rawCameraFixed(color: string, size: number) {
  return svgRoot(
    `<rect x="4" y="8" width="14" height="8" rx="1" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<rect x="18" y="10" width="2" height="4" fill="${color}" stroke="#fff" stroke-width="1"/>` +
    `<circle cx="7" cy="12" r="1.2" fill="#fff"/>`,
    size,
  )
}
function rawCameraDome(color: string, size: number) {
  return svgRoot(
    `<path d="M4 14 A8 8 0 0 1 20 14 Z" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<circle cx="12" cy="13" r="2.2" fill="#fff" opacity="0.85"/>` +
    `<rect x="4" y="14" width="16" height="2" fill="${color}" opacity="0.7"/>`,
    size,
  )
}
function rawCameraPtz(color: string, size: number) {
  return svgRoot(
    `<circle cx="12" cy="12" r="8" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<circle cx="12" cy="12" r="3" fill="#fff"/>` +
    `<path d="M12 2 L12 5 M12 19 L12 22 M2 12 L5 12 M19 12 L22 12" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`,
    size,
  )
}
function rawCameraMulti(color: string, size: number) {
  return svgRoot(
    `<circle cx="12" cy="12" r="9" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<circle cx="8" cy="9" r="2" fill="#fff"/><circle cx="16" cy="9" r="2" fill="#fff"/>` +
    `<circle cx="8" cy="15" r="2" fill="#fff"/><circle cx="16" cy="15" r="2" fill="#fff"/>`,
    size,
  )
}
function rawDoor(color: string, size: number) {
  return svgRoot(
    `<rect x="5" y="3" width="12" height="18" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<circle cx="14" cy="12" r="1.2" fill="#fff"/>` +
    `<rect x="17" y="8" width="4" height="6" rx="0.5" fill="${color}" stroke="#fff" stroke-width="1"/>`,
    size,
  )
}
function rawReader(color: string, size: number) {
  return svgRoot(
    `<rect x="7" y="4" width="10" height="16" rx="1.5" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<circle cx="12" cy="10" r="2.2" fill="#fff"/>` +
    `<rect x="9" y="14" width="6" height="1.4" fill="#fff"/>` +
    `<rect x="9" y="16.5" width="6" height="1.4" fill="#fff"/>`,
    size,
  )
}
function rawController(color: string, size: number) {
  return svgRoot(
    `<rect x="3" y="6" width="18" height="12" rx="1" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<rect x="5" y="8" width="3" height="2" fill="#fff"/><rect x="9" y="8" width="3" height="2" fill="#fff"/>` +
    `<rect x="13" y="8" width="3" height="2" fill="#fff"/>` +
    `<circle cx="6.5" cy="14" r="0.8" fill="#fff"/><circle cx="9" cy="14" r="0.8" fill="#fff"/>` +
    `<circle cx="11.5" cy="14" r="0.8" fill="#fff"/>`,
    size,
  )
}
function rawServerRack(color: string, size: number) {
  return svgRoot(
    `<rect x="4" y="3" width="16" height="18" rx="1" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<rect x="6" y="5" width="12" height="3" fill="#fff" opacity="0.25"/>` +
    `<circle cx="7.5" cy="6.5" r="0.6" fill="#fff"/>` +
    `<rect x="6" y="9.5" width="12" height="3" fill="#fff" opacity="0.25"/>` +
    `<circle cx="7.5" cy="11" r="0.6" fill="#fff"/>` +
    `<rect x="6" y="14" width="12" height="3" fill="#fff" opacity="0.25"/>` +
    `<circle cx="7.5" cy="15.5" r="0.6" fill="#fff"/>`,
    size,
  )
}
function rawSwitch(color: string, size: number) {
  const ports = [4, 7, 10, 13, 16, 19].map(x => `<rect x="${x}" y="10" width="1.6" height="4" fill="#fff"/>`).join('')
  return svgRoot(
    `<rect x="2" y="8" width="20" height="8" rx="1" fill="${color}" stroke="#fff" stroke-width="1.2"/>${ports}`,
    size,
  )
}
function rawWifiAp(color: string, size: number) {
  return svgRoot(
    `<circle cx="12" cy="16" r="3" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<path d="M6 12 A8 8 0 0 1 18 12" stroke="${color}" stroke-width="1.8" fill="none"/>` +
    `<path d="M9 14 A4 4 0 0 1 15 14" stroke="${color}" stroke-width="1.6" fill="none"/>`,
    size,
  )
}
function rawSpeaker(color: string, size: number) {
  return svgRoot(
    `<rect x="5" y="3" width="14" height="18" rx="1.5" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<circle cx="12" cy="9" r="2" fill="#fff"/>` +
    `<circle cx="12" cy="15" r="3" fill="#fff"/><circle cx="12" cy="15" r="1.2" fill="${color}"/>`,
    size,
  )
}
function rawDisplay(color: string, size: number) {
  return svgRoot(
    `<rect x="2" y="5" width="20" height="13" rx="1" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<rect x="4" y="7" width="16" height="9" fill="#fff" opacity="0.15"/>` +
    `<rect x="9" y="19" width="6" height="1.4" fill="#fff"/>`,
    size,
  )
}
function rawVape(color: string, size: number) {
  return svgRoot(
    `<circle cx="12" cy="12" r="9" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="1.4"/>` +
    `<circle cx="12" cy="12" r="2" fill="#fff"/>`,
    size,
  )
}
function rawGeneric(color: string, size: number) {
  return svgRoot(
    `<rect x="4" y="4" width="16" height="16" rx="2" fill="${color}" stroke="#fff" stroke-width="1.2"/>` +
    `<circle cx="12" cy="12" r="3" fill="#fff"/>`,
    size,
  )
}

export function surveyDeviceSvgString(
  systemType: string,
  deviceType: string,
  color: string,
  size = 28,
): string {
  if (systemType === 'cctv') {
    if (deviceType.includes('dome')) return rawCameraDome(color, size)
    if (deviceType.includes('ptz')) return rawCameraPtz(color, size)
    if (deviceType.includes('multi') || deviceType.includes('fisheye') || deviceType.includes('panoramic')) return rawCameraMulti(color, size)
    return rawCameraFixed(color, size)
  }
  if (systemType === 'access_control') {
    if (deviceType.includes('reader')) return rawReader(color, size)
    if (deviceType.includes('controller') || deviceType.includes('panel')) return rawController(color, size)
    return rawDoor(color, size)
  }
  if (systemType === 'network') {
    if (deviceType.includes('wap') || deviceType.includes('wifi') || deviceType.includes('ap')) return rawWifiAp(color, size)
    return rawSwitch(color, size)
  }
  if (systemType === 'av') {
    if (deviceType.includes('display') || deviceType.includes('tv') || deviceType.includes('projector') || deviceType.includes('screen')) {
      return rawDisplay(color, size)
    }
    return rawSpeaker(color, size)
  }
  if (systemType === 'vape_environmental') return rawVape(color, size)
  if (systemType === 'servers_nvr') return rawServerRack(color, size)
  return rawGeneric(color, size)
}

export function surveyDeviceIconDataUrl(
  systemType: string,
  deviceType: string,
  color: string,
  size = 28,
  selected = false,
): string {
  let svg = surveyDeviceSvgString(systemType, deviceType, color, size)
  if (selected) {
    const ring = `<circle cx="12" cy="12" r="11.5" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.9"/>`
    svg = svg.replace('</svg>', `${ring}</svg>`)
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Resolve an SVG icon component for a survey device by system+device type.
 * Falls back to a generic square for unknown types.
 */
export function SurveyDeviceIcon({
  systemType,
  deviceType,
  color,
  size = 24,
}: {
  systemType: string
  deviceType: string
  color: string
  size?: number
}) {
  const key = `${systemType}:${deviceType}`

  // CCTV
  if (systemType === 'cctv') {
    if (deviceType.includes('dome')) return <CameraDome color={color} size={size} />
    if (deviceType.includes('ptz')) return <CameraPtz color={color} size={size} />
    if (deviceType.includes('multi') || deviceType.includes('fisheye')) return <CameraMulti color={color} size={size} />
    return <CameraFixed color={color} size={size} />
  }

  // Access control
  if (systemType === 'access_control') {
    if (deviceType.includes('reader')) return <Reader color={color} size={size} />
    if (deviceType.includes('controller') || deviceType.includes('panel')) return <Controller color={color} size={size} />
    return <Door color={color} size={size} />
  }

  // Network
  if (systemType === 'network') {
    if (deviceType.includes('ap') || deviceType.includes('wifi')) return <WifiAp color={color} size={size} />
    return <NetworkSwitch color={color} size={size} />
  }

  // AV
  if (systemType === 'av') {
    if (deviceType.includes('display') || deviceType.includes('tv') || deviceType.includes('projector')) {
      return <Display color={color} size={size} />
    }
    return <Speaker color={color} size={size} />
  }

  // Vape / environmental
  if (systemType === 'vape_environmental') {
    return <VapeSensor color={color} size={size} />
  }

  // Servers / NVR
  if (systemType === 'servers_nvr') {
    return <ServerRack color={color} size={size} />
  }

  // Fallback
  void key
  return <GenericDevice color={color} size={size} />
}
