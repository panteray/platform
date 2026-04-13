'use client'

import { use } from 'react'
import { LeadDetail } from '@/components/leads/LeadDetail'

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <LeadDetail leadId={id} />
}
