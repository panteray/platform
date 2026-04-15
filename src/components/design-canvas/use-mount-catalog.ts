/**
 * Shared hook that loads /data/mount_data.json once and shares the result
 * across every consumer (right-panel, device-profile-panel, tools MountForm).
 * Underlying fetch is memoized inside mount-catalog.ts — this hook just
 * wires the Promise into React state.
 */

import { useEffect, useState } from 'react'
import { loadMountCatalog, type MountCatalog } from '@/lib/calculators/mount-catalog'

export function useMountCatalog(): { catalog: MountCatalog | null; loading: boolean } {
  const [catalog, setCatalog] = useState<MountCatalog | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    loadMountCatalog()
      .then((c) => {
        if (mounted) {
          setCatalog(c)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return { catalog, loading }
}
