'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types/database'
import type { UserRole, UserType } from '@/types/enums'

interface UserState {
  user: User | null
  authId: string | null
  orgId: string | null
  userRole: UserRole | null
  isGlobalAdmin: boolean
  userTypes: UserType[]
  loading: boolean
}

export function useUser(): UserState {
  const [state, setState] = useState<UserState>({
    user: null,
    authId: null,
    orgId: null,
    userRole: null,
    isGlobalAdmin: false,
    userTypes: [],
    loading: true,
  })

  useEffect(() => {
    const supabase = createClient()

    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setState((s) => ({ ...s, loading: false }))
        return
      }

      const jwt = session.access_token
      const payload = JSON.parse(atob(jwt.split('.')[1]))

      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', session.user.id)
        .single()

      setState({
        user: dbUser,
        authId: session.user.id,
        orgId: payload.org_id ?? null,
        userRole: payload.user_role ?? null,
        isGlobalAdmin: payload.is_global_admin === true,
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

  return state
}
