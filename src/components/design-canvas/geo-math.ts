/**
 * Geo-Math Utilities for Google Maps–based design canvas.
 *
 * Phase A — single geographic model (keep all map/canvas conversions here):
 *   - Canvas pixels: `position_x` / `position_y` from DB (origin top-left of canvas space).
 *   - Scale: `scalePxPerFt` (pixels per foot) — user-calibrated; ties pixels to ground distance.
 *   - Anchor: geocoded area center (`satellite_lat` / `satellite_lng`) = “job site” origin for lat/lng.
 *   - Use `buildDesignGeoContext` + `canvasPixelsToLatLng` / `latLngToCanvasPixels` for any map overlay (Phase B).
 *
 * Converts between:
 *   - Canvas pixel coordinates (position_x / position_y)
 *   - Ground feet (via scalePxPerFt)
 *   - Google Maps lat/lng (via equirectangular offset from anchor)
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

// ---- Phase A: canonical design ↔ lat/lng (single entry point for overlays) ----

/** Geographic + scale context for the active design area (satellite center + user scale). */
export interface DesignGeoContext {
  centerLat: number
  centerLng: number
  scalePxPerFt: number
}

/**
 * Build context when satellite coords exist and scale is valid. Returns null without a map anchor.
 */
export function buildDesignGeoContext(
  satellite: { lat: number; lng: number } | null | undefined,
  scalePxPerFt: number,
): DesignGeoContext | null {
  if (!satellite || scalePxPerFt <= 0) return null
  return { centerLat: satellite.lat, centerLng: satellite.lng, scalePxPerFt }
}

/** Device/canvas pixel position → lat/lng using the active area anchor (Phase B map polygons). */
export function canvasPixelsToLatLng(
  px: number,
  py: number,
  ctx: DesignGeoContext,
): { lat: number; lng: number } {
  return pixelToLatLng(px, py, ctx.centerLat, ctx.centerLng, ctx.scalePxPerFt)
}

/** lat/lng → canvas pixels relative to the same anchor. */
export function latLngToCanvasPixels(
  lat: number,
  lng: number,
  ctx: DesignGeoContext,
): { x: number; y: number } {
  return latLngToPixel(lat, lng, ctx.centerLat, ctx.centerLng, ctx.scalePxPerFt)
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

  // Canvas 0° = East (clockwise); Maps bearing 0° = North (clockwise) → +90° offset.
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

/**
 * Ground radius (feet) to use for `google.maps.Polygon` so on-screen size matches Fabric FOV.
 *
 * Canvas draws radius in scene pixels ≈ `distanceFt * scalePxPerFt`. The map uses Web Mercator
 * `feetPerPixelAtZoom(effectiveGoogleZoom, lat)`. Pass `effectiveGoogleZoom = baseSatelliteZoom +
 * log2(fabricViewportZoom)` for the ratio; `SatelliteMap` keeps the map at `baseSatelliteZoom` and
 * applies Fabric’s viewport as a CSS `matrix()` (see `use-map-fov-polygons` `radiusScale`).
 */
export function alignMapConeRadiusFeet(
  distanceFt: number,
  scalePxPerFt: number,
  effectiveGoogleZoom: number,
  atLat: number,
): number {
  if (distanceFt <= 0 || scalePxPerFt <= 0) return distanceFt
  const fCanvas = 1 / scalePxPerFt
  const fMap = feetPerPixelAtZoom(effectiveGoogleZoom, atLat)
  if (fCanvas <= 0 || fMap <= 0 || !Number.isFinite(fMap)) return distanceFt
  return distanceFt * (fMap / fCanvas)
}
