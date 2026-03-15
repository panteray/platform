'use client'

import { AdminGuard } from '@/components/layout/AdminGuard'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminGuard>{children}</AdminGuard>
}
