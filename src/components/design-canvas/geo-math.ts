/**
 * Geo-Math Utilities for Google Maps–based design canvas.
 *
 * Converts between:
 *   - Canvas "design coordinates" (feet from design origin)
 *   - Google Maps lat/lng coordinates
 *   - Pixel coordinates (for legacy position_x / position_y)
 *
 * Generates FOV cone polygons as lat/lng arrays for Google Maps Polygon.
 */

// ---- Constants ----

const EARTH_RADIUS_FT = 20_902_231 // Mean earth radius in feet
const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI
const FT_PER_METER = 3.28084

// ---- Coordinate Conversion ----

/**
 * Offset a lat/lng point by a distance in feet along X (east) and Y (north).
 * Uses simple equirectangular approximation (accurate to ~1ft at <5km distances).
 */
export function offsetLatLng(
  lat: number,
  lng: number,
  dxFt: number,
  dyFt: number,
): { lat: number; lng: number } {
  const dLat = (dyFt / EARTH_RADIUS_FT) * RAD_TO_DEG
  const dLng = (dxFt / (EARTH_RADIUS_FT * Math.cos(lat * DEG_TO_RAD))) * RAD_TO_DEG
  return { lat: lat + dLat, lng: lng + dLng }
}

/**
 * Calculate distance in feet between two lat/lng points.
 * Uses Haversine formula.
 */
export function distanceFt(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD
  const dLng = (lng2 - lng1) * DEG_TO_RAD
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_FT * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Calculate bearing (degrees, clockwise from north) from point A to point B.
 */
export function bearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLng = (lng2 - lng1) * DEG_TO_RAD
  const y = Math.sin(dLng) * Math.cos(lat2 * DEG_TO_RAD)
  const x = Math.cos(lat1 * DEG_TO_RAD) * Math.sin(lat2 * DEG_TO_RAD) -
    Math.sin(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.cos(dLng)
  return ((Math.atan2(y, x) * RAD_TO_DEG) + 360) % 360
}

/**
 * Move from a lat/lng point along a bearing for a given distance.
 * Uses destination point formula.
 */
export function destinationPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  distFt: number,
): { lat: number; lng: number } {
  const d = distFt / EARTH_RADIUS_FT
  const brng = bearingDeg * DEG_TO_RAD
  const lat1 = lat * DEG_TO_RAD
  const lng1 = lng * DEG_TO_RAD
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  )
  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  )
  return { lat: lat2 * RAD_TO_DEG, lng: lng2 * RAD_TO_DEG }
}

// ---- Legacy pixel ↔ lat/lng conversion ----

/**
 * Convert legacy pixel coordinates (position_x, position_y) to lat/lng.
 *
 * The design has a center point (from the design record or first floor plan).
 * position_x/position_y are pixel offsets from the canvas origin.
 * scalePxPerFt converts pixels to feet.
 *
 * Convention: +X = East, +Y = South (screen coords: Y increases downward)
 */
export function pixelToLatLng(
  px: number,
  py: number,
  centerLat: number,
  centerLng: number,
  scalePxPerFt: number,
): { lat: number; lng: number } {
  if (scalePxPerFt <= 0) return { lat: centerLat, lng: centerLng }
  const dxFt = px / scalePxPerFt
  const dyFt = -py / scalePxPerFt // Negative because screen Y is inverted vs north
  return offsetLatLng(centerLat, centerLng, dxFt, dyFt)
}

/**
 * Convert lat/lng back to pixel coordinates relative to a center point.
 */
export function latLngToPixel(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  scalePxPerFt: number,
): { x: number; y: number } {
  const dLng = lng - centerLng
  const dLat = lat - centerLat
  const dxFt = dLng * DEG_TO_RAD * EARTH_RADIUS_FT * Math.cos(centerLat * DEG_TO_RAD)
  const dyFt = dLat * DEG_TO_RAD * EARTH_RADIUS_FT
  return {
    x: dxFt * scalePxPerFt,
    y: -dyFt * scalePxPerFt, // Screen Y is inverted
  }
}

// ---- FOV Cone Polygon Generation ----

export interface FovConeOptions {
  /** Camera lat/lng */
  lat: number
  lng: number
  /** Camera rotation in degrees (0 = East, clockwise) — canvas convention */
  rotationDeg: number
  /** Horizontal field of view in degrees */
  hFovDeg: number
  /** Cone radius in feet */
  radiusFt: number
  /** Number of arc steps (default 32 for smooth arc) */
  steps?: number
}

/**
 * Generate a FOV cone polygon as an array of lat/lng points.
 * The cone is a sector (pie slice) originating at the camera position.
 *
 * NOTE: Canvas rotation convention is 0=East, clockwise.
 * Google Maps bearing convention is 0=North, clockwise.
 * We convert internally.
 */
export function generateFovConePolygon(opts: FovConeOptions): Array<{ lat: number; lng: number }> {
  const { lat, lng, rotationDeg, hFovDeg, radiusFt, steps = 32 } = opts
  if (radiusFt < 0.5 || hFovDeg < 1) return []

  // Convert canvas rotation (0=East CW) to map bearing (0=North CW)
  const centerBearing = (rotationDeg + 90) % 360 // Canvas 0°=East → Map 90°=East
  // Wait, let me think about this:
  // Canvas: 0° = pointing right (East), increases clockwise
  // Google Maps bearing: 0° = North, increases clockwise
  // To convert: mapBearing = canvasRotation - 90 (since East=0 in canvas = 90 in map)
  // But actually canvas convention here might be different. Let me use the standard:
  // canvasRotation 0 = East, so mapBearing = 90 + canvasRotation... no.
  // Actually: canvas 0° pointing East means mapBearing should be 90°
  // canvas 90° (pointing South in canvas) = mapBearing 180°
  // So: mapBearing = canvasRotation + 90
  // BUT wait, in the original Fabric code, rotation 0 means pointing RIGHT (East).
  // Let me verify from the original code...
  // In canvas-area.tsx: `const a = sRotRad - halfAng + (2 * halfAng * i / steps)`
  // where sRotRad = rotation * Math.PI / 180, and cos(a)*r gives x, sin(a)*r gives y
  // In screen space: cos(0)=right(east), sin(0)=0, cos(90°)=0, sin(90°)=down(south)
  // So canvas rotation 0 = East, rotation 90 = South (screen down)
  // Google Maps: bearing 0 = North, bearing 90 = East
  // Convert: mapBearing = canvasRotation + 90... but canvas 0=East should be map 90
  // mapBearing = canvasRotation + 90? canvas 0 → 90 ✓, canvas 90 → 180 ✓
  // Actually no. Canvas rotation 0 = East. Map bearing 90 = East. So offset = +90.
  // But canvas rotation increases clockwise in screen space, where Y goes down.
  // In screen: angle 0 = right, 90 = down. In map: bearing 0 = north, 90 = east.
  // Screen "down" = map "south" = bearing 180.
  // So canvas 90 (down/south) should map to bearing 180. 90 + 90 = 180 ✓

  const mapCenterBearing = (rotationDeg + 90 + 360) % 360
  const halfFov = hFovDeg / 2

  const pts: Array<{ lat: number; lng: number }> = []

  // Start at camera position (cone origin)
  pts.push({ lat, lng })

  // Arc points from -halfFov to +halfFov around center bearing
  for (let i = 0; i <= steps; i++) {
    const angleDeg = mapCenterBearing - halfFov + (hFovDeg * i / steps)
    const pt = destinationPoint(lat, lng, angleDeg, radiusFt)
    pts.push(pt)
  }

  // Close back to camera
  pts.push({ lat, lng })

  return pts
}

/**
 * Generate a circle as a polygon (for PTZ pan range or blind spot).
 */
export function generateCirclePolygon(
  lat: number,
  lng: number,
  radiusFt: number,
  steps: number = 36,
): Array<{ lat: number; lng: number }> {
  const pts: Array<{ lat: number; lng: number }> = []
  for (let i = 0; i <= steps; i++) {
    const bearing = (360 * i) / steps
    pts.push(destinationPoint(lat, lng, bearing, radiusFt))
  }
  return pts
}

// ---- Map zoom ↔ scale conversion ----

/**
 * Calculate approximate feet-per-pixel at a given zoom level and latitude.
 * Google Maps zoom level 0 = 256px covers the whole world (40,075 km).
 */
export function feetPerPixelAtZoom(zoom: number, lat: number): number {
  const metersPerPixel = (40_075_016.686 * Math.cos(lat * DEG_TO_RAD)) / (256 * Math.pow(2, zoom))
  return metersPerPixel * FT_PER_METER
}

/**
 * Calculate the zoom level needed for a given feet-per-pixel.
 */
export function zoomForFeetPerPixel(fpp: number, lat: number): number {
  const mpp = fpp / FT_PER_METER
  return Math.log2((40_075_016.686 * Math.cos(lat * DEG_TO_RAD)) / (256 * mpp))
}
