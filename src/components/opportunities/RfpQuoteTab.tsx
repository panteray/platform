'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Send, Check, X, Trash2, FileText, Clock,
  DollarSign, Users, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react'
import type { OppSubQuote } from '@/types/database'

interface SubOption {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  hourly_rate: number | null
  day_rate: number | null
}

interface QuoteWithSub extends OppSubQuote {
  subcontractors: SubOption
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', color: '#6b7280', icon: FileText },
  rfp_sent: { label: 'RFP Sent', color: '#3b82f6', icon: Send },
  quoted: { label: 'Quoted', color: '#f59e0b', icon: DollarSign },
  accepted: { label: 'Accepted', color: '#22c55e', icon: Check },
  rejected: { label: 'Rejected', color: '#ef4444', icon: X },
  expired: { label: 'Expired', color: '#6b7280', icon: Clock },
}

interface Props {
  oppId: string
  callerRole: string | null
}

export function RfpQuoteTab({ oppId, callerRole }: Props) {
  const [quotes, setQuotes] = useState<QuoteWithSub[]>([])
  const [subs, setSubs] = useState<SubOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedSubId, setSelectedSubId] = useState('')
  const [rfpNotes, setRfpNotes] = useState('')
  const [subSearch, setSubSearch] = useState('')
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState(false)

  const isManager = callerRole && ['GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER', 'MANAGER', 'OPERATIONS'].includes(callerRole)

  const loadQuotes = useCallback(async () => {
    const res = await fetch(`/api/org/opportunities/${oppId}/sub-quotes`)
    if (res.ok) setQuotes(await res.json())
  }, [oppId])

  const loadSubs = useCallback(async () => {
    const res = await fetch('/api/org/subcontractors')
    if (res.ok) {
      const data = await res.json()
      setSubs(data)
    }
  }, [])

  useEffect(() => {
    Promise.all([loadQuotes(), loadSubs()]).then(() => setLoading(false))
  }, [loadQuotes, loadSubs])

  const handleCreate = async (sendRfp: boolean) => {
    if (!selectedSubId) return
    const res = await fetch(`/api/org/opportunities/${oppId}/sub-quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sub_id: selectedSubId,
        rfp_notes: rfpNotes || null,
        send_rfp: sendRfp,
      }),
    })
    if (res.ok) {
      await loadQuotes()
      setShowAddForm(false)
      setSelectedSubId('')
      setRfpNotes('')
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to create')
    }
  }

  const handleUpdateStatus = async (quoteId: string, status: string, extra?: Record<string, unknown>) => {
    const res = await fetch(`/api/org/opportunities/${oppId}/sub-quotes?quote_id=${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extra }),
    })
    if (res.ok) await loadQuotes()
    else {
      const err = await res.json()
      alert(err.error || 'Failed to update')
    }
  }

  const handleUpdateQuoteData = async (quoteId: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/org/opportunities/${oppId}/sub-quotes?quote_id=${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) await loadQuotes()
  }

  const handleDelete = async (quoteId: string) => {
    if (!confirm('Delete this draft quote?')) return
    const res = await fetch(`/api/org/opportunities/${oppId}/sub-quotes?quote_id=${quoteId}`, {
      method: 'DELETE',
    })
    if (res.ok) await loadQuotes()
  }

  const quotedQuotes = quotes.filter(q => ['quoted', 'accepted'].includes(q.status))
  const filteredSubs = subs.filter(s =>
    subSearch === '' || s.name.toLowerCase().includes(subSearch.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Subcontractor Quotes</h3>
          <p className="text-xs text-muted-foreground">
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''} •
            {quotes.filter(q => q.status === 'accepted').length} accepted
          </p>
        </div>
        <div className="flex items-center gap-2">
          {quotedQuotes.length >= 2 && (
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              {showComparison ? 'Hide' : 'Compare'}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Subcontractor
          </button>
        </div>
      </div>

      {/* Comparison Table */}
      {showComparison && quotedQuotes.length >= 2 && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-semibold text-foreground">Subcontractor</th>
                <th className="px-3 py-2 text-right font-semibold text-foreground">Labor Hrs</th>
                <th className="px-3 py-2 text-right font-semibold text-foreground">Labor $</th>
                <th className="px-3 py-2 text-right font-semibold text-foreground">Material $</th>
                <th className="px-3 py-2 text-right font-semibold text-foreground">Total</th>
                <th className="px-3 py-2 text-right font-semibold text-foreground">Valid Until</th>
                <th className="px-3 py-2 text-center font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {quotedQuotes.map((q) => {
                const isLowest = q.total_amount !== null &&
                  q.total_amount === Math.min(...quotedQuotes.filter(qq => qq.total_amount !== null).map(qq => qq.total_amount!))
                return (
                  <tr key={q.id} className={`border-b border-border ${isLowest ? 'bg-emerald-500/5' : ''}`}>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {q.subcontractors?.name}
                      {isLowest && <span className="ml-1 text-[10px] text-emerald-600 font-semibold">LOWEST</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{q.labor_hours ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {q.labor_amount != null ? `$${q.labor_amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {q.material_amount != null ? `$${q.material_amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">
                      {q.total_amount != null ? `$${q.total_amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={q.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <h4 className="text-xs font-semibold text-foreground">Add Subcontractor Quote</h4>

          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">
              Search Subcontractor
            </label>
            <input
              value={subSearch}
              onChange={(e) => setSubSearch(e.target.value)}
              placeholder="Type to search..."
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
            {subSearch && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded border border-border bg-popover">
                {filteredSubs.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => { setSelectedSubId(sub.id); setSubSearch(sub.name) }}
                    className={`flex w-full items-center justify-between px-2 py-1.5 text-xs hover:bg-accent ${
                      selectedSubId === sub.id ? 'bg-primary/10 text-primary' : 'text-foreground'
                    }`}
                  >
                    <span>{sub.name}</span>
                    {sub.contact_name && (
                      <span className="text-[10px] text-muted-foreground">{sub.contact_name}</span>
                    )}
                  </button>
                ))}
                {filteredSubs.length === 0 && (
                  <p className="px-2 py-2 text-[11px] text-muted-foreground">No subcontractors found</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-0.5">RFP Notes</label>
            <textarea
              value={rfpNotes}
              onChange={(e) => setRfpNotes(e.target.value)}
              rows={3}
              placeholder="Scope notes, special requirements, timeline..."
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCreate(true)}
              disabled={!selectedSubId}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="h-3 w-3" /> Send RFP
            </button>
            <button
              onClick={() => handleCreate(false)}
              disabled={!selectedSubId}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
            >
              Save as Draft
            </button>
            <button
              onClick={() => { setShowAddForm(false); setSelectedSubId(''); setRfpNotes(''); setSubSearch('') }}
              className="rounded px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {quotes.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <FileText className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No subcontractor quotes</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Add subcontractors and send RFP packages to collect labor quotes
          </p>
        </div>
      )}

      {/* Quote Cards */}
      <div className="space-y-2">
        {quotes.map((quote) => {
          const isExpanded = expandedQuote === quote.id
          const config = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft
          const sub = quote.subcontractors

          return (
            <div key={quote.id} className="rounded-lg border border-border bg-card">
              {/* Card Header */}
              <div
                onClick={() => setExpandedQuote(isExpanded ? null : quote.id)}
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/5"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{sub?.name || 'Unknown'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {sub?.contact_name && `${sub.contact_name} • `}
                      {sub?.contact_email || sub?.contact_phone || ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {quote.total_amount != null && (
                    <span className="text-sm font-bold text-foreground">
                      ${quote.total_amount.toLocaleString()}
                    </span>
                  )}
                  <StatusBadge status={quote.status} />
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-3">
                  {/* RFP Info */}
                  {quote.rfp_notes && (
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">RFP Notes</label>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{quote.rfp_notes}</p>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    {quote.rfp_sent_at && <span>RFP sent {new Date(quote.rfp_sent_at).toLocaleDateString()}</span>}
                    {quote.quote_received_at && <span>Quote received {new Date(quote.quote_received_at).toLocaleDateString()}</span>}
                    {quote.accepted_at && <span>Accepted {new Date(quote.accepted_at).toLocaleDateString()}</span>}
                  </div>

                  {/* Quote Entry (for rfp_sent status — enter received quote data) */}
                  {(quote.status === 'rfp_sent' || quote.status === 'quoted') && (
                    <QuoteEntryForm
                      quote={quote}
                      onSave={(data) => handleUpdateQuoteData(quote.id, data)}
                      onMarkQuoted={() => handleUpdateStatus(quote.id, 'quoted')}
                    />
                  )}

                  {/* Quote Display (for quoted/accepted) */}
                  {(quote.status === 'quoted' || quote.status === 'accepted') && quote.total_amount != null && (
                    <div className="grid grid-cols-4 gap-3 rounded-md bg-muted/50 p-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Labor Hours</p>
                        <p className="text-sm font-semibold text-foreground">{quote.labor_hours ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Labor $</p>
                        <p className="text-sm font-semibold text-foreground">
                          {quote.labor_amount != null ? `$${quote.labor_amount.toLocaleString()}` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Material $</p>
                        <p className="text-sm font-semibold text-foreground">
                          {quote.material_amount != null ? `$${quote.material_amount.toLocaleString()}` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                        <p className="text-sm font-bold text-foreground">${quote.total_amount.toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {/* Valid Until Warning */}
                  {quote.valid_until && new Date(quote.valid_until) < new Date() && quote.status === 'quoted' && (
                    <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-xs text-amber-700">Quote expired on {new Date(quote.valid_until).toLocaleDateString()}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {quote.status === 'draft' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(quote.id, 'rfp_sent')}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          <Send className="h-3 w-3" /> Send RFP
                        </button>
                        <button
                          onClick={() => handleDelete(quote.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </>
                    )}
                    {quote.status === 'quoted' && isManager && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(quote.id, 'accepted')}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3 w-3" /> Accept Quote
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt('Decline reason:')
                            if (reason) handleUpdateStatus(quote.id, 'rejected', { decline_reason: reason })
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" /> Reject
                        </button>
                      </>
                    )}
                    {quote.status === 'quoted' && !isManager && (
                      <p className="text-[11px] text-muted-foreground italic">Manager approval required to accept/reject</p>
                    )}
                  </div>

                  {/* Decline Reason */}
                  {quote.status === 'rejected' && quote.decline_reason && (
                    <div className="rounded-md bg-destructive/5 px-3 py-2">
                      <p className="text-[10px] font-semibold text-destructive uppercase">Decline Reason</p>
                      <p className="text-xs text-foreground">{quote.decline_reason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Status Badge ----
function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: `${config.color}18`, color: config.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  )
}

// ---- Quote Entry Form (inline) ----
function QuoteEntryForm({
  quote,
  onSave,
  onMarkQuoted,
}: {
  quote: QuoteWithSub
  onSave: (data: Record<string, unknown>) => void
  onMarkQuoted: () => void
}) {
  const [laborHours, setLaborHours] = useState(quote.labor_hours?.toString() || '')
  const [laborAmount, setLaborAmount] = useState(quote.labor_amount?.toString() || '')
  const [materialAmount, setMaterialAmount] = useState(quote.material_amount?.toString() || '')
  const [validUntil, setValidUntil] = useState(quote.valid_until || '')

  const total = (Number(laborAmount) || 0) + (Number(materialAmount) || 0)

  const handleSave = () => {
    onSave({
      labor_hours: laborHours ? Number(laborHours) : null,
      labor_amount: laborAmount ? Number(laborAmount) : null,
      material_amount: materialAmount ? Number(materialAmount) : null,
      total_amount: total || null,
      valid_until: validUntil || null,
    })
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Enter Quote Details</p>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-[10px] text-muted-foreground mb-0.5">Labor Hours</label>
          <input
            type="number"
            value={laborHours}
            onChange={(e) => setLaborHours(e.target.value)}
            className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-0.5">Labor $</label>
          <input
            type="number"
            value={laborAmount}
            onChange={(e) => setLaborAmount(e.target.value)}
            className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-0.5">Material $</label>
          <input
            type="number"
            value={materialAmount}
            onChange={(e) => setMaterialAmount(e.target.value)}
            className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-0.5">Valid Until</label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>
      {total > 0 && (
        <p className="text-xs text-foreground">Total: <span className="font-bold">${total.toLocaleString()}</span></p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { handleSave(); if (quote.status === 'rfp_sent') onMarkQuoted() }}
          className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Save Quote
        </button>
      </div>
    </div>
  )
}
