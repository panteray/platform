'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileText, Upload, Trash2, Download, Clock, FolderOpen } from 'lucide-react'

interface VaultDoc {
  id: string; name: string; document_type: string | null
  file_url: string | null; created_at: string
}

export default function UserVaultPage() {
  const [docs, setDocs] = useState<VaultDoc[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/org/user-vault')
      if (res.ok) { const { documents } = await res.json(); setDocs(documents ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document from your vault?')) return
    await fetch(`/api/org/user-vault?id=${id}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">My Vault</h1>
        <p className="mt-1 text-sm text-muted-foreground">Personal document staging area</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading vault...</div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium text-foreground">Your vault is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Documents you save from exports and reports will appear here as your personal staging area.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-medium">{d.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground uppercase">{d.document_type || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(d.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {d.file_url && (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button onClick={() => handleDelete(d.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
