/**
 * Wall Occlusion for FOV Cones — Google Maps version.
 *
 * Uses ray-casting from the camera through each FOV polygon vertex.
 * If a ray intersects a wall segment, the vertex is moved to the
 * intersection point (the wall blocks the view beyond it).
 *
 * This correctly handles finite wall segments — FOV wraps around
 * wall endpoints instead of being cut by an infinite half-plane.
 *
 * Works in lat/lng space (small enough areas that equirectangular is fine).
 */

interface Point {
  lat: number
  lng: number
}

/**
 * Test if ray from `origin` through `dir` intersects segment A→B.
 * Returns the parametric t along the ray (0..1 = within FOV distance),
 * or null if no intersection.
 *
 * Uses 2D cross-product method in lat/lng space.
 */
function raySegmentIntersect(
  origin: Point,
  target: Point,
  segA: Point,
  segB: Point,
): number | null {
  const dx = target.lng - origin.lng
  const dy = target.lat - origin.lat
  const sx = segB.lng - segA.lng
  const sy = segB.lat - segA.lat

  const denom = dx * sy - dy * sx
  if (Math.abs(denom) < 1e-14) return null // parallel

  const t = ((segA.lng - origin.lng) * sy - (segA.lat - origin.lat) * sx) / denom
  const u = ((segA.lng - origin.lng) * dy - (segA.lat - origin.lat) * dx) / denom

  // t must be > 0 (in front of camera) and <= 1 (within FOV range)
  // u must be in [0, 1] (on the wall segment, not the infinite line)
  if (t > 0.001 && t <= 1.0 && u >= 0 && u <= 1) {
    return t
  }
  return null
}

/**
 * Clip an FOV cone polygon against wall segments using ray-casting.
 *
 * For each vertex of the FOV polygon (except the camera/apex point),
 * cast a ray from the camera. If it hits a wall segment before reaching
 * the vertex, move the vertex to the intersection point.
 *
 * The first point of the polygon is assumed to be the camera position
 * (cone apex). It is never clipped.
 *
 * @param polygon - FOV cone polygon (first point = camera apex)
 * @param walls - Array of walls with point arrays
 * @param camera - Camera position (lat/lng)
 * @returns Occluded polygon
 */
export function clipFovByWalls(
  polygon: Point[],
  walls: Array<{ id: string; points: Array<{ lat: number; lng: number }> }>,
  camera: Point,
): Point[] {
  if (!walls || walls.length === 0 || polygon.length < 3) return polygon

  // Collect all wall segments
  const segments: Array<{ a: Point; b: Point }> = []
  for (const wall of walls) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      segments.push({ a: wall.points[i], b: wall.points[i + 1] })
    }
  }
  if (segments.length === 0) return polygon

  // For each polygon vertex, ray-cast from camera and check wall intersections
  const result: Point[] = []

  for (let i = 0; i < polygon.length; i++) {
    const vertex = polygon[i]

    // Skip if this vertex IS the camera (apex of the cone — distance ~0)
    const distToCam = Math.sqrt(
      (vertex.lat - camera.lat) ** 2 + (vertex.lng - camera.lng) ** 2
    )
    if (distToCam < 1e-10) {
      result.push(vertex)
      continue
    }

    // Cast ray from camera to this vertex — find nearest wall intersection
    let nearestT = 1.0 // 1.0 = full distance to vertex (no obstruction)

    for (const seg of segments) {
      const t = raySegmentIntersect(camera, vertex, seg.a, seg.b)
      if (t !== null && t < nearestT) {
        nearestT = t
      }
    }

    if (nearestT < 0.999) {
      // Wall blocks before vertex — move vertex to intersection point
      result.push({
        lat: camera.lat + nearestT * (vertex.lat - camera.lat),
        lng: camera.lng + nearestT * (vertex.lng - camera.lng),
      })
    } else {
      // No wall in the way — keep original vertex
      result.push(vertex)
    }
  }

  return result
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
