'use client'
import { useParams } from 'next/navigation'
import { DistributorDetail } from '@/components/distributors/DistributorDetail'
export default function DistributorDetailPage() { const params = useParams<{ id: string }>(); if (!params?.id) return null; return <DistributorDetail distributorId={params.id} /> }
