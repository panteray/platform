'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ContractTemplateEditor from '@/components/contracts/ContractTemplateEditor'

export default function ContractTemplateEditPage() {
  const params = useParams<{ id: string }>()
  if (!params?.id) return null

  return (
    <div className="p-6 space-y-6">
      <Link href="/org/contracts/templates" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16} /> Back to Templates
      </Link>
      <ContractTemplateEditor templateId={params.id} />
    </div>
  )
}
