'use client'

import { UserProvider } from '@/hooks/useUser'

export function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  return <UserProvider>{children}</UserProvider>
}
