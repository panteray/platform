'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, CheckCircle2, CircleDollarSign, Lock } from 'lucide-react'
import type { OperationalValidation } from '@/types/database'

interface Props {
  projectId: string
}

interface OpsContext {
  sos: {
    id: string
    status: string
    customer_signed_at: string | null
    pm_signed_at: string | null
    gate_install_complete: boolean
    gate_co_closed: boolean
    gate_qc_passed: boolean
  } | null
  sub_assignments: { id: string; status: string; po_number: string | null; po_amount: number | null; invoiced_amount: number | null; paid_amount: number | null }[]
  invoices: { id: string; invoice_number: string; status: string; total: number; amount_paid: number; due_date: string; paid_at: string | null }[]
  opp: { id: string; status: string; po_number: string | null; outcome: string } | null
}

type CheckKey = 'sos_uploaded' | 'sub_po' | 'sub_invoice' | 'customer_po' | 'clean_sos'

export function ProjectOpsValidationTab({ projectId }: Props) {
  const [validation, setValidation] = useState<OperationalValidation | null>(null)
  const [context, setContext] = useState<OpsContext | null>(null)
  const [projectStatus, setProjectStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/org/projects/${projectId}/ops-validation`)
    if (!res.ok) {
      setError((await res.json()).error ?? 'Failed to load ops validation')
      setLoading(false)
      return
    }
    const data = await res.json()
    setValidation(data.validation)
    setContext(data.context)
    setProjectStatus(data.project_status)
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function post(payload: Record<string, unknown>) {
    setBusy(true); setError(null)
    const res = await fetch(`/api/org/projects/${projectId}/ops-validation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setBusy(false)
    if (!res.ok) { setError((await res.json()).error ?? 'Failed to update'); return }
    load()
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading operational validation...</p>
  if (!validation) return <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error ?? 'Unable to load'}</div>

  const v = validation

  const checks: { key: CheckKey; label: string; done: boolean; na: boolean; naCapable: boolean; hint: string }[] = [
    {
      key: 'sos_uploaded', label: 'SOS uploaded', done: !!v.sos_uploaded_at, na: false, naCapable: false,
      hint: context?.sos ? `Latest SOS: ${context.sos.status}` : 'No sign-off sheet found for this project',
    },
    {
      key: 'sub_po', label: 'Subcontractor PO issued', done: !!v.sub_po_confirmed_at, na: v.sub_po_na, naCapable: true,
      hint: (context?.sub_assignments?.length ?? 0) > 0
        ? context!.sub_assignments.map((s) => `${s.po_number ?? 'no PO'} (${s.status})`).join(', ')
        : 'No sub assignments on this project',
    },
    {
      key: 'sub_invoice', label: 'Subcontractor invoice received', done: !!v.sub_invoice_confirmed_at, na: v.sub_invoice_na, naCapable: true,
      hint: (context?.sub_assignments?.length ?? 0) > 0
        ? context!.sub_assignments.map((s) => `invoiced $${s.invoiced_amount ?? 0} / paid $${s.paid_amount ?? 0}`).join(', ')
        : 'No sub assignments on this project',
    },
    {
      key: 'customer_po', label: 'Customer PO valid', done: !!v.customer_po_confirmed_at, na: false, naCapable: false,
      hint: context?.opp?.po_number ? `Customer PO: ${context.opp.po_number}` : 'No PO number on the opportunity',
    },
    {
      key: 'clean_sos', label: 'Clean SOS (signatures + gates)', done: !!v.clean_sos_confirmed_at, na: false, naCapable: false,
      hint: context?.sos
        ? `Customer ${context.sos.customer_signed_at ? '✓' : '—'} · PM ${context.sos.pm_signed_at ? '✓' : '—'} · Install ${context.sos.gate_install_complete ? '✓' : '—'} · COs ${context.sos.gate_co_closed ? '✓' : '—'} · QC ${context.sos.gate_qc_passed ? '✓' : '—'}`
        : 'No sign-off sheet found',
    },
  ]

  const allDone = checks.every((c) => c.done || c.na)

  return (
    <div className="space-y-4">
      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Operational Validation</h2>
        {v.validated_at && <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700">Validated {new Date(v.validated_at).toLocaleDateString()}</span>}
      </div>

      {/* Checklist */}
      <div className="rounded-md border border-border bg-card divide-y divide-border">
        {checks.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className={`text-sm font-medium ${c.done || c.na ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{c.label}</p>
              <p className="text-xs text-muted-foreground truncate">{c.hint}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {c.done && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Confirmed</span>}
              {c.na && !c.done && <span className="text-[11px] font-semibold text-muted-foreground">N/A</span>}
              {!c.done && !c.na && (
                <>
                  <button onClick={() => post({ check: c.key })} disabled={busy} className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    Confirm
                  </button>
                  {c.naCapable && (
                    <button onClick={() => post({ check: c.key, na: true })} disabled={busy} className="h-7 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">
                      N/A
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invoices context */}
      {(context?.invoices?.length ?? 0) > 0 && (
        <div className="rounded-md border border-border bg-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Project Invoices</p>
          <div className="space-y-1">
            {context!.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between text-xs">
                <span className="font-mono">{inv.invoice_number}</span>
                <span className="text-muted-foreground">due {inv.due_date}</span>
                <span>${inv.amount_paid} / ${inv.total}</span>
                <span className={`font-semibold ${inv.status === 'PAID' ? 'text-emerald-700' : 'text-amber-700'}`}>{inv.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 19: payment + closure */}
      <div className="rounded-md border border-border bg-card p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project Closure</p>

        {v.payment_received_at ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
            <CircleDollarSign className="h-4 w-4" /> Payment received {new Date(v.payment_received_at).toLocaleString()}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Record receipt of payment for equipment and labor. Moves the project to Operational Closure.</p>
            <button
              onClick={() => { if (confirm('Record payment received? This moves the project to Operational Closure.')) post({ action: 'payment_received' }) }}
              disabled={busy || !allDone}
              title={allDone ? '' : 'Complete all validation checks first'}
              className="inline-flex items-center gap-1.5 h-8 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 shrink-0"
            >
              <CircleDollarSign className="h-3.5 w-3.5" /> Payment Received
            </button>
          </div>
        )}

        {v.closed_at ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" /> Closed {new Date(v.closed_at).toLocaleString()}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Final close — marks the opportunity Closed.</p>
            <button
              onClick={() => { if (confirm('Close this project? This marks the opportunity Closed.')) post({ action: 'close' }) }}
              disabled={busy || !v.payment_received_at}
              title={v.payment_received_at ? '' : 'Record payment first'}
              className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 shrink-0"
            >
              <Lock className="h-3.5 w-3.5" /> Close Project
            </button>
          </div>
        )}

        {projectStatus === 'operational_closure' && (
          <p className="text-[11px] text-muted-foreground">Project status: Operational Closure</p>
        )}
      </div>
    </div>
  )
}
