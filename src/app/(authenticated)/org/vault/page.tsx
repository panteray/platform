'use client'

import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { VaultView } from '@/components/vault/VaultView'

export default function UserVaultPage() {
  const [vaultId, setVaultId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/org/vaults/ensure-user', { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then(payload => { if (!cancelled && payload?.vault?.id) setVaultId(payload.vault.id) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><p className="text-sm text-muted-foreground">Loading your vault...</p></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">My Vault</h1>
          <p className="text-sm text-muted-foreground">Your personal documents — private to you</p>
        </div>
      </div>

      <VaultView
        vaultId={vaultId}
        emptyTitle="Your vault is empty"
        emptyDescription="Upload files or import from cloud to populate"
      />
    </div>
  )
}
