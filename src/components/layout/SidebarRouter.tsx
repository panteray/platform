'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { OrgSidebar } from './OrgSidebar'

export function SidebarRouter() {
  const pathname = usePathname()

  if (pathname.startsWith('/org')) {
    return <OrgSidebar />
  }

  return <Sidebar />
}
