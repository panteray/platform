/**
 * Polygon Clipping for Wall Occlusion — Google Maps version.
 *
 * Clips FOV cone polygons against wall segments using the
 * Sutherland–Hodgman algorithm. This is a proper polygon boolean
 * operation, replacing the per-point ray-cast hack from the Fabric version.
 *
 * Works in lat/lng space (small enough areas that equirectangular is fine).
 */

interface Point {
  lat: number
  lng: number
}

interface WallSegment {
  a: Point
  b: Point
}

/**
 * Clip a polygon against a single line (half-plane clipping).
 * Keeps the side of the line where the camera is located.
 *
 * Uses Sutherland–Hodgman single-edge clip.
 */
function clipPolygonByHalfPlane(
  polygon: Point[],
  wallA: Point,
  wallB: Point,
  cameraInside: boolean,
): Point[] {
  if (polygon.length < 3) return polygon

  // Wall edge vector
  const edgeDx = wallB.lng - wallA.lng
  const edgeDy = wallB.lat - wallA.lat

  function side(p: Point): number {
    return edgeDx * (p.lat - wallA.lat) - edgeDy * (p.lng - wallA.lng)
  }

  // Determine which side the camera is on
  const insideSign = cameraInside ? 1 : -1

  function isInside(p: Point): boolean {
    return side(p) * insideSign >= 0
  }

  function intersect(p1: Point, p2: Point): Point {
    const s1 = side(p1)
    const s2 = side(p2)
    const t = s1 / (s1 - s2)
    return {
      lat: p1.lat + t * (p2.lat - p1.lat),
      lng: p1.lng + t * (p2.lng - p1.lng),
    }
  }

  const output: Point[] = []
  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i]
    const next = polygon[(i + 1) % polygon.length]
    const curIn = isInside(current)
    const nextIn = isInside(next)

    if (curIn) {
      output.push(current)
      if (!nextIn) {
        output.push(intersect(current, next))
      }
    } else if (nextIn) {
      output.push(intersect(current, next))
    }
  }

  return output
}

/**
 * Clip a FOV cone polygon against all wall segments.
 * The camera position determines which side of each wall to keep.
 *
 * @param polygon - The FOV cone polygon points (lat/lng)
 * @param walls - Array of wall definitions with point arrays
 * @param camera - Camera position (lat/lng) — always on the "keep" side
 * @returns Clipped polygon points
 */
export function clipFovByWalls(
  polygon: Point[],
  walls: Array<{ id: string; points: Array<{ lat: number; lng: number }> }>,
  camera: Point,
): Point[] {
  if (!walls || walls.length === 0 || polygon.length < 3) return polygon

  let clipped = [...polygon]

  for (const wall of walls) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      const wallA = wall.points[i]
      const wallB = wall.points[i + 1]

      // Determine which side the camera is on
      const edgeDx = wallB.lng - wallA.lng
      const edgeDy = wallB.lat - wallA.lat
      const camSide = edgeDx * (camera.lat - wallA.lat) - edgeDy * (camera.lng - wallA.lng)

      if (Math.abs(camSide) < 1e-12) continue // Camera is ON the wall line, skip

      clipped = clipPolygonByHalfPlane(clipped, wallA, wallB, camSide > 0)

      if (clipped.length < 3) return clipped // Fully clipped away
    }
  }

  return clipped
}

/**
 * Check if a point is inside a polygon (for PPF-at-cursor).
 * Uses ray casting algorithm.
 */
export function pointInPolygon(
  point: Point,
  polygon: Point[],
): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat
    const xj = polygon[j].lng, yj = polygon[j].lat

    if (((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Distance from a point to the nearest point on a line segment.
 * Returns distance in approximate feet using equirectangular.
 */
export function pointToSegmentDistanceFt(
  point: Point,
  segA: Point,
  segB: Point,
): number {
  const dx = segB.lng - segA.lng
  const dy = segB.lat - segA.lat
  const len2 = dx * dx + dy * dy
  if (len2 === 0) {
    // Degenerate segment
    const dlat = point.lat - segA.lat
    const dlng = point.lng - segA.lng
    return Math.sqrt(dlat * dlat + dlng * dlng) * 364_000 // Very rough lat-degree to feet
  }
  let t = ((point.lng - segA.lng) * dx + (point.lat - segA.lat) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const projLng = segA.lng + t * dx
  const projLat = segA.lat + t * dy
  const dlat = (point.lat - projLat) * 364_000
  const dlng = (point.lng - projLng) * 364_000 * Math.cos(point.lat * Math.PI / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}
