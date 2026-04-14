'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ClauseLibraryPanel from '@/components/contracts/ClauseLibraryPanel'

export default function ClauseLibraryPage() {
  return (
    <div className="p-6 space-y-6">
      <Link href="/org/contracts" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16} /> Back to Contracts
      </Link>
      <ClauseLibraryPanel />
    </div>
  )
}
