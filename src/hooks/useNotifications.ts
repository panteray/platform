'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/types/database'

interface NotificationState {
  notifications: Notification[]
  loading: boolean
  error: string | null
}

export function useNotifications(limit = 20) {
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    loading: true,
    error: null,
  })
  const [userId, setUserId] = useState<string | null>(null)

  // Initial load
  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setState((s) => ({ ...s, loading: false }))
        return
      }

      const { data: dbUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single()

      if (!dbUser) {
        setState({ notifications: [], loading: false, error: null })
        return
      }

      setUserId(dbUser.id)

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

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setState((s) => ({
            ...s,
            notifications: [newNotif, ...s.notifications].slice(0, limit),
          }))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          setState((s) => ({
            ...s,
            notifications: s.notifications.map((n) =>
              n.id === updated.id ? updated : n
            ),
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, limit])

  const markRead = useCallback(async (notificationId: string) => {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
    }))
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    })
  }, [])

  const markAllRead = useCallback(async () => {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }))
    await fetch('/api/notifications/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }, [])

  return {
    ...state,
    markRead,
    markAllRead,
  }
}
