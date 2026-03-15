'use client'

import { use } from 'react'
import { CustomerDetail } from '@/components/customers/CustomerDetail'

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <CustomerDetail customerId={id} />
}
