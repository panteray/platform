'use client'

import { useEffect, useState } from 'react'
import { VaultView } from './VaultView'

interface Props { oppId: string }

export function OppVaultTab({ oppId }: Props) {
  const [vaultId, setVaultId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/org/vaults/for-opp?opp_id=${oppId}`)
      .then(r => r.ok ? r.json() : null)
      .then(payload => { if (!cancelled && payload?.vault?.id) setVaultId(payload.vault.id) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [oppId])

  if (loading) return <p className="text-sm text-muted-foreground">Loading vault...</p>

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Opp Vault</h3>
      <VaultView
        vaultId={vaultId}
        emptyTitle="No vault found"
        emptyDescription="A vault will be created when the first document is generated"
      />
    </div>
  )
}
