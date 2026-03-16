'use client'

import { useParams } from 'next/navigation'
import { VendorDetail } from '@/components/vendors/VendorDetail'

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>()
  if (!params?.id) return null
  return <VendorDetail vendorId={params.id} />
}
