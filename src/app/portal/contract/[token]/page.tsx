'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import SignaturePad from '@/components/shared/SignaturePad'

interface Contract {
  id: string
  contract_number: string
  title: string
  template_type: string
  status: string
  content: string
  customer: { id: string; name: string; contact_name: string | null; contact_email: string | null } | null
  sent_at: string | null
  signed_at: string | null
  signature_url: string | null
  expires_at: string | null
}

export default function ContractSignPortalPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const [contract, setContract] = useState<Contract | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [signerName, setSignerName] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) return
    ;(async () => {
      const res = await fetch(`/api/portal/contract/${token}`)
      if (!res.ok) { setError((await res.json()).error); setLoading(false); return }
      const data = await res.json()
      setContract(data)
      if (data.customer?.contact_name) setSignerName(data.customer.contact_name)
      if (data.customer?.contact_email) setSignerEmail(data.customer.contact_email)
      setLoading(false)
    })()
  }, [token])

  async function submit() {
    if (!signerName || !signatureData) return
    setSubmitting(true)
    const res = await fetch(`/api/portal/contract/${token}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signed_by_name: signerName,
        signed_by_email: signerEmail,
        signature_data_url: signatureData,
      }),
    })
    if (res.ok) setSuccess(true)
    else setError((await res.json()).error)
    setSubmitting(false)
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Loading...</div>
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md rounded-lg bg-white p-8 shadow text-center">
        <AlertCircle className="mx-auto mb-3 text-red-500" size={40} />
        <div className="text-slate-900 font-semibold">{error}</div>
      </div>
    </div>
  )
  if (!contract) return null

  const alreadySigned = contract.status === 'ACTIVE' || !!contract.signed_at

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-3xl px-6 space-y-6">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <FileText className="text-slate-700" size={24} />
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-500">{contract.template_type}</div>
              <div className="text-xl font-bold text-slate-900">{contract.title}</div>
              <div className="text-xs text-slate-500 font-mono">{contract.contract_number}</div>
            </div>
          </div>
          {contract.customer && (
            <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
              <div className="text-slate-500 text-xs uppercase">Between</div>
              <div className="text-slate-900 font-medium">{contract.customer.name}</div>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase text-slate-600">Contract Terms</div>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-800 font-serif">{contract.content}</div>
        </div>

        {success || alreadySigned ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-green-600" size={40} />
            <div className="text-lg font-semibold text-green-900">Contract Signed</div>
            {contract.signed_at && (
              <div className="mt-1 text-sm text-green-700">
                Signed {new Date(contract.signed_at).toLocaleString()}
              </div>
            )}
            {contract.signature_url && (
              <img src={contract.signature_url} alt="Signature" className="mx-auto mt-4 max-h-24" />
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-white p-6 shadow-sm space-y-4">
            <div className="text-xs font-semibold uppercase text-slate-600">Sign Here</div>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Full Legal Name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <SignaturePad onChange={setSignatureData} width={620} height={180} />
            <button
              onClick={submit}
              disabled={!signerName || !signatureData || submitting}
              className="w-full rounded bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Sign & Accept Contract'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
