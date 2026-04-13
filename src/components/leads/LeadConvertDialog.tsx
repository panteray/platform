'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

interface LeadConvertDialogProps {
  leadId: string
  leadName: string
  onClose: () => void
  onConverted: () => void
}

const OPP_TYPES = ['SEC', 'AV', 'NET', 'CYB', 'MSP', 'SVC']

type Step = 'confirm' | 'duplicates' | 'converting' | 'done' | 'error'

export function LeadConvertDialog({ leadId, leadName, onClose, onConverted }: LeadConvertDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('confirm')
  const [createOpp, setCreateOpp] = useState(true)
  const [oppType, setOppType] = useState('SEC')
  const [duplicates, setDuplicates] = useState<string[]>([])
  const [result, setResult] = useState<{ customer_id?: string; opp_id?: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function doConvert(skipDuplicateCheck: boolean) {
    setStep('converting')
    try {
      const res = await fetch(`/api/org/leads/${leadId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createOpp,
          oppType: createOpp ? oppType : undefined,
          skipDuplicateCheck,
        }),
      })

      const data = await res.json()

      if (res.status === 409 && data.warning === 'potential_duplicates') {
        setDuplicates(data.duplicates)
        setStep('duplicates')
        return
      }

      if (!res.ok) {
        setErrorMsg(data.error || 'Conversion failed')
        setStep('error')
        return
      }

      setResult({
        customer_id: data.customer?.id,
        opp_id: data.opp_id,
      })
      setStep('done')
      onConverted()
    } catch {
      setErrorMsg('Network error')
      setStep('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <>
            <h3 className="mb-1 text-sm font-semibold">Convert Lead</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Convert <strong>{leadName}</strong> to a customer record.
            </p>

            <div className="mb-4 space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={createOpp}
                  onChange={(e) => setCreateOpp(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm">Also create an opportunity</span>
              </label>

              {createOpp && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">OPP Type</label>
                  <select
                    value={oppType}
                    onChange={(e) => setOppType(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {OPP_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={() => doConvert(false)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Convert <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}

        {/* Step: Duplicate warning */}
        {step === 'duplicates' && (
          <>
            <div className="mb-3 flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Potential Duplicates Found</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              The following existing customers may match this lead:
            </p>
            <ul className="mb-4 space-y-1">
              {duplicates.map((d, i) => (
                <li key={i} className="rounded bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700">
                  {d}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={() => doConvert(true)}
                className="h-9 rounded-md bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600"
              >
                Convert Anyway
              </button>
            </div>
          </>
        )}

        {/* Step: Converting */}
        {step === 'converting' && (
          <div className="flex flex-col items-center py-8">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Converting lead...</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <>
            <div className="mb-3 flex items-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Lead Converted</h3>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Customer record created successfully.
              {result?.opp_id && ' Opportunity created.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted">
                Close
              </button>
              {result?.customer_id && (
                <button
                  onClick={() => router.push(`/org/customers/${result.customer_id}`)}
                  className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  View Customer
                </button>
              )}
            </div>
          </>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <>
            <div className="mb-3 flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-semibold">Conversion Failed</h3>
            </div>
            <p className="mb-4 text-xs text-red-400">{errorMsg}</p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted">
                Close
              </button>
              <button
                onClick={() => setStep('confirm')}
                className="h-9 rounded-md border border-border px-4 text-sm hover:bg-muted"
              >
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
