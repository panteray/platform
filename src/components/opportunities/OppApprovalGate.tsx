'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ShieldCheck, ShieldAlert, Clock, CheckCircle2, XCircle,
  Plus, Loader2,
} from 'lucide-react'

interface Approval {
  id: string
  gate_type: string
  status: string
  target_status: string | null
  requested_by_name: string | null
  approved_by_name: string | null
  request_notes: string | null
  review_notes: string | null
  requested_at: string
  reviewed_at: string | null
}

interface OppApprovalGateProps {
  oppId: string
  callerRole: string | null
}

const GATE_LABELS: Record<string, string> = {
  QUOTE_REVIEW: 'Quote Review',
  SOW_REVIEW: 'SOW Review',
  PROJECT_KICKOFF: 'Project Kickoff',
  CHANGE_ORDER: 'Change Order',
  SIGN_OFF: 'Sign Off',
  CUSTOM: 'Custom',
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  PENDING: { icon: <Clock className="h-3.5 w-3.5" />, color: '#f59e0b', label: 'Pending' },
  APPROVED: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: '#22c55e', label: 'Approved' },
  REJECTED: { icon: <XCircle className="h-3.5 w-3.5" />, color: '#ef4444', label: 'Rejected' },
  CANCELLED: { icon: <XCircle className="h-3.5 w-3.5" />, color: '#a1a1aa', label: 'Cancelled' },
}

const APPROVER_ROLES = ['GLOBAL_ADMIN', 'GLOBAL_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER', 'MANAGER']

export function OppApprovalGate({ oppId, callerRole }: OppApprovalGateProps) {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showRequest, setShowRequest] = useState(false)
  const [requestGate, setRequestGate] = useState('QUOTE_REVIEW')
  const [requestNotes, setRequestNotes] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')

  const isApprover = callerRole ? APPROVER_ROLES.includes(callerRole) : false

  const fetchApprovals = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/org/opportunities/${oppId}/approval`)
    if (res.ok) setApprovals(await res.json())
    setLoading(false)
  }, [oppId])

  useEffect(() => {
    fetchApprovals()
  }, [fetchApprovals])

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading('request')
    const res = await fetch(`/api/org/opportunities/${oppId}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gate_type: requestGate,
        request_notes: requestNotes.trim() || null,
      }),
    })
    setActionLoading(null)
    if (res.ok) {
      setShowRequest(false)
      setRequestNotes('')
      fetchApprovals()
    }
  }

  async function handleReview(approvalId: string, action: 'APPROVED' | 'REJECTED') {
    setActionLoading(approvalId)
    await fetch(`/api/org/opportunities/${oppId}/approval`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval_id: approvalId,
        action,
        review_notes: reviewNotes.trim() || null,
      }),
    })
    setActionLoading(null)
    setReviewNotes('')
    fetchApprovals()
  }

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          )}
          <h3 className="text-sm font-semibold">Approval Gates</h3>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
              {pendingCount} pending
            </span>
          )}
        </div>
        <button
          onClick={() => setShowRequest(true)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Plus className="h-3 w-3" /> Request Approval
        </button>
      </div>

      {/* Request form */}
      {showRequest && (
        <form onSubmit={handleRequest} className="mb-4 space-y-2 rounded-md border border-border bg-muted/20 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Gate Type</label>
            <select
              value={requestGate}
              onChange={(e) => setRequestGate(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm"
            >
              {Object.entries(GATE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              placeholder="Why is this approval needed?"
              rows={2}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRequest(false)}
              className="h-7 rounded-md border border-border px-3 text-xs hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading === 'request'}
              className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {actionLoading === 'request' ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Loading approvals...</p>
      ) : approvals.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No approval requests yet.</p>
      ) : (
        <div className="space-y-2">
          {approvals.map((a) => {
            const config = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.PENDING
            const isPending = a.status === 'PENDING'

            return (
              <div
                key={a.id}
                className={`rounded-md border px-3 py-2.5 ${
                  isPending ? 'border-amber-500/30 bg-amber-500/5' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span style={{ color: config.color }}>{config.icon}</span>
                      <span className="text-xs font-semibold">
                        {GATE_LABELS[a.gate_type] ?? a.gate_type}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: `${config.color}15`, color: config.color }}
                      >
                        {config.label}
                      </span>
                    </div>
                    {a.request_notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{a.request_notes}</p>
                    )}
                    {a.review_notes && (
                      <p className="mt-1 text-xs">
                        <span className="font-medium text-muted-foreground">Review:</span>{' '}
                        {a.review_notes}
                      </p>
                    )}
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Requested by {a.requested_by_name ?? '—'} on{' '}
                      {new Date(a.requested_at).toLocaleDateString()}
                      {a.approved_by_name && a.reviewed_at && (
                        <> · Reviewed by {a.approved_by_name} on {new Date(a.reviewed_at).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>

                  {/* Approve/Reject buttons for managers */}
                  {isPending && isApprover && (
                    <div className="flex shrink-0 items-center gap-1">
                      {actionLoading === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <button
                            onClick={() => handleReview(a.id, 'APPROVED')}
                            className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(a.id, 'REJECTED')}
                            className="rounded-md border border-red-500/30 px-2.5 py-1 text-[10px] font-bold text-red-500 hover:bg-red-500/10"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
