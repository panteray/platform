'use client'
import { useParams } from 'next/navigation'
import { ManufacturerDetail } from '@/components/manufacturers/ManufacturerDetail'
export default function ManufacturerDetailPage() { const params = useParams<{ id: string }>(); if (!params?.id) return null; return <ManufacturerDetail manufacturerId={params.id} /> }
