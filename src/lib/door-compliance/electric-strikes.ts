/**
 * Electric strike recommendation helper.
 * Loads /data/electric_strikes.json client-side and filters by door constraints.
 */

export interface ElectricStrike {
  id: string
  manufacturer: string
  series: string
  model: string
  description: string
  door_types: string[]
  fire_rated: boolean
  fire_rating_hours?: number
  fail_mode: 'fail_secure' | 'fail_safe'
  voltage: string
  current_draw_ma: number
  finish?: string
  ul_listed: boolean
  cut_out?: string
  latch_compatibility?: string[]
  notes?: string
}

interface StrikeDb {
  electric_strikes: ElectricStrike[]
}

let cache: ElectricStrike[] | null = null
let inflight: Promise<ElectricStrike[]> | null = null

export async function loadElectricStrikes(): Promise<ElectricStrike[]> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = fetch('/data/electric_strikes.json')
    .then(r => {
      if (!r.ok) throw new Error('Failed to load electric strike database')
      return r.json() as Promise<StrikeDb>
    })
    .then(db => {
      cache = db.electric_strikes ?? []
      return cache
    })
    .catch(err => {
      console.error('[electric-strikes]', err)
      cache = []
      return cache
    })
    .finally(() => { inflight = null })
  return inflight
}

/**
 * Filter strikes compatible with the given door type + fire rating.
 * Returns top-ranked results. Fire-rated doors require fire-rated strikes.
 */
export function getCompatibleStrikes(
  strikes: ElectricStrike[],
  doorType: string,
  fireRated: boolean,
  limit = 5,
): ElectricStrike[] {
  const normalized = doorType.toLowerCase().replace(/\s+/g, '_')
  const matches = strikes.filter(s => {
    if (!s.door_types.some(dt => dt === normalized)) return false
    if (fireRated && !s.fire_rated) return false
    return true
  })
  // Rank: UL listed first, then fail_secure (most common), then lowest current draw
  matches.sort((a, b) => {
    if (a.ul_listed !== b.ul_listed) return a.ul_listed ? -1 : 1
    if (a.fail_mode !== b.fail_mode) return a.fail_mode === 'fail_secure' ? -1 : 1
    return (a.current_draw_ma ?? 9999) - (b.current_draw_ma ?? 9999)
  })
  return matches.slice(0, limit)
}
