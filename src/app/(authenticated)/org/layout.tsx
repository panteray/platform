'use client'

import { OrgGuard } from '@/components/layout/OrgGuard'

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <OrgGuard>{children}</OrgGuard>
}
