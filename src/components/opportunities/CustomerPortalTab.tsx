'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Link2, Copy, Check, XCircle, Clock, Shield,
  ExternalLink, CheckCircle2,
} from 'lucide-react'

interface PortalToken {
  id: string
  token: string
  permissions: string[]
  is_active: boolean
  expires_at: string
  accepted_at: string | null
  accepted_by_name: string | null
  accepted_by_email: string | null
  created_at: string
  customers: { name: string; contact_name: string | null; contact_email: string | null } | null
}

interface Props {
  oppId: string
}

const PERM_LABELS: Record<string, string> = {
  view_sow: 'SOW',
  view_quote: 'Quote',
  view_hardware_schedule: 'HW Schedule',
}

export function CustomerPortalTab({ oppId }: Props) {
  const [tokens, setTokens] = useState<PortalToken[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [perms, setPerms] = useState<string[]>(['view_sow', 'view_quote', 'view_hardware_schedule'])
  const [expiresInDays, setExpiresInDays] = useState(30)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/opportunities/${oppId}/portal`)
    if (res.ok) setTokens(await res.json())
    setLoading(false)
  }, [oppId])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    const res = await fetch(`/api/org/opportunities/${oppId}/portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: perms, expires_in_days: expiresInDays }),
    })
    if (res.ok) {
      await load()
      setShowCreate(false)
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to create')
    }
  }

  const handleDeactivate = async (tokenId: string) => {
    if (!confirm('Deactivate this portal link? The customer will no longer be able to access it.')) return
    await fetch(`/api/org/opportunities/${oppId}/portal?token_id=${tokenId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    })
    await load()
  }

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/portal/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Customer Portal</h3>
          <p className="text-xs text-muted-foreground">
            Generate secure links for customers to view and accept documents
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Generate Link
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h4 className="text-xs font-semibold text-foreground">New Portal Link</h4>

          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PERM_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={perms.includes(key)}
                    onChange={(e) => {
                      if (e.target.checked) setPerms([...perms, key])
                      else setPerms(perms.filter(p => p !== key))
                    }}
                    className="h-3 w-3 rounded border-border"
                  />
                  <span className="text-xs text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">Expires In (days)</label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value) || 30)}
              min={1}
              max={365}
              className="w-32 rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={perms.length === 0}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Link2 className="h-3 w-3" /> Generate
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {tokens.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <Shield className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No portal links generated</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Generate a secure link for the customer to view and accept documents
          </p>
        </div>
      )}

      {/* Token List */}
      <div className="space-y-2">
        {tokens.map((tk) => {
          const expired = new Date(tk.expires_at) < new Date()
          const active = tk.is_active && !expired

          return (
            <div
              key={tk.id}
              className={`rounded-lg border bg-card p-3 ${
                tk.accepted_at ? 'border-emerald-200 bg-emerald-500/5' :
                !active ? 'border-border opacity-60' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {tk.accepted_at ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : active ? (
                    <Link2 className="h-4 w-4 text-primary" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">
                        {tk.customers?.name || 'Customer'}
                      </span>
                      {tk.accepted_at && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                          ACCEPTED
                        </span>
                      )}
                      {!active && !tk.accepted_at && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                          {expired ? 'EXPIRED' : 'DEACTIVATED'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>Created {new Date(tk.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        Expires {new Date(tk.expires_at).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>{tk.permissions.map(p => PERM_LABELS[p] || p).join(', ')}</span>
                    </div>
                    {tk.accepted_at && tk.accepted_by_name && (
                      <p className="text-[10px] text-emerald-600 mt-0.5">
                        Accepted by {tk.accepted_by_name} ({tk.accepted_by_email}) on {new Date(tk.accepted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {active && (
                    <>
                      <button
                        onClick={() => copyLink(tk.token, tk.id)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
                        title="Copy link"
                      >
                        {copiedId === tk.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {copiedId === tk.id ? 'Copied' : 'Copy'}
                      </button>
                      <a
                        href={`/portal/${tk.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        title="Preview"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => handleDeactivate(tk.id)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                        title="Deactivate"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
