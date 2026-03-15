'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/types/database'

interface NotificationState {
  notifications: Notification[]
  loading: boolean
  error: string | null
}

export function useNotifications(limit = 20): NotificationState {
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setState((s) => ({ ...s, loading: false }))
        return
      }

      // Get the users table id for the current auth user
      const { data: dbUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single()

      if (!dbUser) {
        setState({ notifications: [], loading: false, error: null })
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', dbUser.id)
        .order('created_at', { ascending: false })
        .limit(limit)

      setState({
        notifications: (data as Notification[]) ?? [],
        loading: false,
        error: error?.message ?? null,
      })
    }

    load()
  }, [limit])

  return state
}
