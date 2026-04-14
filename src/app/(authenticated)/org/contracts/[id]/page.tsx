'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Copy, CheckCircle2 } from 'lucide-react'
import type { GeneratedContract } from '@/types/database'
import { CONTRACT_TEMPLATE_TYPE_LABELS } from '@/types/database'

type ContractRow = GeneratedContract & {
  customer?: { id: string; name: string; contact_name: string | null; contact_email: string | null } | null
  template?: { id: string; name: string; type: string } | null
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>()
  const [contract, setContract] = useState<ContractRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/org/contracts/generated/${params.id}`)
    if (res.ok) setContract(await res.json())
    setLoading(false)
  }

  useEffect(() => { if (params?.id) load() }, [params?.id])

  async function send() {
    setSending(true)
    const res = await fetch(`/api/org/contracts/generated/${params.id}/send`, { method: 'POST' })
    if (res.ok) await load()
    setSending(false)
  }

  function copySignLink() {
    if (!contract?.sign_token) return
    const url = `${window.location.origin}/portal/contract/${contract.sign_token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="p-6 text-slate-500">Loading...</div>
  if (!contract) return <div className="p-6 text-slate-500">Contract not found</div>

  const canSend = contract.status === 'DRAFT' || contract.status === 'PENDING_REVIEW'
  const signUrl = contract.sign_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/contract/${contract.sign_token}` : ''

  return (
    <div className="p-6 space-y-6">
      <Link href="/org/contracts" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16} /> Back to Contracts
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500">{CONTRACT_TEMPLATE_TYPE_LABELS[contract.template_type] ?? contract.template_type}</div>
          <h1 className="text-2xl font-bold text-slate-900">{contract.title}</h1>
          <div className="mt-1 text-sm text-slate-500 font-mono">{contract.contract_number}</div>
          <div className="mt-1 text-sm text-slate-700">{contract.customer?.name}</div>
        </div>
        <div className="flex gap-2">
          {canSend && (
            <button onClick={send} disabled={sending} className="flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50">
              <Send size={14} /> {sending ? 'Sending...' : 'Send to Customer'}
            </button>
          )}
          {contract.sign_token && contract.status !== 'ACTIVE' && (
            <button onClick={copySignLink} className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              {copied ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy Sign Link'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 text-xs font-semibold uppercase text-slate-600">Content</div>
          <div className="whitespace-pre-wrap font-serif text-slate-800 text-sm">{contract.content}</div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase text-slate-600 mb-2">Status</div>
            <div className="text-sm font-medium text-slate-900">{contract.status}</div>
            {contract.sent_at && <div className="mt-2 text-xs text-slate-500">Sent {new Date(contract.sent_at).toLocaleString()}</div>}
            {contract.signed_at && <div className="mt-1 text-xs text-slate-500">Signed {new Date(contract.signed_at).toLocaleString()}</div>}
            {contract.signed_by_name && <div className="mt-1 text-xs text-slate-700">By {contract.signed_by_name}</div>}
            {contract.signature_url && <img src={contract.signature_url} alt="Signature" className="mt-3 max-h-20 border border-slate-200" />}
          </div>

          {contract.template && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase text-slate-600 mb-2">Template</div>
              <Link href={`/org/contracts/templates/${contract.template.id}`} className="text-sm text-blue-600 hover:underline">
                {contract.template.name}
              </Link>
            </div>
          )}

          {signUrl && contract.status !== 'ACTIVE' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase text-slate-600 mb-2">Sign Link</div>
              <div className="break-all text-xs font-mono text-slate-700">{signUrl}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
