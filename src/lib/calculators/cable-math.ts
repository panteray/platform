/**
 * Cable length from canvas waypoints (pixel path) with scale and optional slack.
 */

export interface WaypointLike {
  x: number;
  y: number;
}

/**
 * Compute total cable length in feet from a list of waypoints.
 * @param waypoints - Path in pixel coordinates
 * @param pixelsPerFoot - Scale (e.g. from canvas)
 * @param slackPercent - Optional slack (default 0), e.g. 20 for 20%
 * @param minSegmentFt - Optional minimum segment length in feet (default 0)
 */
export function calculateCableLength(
  waypoints: WaypointLike[],
  pixelsPerFoot: number,
  slackPercent: number = 0,
  minSegmentFt: number = 0
): number {
  if (waypoints.length < 2 || pixelsPerFoot <= 0) return 0;
  let totalPx = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const dx = waypoints[i].x - waypoints[i - 1].x;
    const dy = waypoints[i].y - waypoints[i - 1].y;
    totalPx += Math.sqrt(dx * dx + dy * dy);
  }
  let lengthFt = totalPx / pixelsPerFoot;
  if (slackPercent > 0) lengthFt *= 1 + slackPercent / 100;
  if (minSegmentFt > 0 && waypoints.length >= 2) {
    const minTotal = (waypoints.length - 1) * minSegmentFt;
    if (lengthFt < minTotal) lengthFt = minTotal;
  }
  return Math.round(lengthFt * 10) / 10;
}
