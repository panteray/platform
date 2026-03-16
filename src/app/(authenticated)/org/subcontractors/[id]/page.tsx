'use client'

import { useParams } from 'next/navigation'
import { SubcontractorDetail } from '@/components/subcontractors/SubcontractorDetail'

export default function SubcontractorDetailPage() {
  const params = useParams<{ id: string }>()
  if (!params?.id) return null
  return <SubcontractorDetail subcontractorId={params.id} />
}
