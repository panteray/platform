'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileText, Download, Clock } from 'lucide-react'

interface VaultDoc {
  id: string; name: string; document_type: string; version: number
  status: string; file_url: string | null; created_at: string
}

interface Props { oppId: string }

export function VaultSection({ oppId }: Props) {
  const [docs, setDocs] = useState<VaultDoc[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/org/vault?opp_id=${oppId}`)
      if (res.ok) {
        const { documents } = await res.json()
        setDocs((documents ?? []).filter((d: VaultDoc) => d.document_type !== 'system'))
      }
    } finally { setLoading(false) }
  }, [oppId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-xs text-muted-foreground p-4">Loading vault...</div>

  return (
    <div className="rounded-lg border border-border bg-card p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Opp Vault</span>
        <span className="text-[10px] text-muted-foreground">({docs.length} documents)</span>
      </div>

      {docs.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4">
          No documents in the vault yet. Export from the design canvas or SOW generator to populate.
        </div>
      ) : (
        <div className="space-y-1">
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between rounded border border-border px-3 py-2 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <div className="text-xs font-medium">{d.name}</div>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span className="uppercase font-semibold">{d.document_type}</span>
                    <span>V{d.version}</span>
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                  d.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
                }`}>{d.status}</span>
                {d.file_url && (
                  <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"><Download className="h-3.5 w-3.5" /></a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
