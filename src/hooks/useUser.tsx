'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'
import type { UserRole } from '@/types/enums'

interface UserState {
  user: User | null
  authId: string | null
  orgId: string | null
  userRole: UserRole | null
  isGlobalAdmin: boolean
  userTypes: string[]
  loading: boolean
}

const defaultState: UserState = {
  user: null,
  authId: null,
  orgId: null,
  userRole: null,
  isGlobalAdmin: false,
  userTypes: [],
  loading: true,
}

const UserContext = createContext<UserState>(defaultState)

// Safe JWT decode with try/catch
function decodeJwtPayload(token: string): Record<string, any> {
  try {
    const base64 = token.split('.')[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return {}
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserState>(defaultState)

  useEffect(() => {
    const supabase = createClient()

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setState((s) => ({ ...s, loading: false }))
        return
      }

      const payload = decodeJwtPayload(session.access_token)

      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', session.user.id)
        .single()

      setState({
        user: dbUser,
        authId: session.user.id,
        orgId: payload.org_id ?? null,
        userRole: (payload.user_role ?? dbUser?.role ?? null) as UserRole | null,
        isGlobalAdmin: payload.is_global_admin === true || dbUser?.is_global_admin === true,
        userTypes: payload.user_types ?? [],
        loading: false,
      })
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => subscription.unsubscribe()
  }, [])

  return <UserContext.Provider value={state}>{children}</UserContext.Provider>
}

export function useUser(): UserState {
  return useContext(UserContext)
}
