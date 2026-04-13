'use client'

import { useEffect, useState, useCallback } from 'react'
import { Calendar, Link2, Unlink, RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface CalendarStatus {
  google: { provider: string; created_at: string } | null
  outlook: { provider: string; created_at: string } | null
}

export function CalendarIntegrationPanel() {
  const [status, setStatus] = useState<CalendarStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/integrations/calendar-sync')
    if (res.ok) setStatus(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  // Handle OAuth code from redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const googleCode = params.get('google_calendar_code')
    const outlookCode = params.get('outlook_calendar_code')
    const calendarError = params.get('calendar_error')

    if (calendarError) {
      setSyncResult(`Error: ${calendarError}`)
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    if (googleCode) {
      completeOAuth('google-calendar', googleCode)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (outlookCode) {
      completeOAuth('outlook-calendar', outlookCode)
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function completeOAuth(provider: string, code: string) {
    setSyncing(true)
    const res = await fetch(`/api/integrations/${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (res.ok) {
      setSyncResult(`${provider === 'google-calendar' ? 'Google' : 'Outlook'} Calendar connected!`)
      await fetchStatus()
    } else {
      setSyncResult('Failed to connect calendar')
    }
    setSyncing(false)
  }

  async function handleConnect(provider: 'google-calendar' | 'outlook-calendar') {
    const res = await fetch(`/api/integrations/${provider}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Not configured' }))
      setSyncResult(err.error ?? 'Integration not available')
      return
    }
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  async function handleDisconnect(provider: 'google-calendar' | 'outlook-calendar') {
    if (!confirm(`Disconnect ${provider === 'google-calendar' ? 'Google' : 'Outlook'} Calendar?`)) return
    const res = await fetch(`/api/integrations/${provider}`, { method: 'DELETE' })
    if (res.ok) {
      setSyncResult('Calendar disconnected')
      await fetchStatus()
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/integrations/calendar-sync', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setSyncResult(data.synced > 0 ? `Synced ${data.synced} meeting(s)` : 'No meetings to sync')
    } else {
      setSyncResult('Sync failed')
    }
    setSyncing(false)
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Loading calendar status...</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-semibold">Calendar Sync</h3>
      </div>

      <div className="space-y-3">
        {/* Google Calendar */}
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4285F4]/10">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#4285F4">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.05-7.44 7-7.93v2.02C8.16 6.57 6 9.03 6 12s2.16 5.43 5 5.91v2.02zm2 0V17.9c2.84-.48 5-2.94 5-5.9s-2.16-5.43-5-5.91V4.07c3.94.49 7 3.85 7 7.93s-3.06 7.44-7 7.93z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium">Google Calendar</p>
              <p className="text-[10px] text-muted-foreground">
                {status?.google ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
          {status?.google ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <button
                onClick={() => handleDisconnect('google-calendar')}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-red-500 hover:bg-red-500/10"
              >
                <Unlink className="h-3 w-3" /> Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleConnect('google-calendar')}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Link2 className="h-3 w-3" /> Connect
            </button>
          )}
        </div>

        {/* Outlook Calendar */}
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0078D4]/10">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#0078D4">
                <path d="M21.17 2H7.83C6.82 2 6 2.82 6 3.83v16.34C6 21.18 6.82 22 7.83 22h13.34c1.01 0 1.83-.82 1.83-1.83V3.83C23 2.82 22.18 2 21.17 2zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" />
                <path d="M1 5v14l4-2V7L1 5z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium">Outlook Calendar</p>
              <p className="text-[10px] text-muted-foreground">
                {status?.outlook ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
          {status?.outlook ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <button
                onClick={() => handleDisconnect('outlook-calendar')}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-red-500 hover:bg-red-500/10"
              >
                <Unlink className="h-3 w-3" /> Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleConnect('outlook-calendar')}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Link2 className="h-3 w-3" /> Connect
            </button>
          )}
        </div>

        {/* Sync button */}
        {(status?.google || status?.outlook) && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {syncing ? 'Syncing...' : 'Sync Meetings Now'}
          </button>
        )}

        {/* Result message */}
        {syncResult && (
          <div className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs ${
            syncResult.startsWith('Error') || syncResult.includes('failed')
              ? 'bg-red-500/10 text-red-500'
              : 'bg-emerald-500/10 text-emerald-600'
          }`}>
            {syncResult.startsWith('Error') || syncResult.includes('failed') ? (
              <AlertCircle className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {syncResult}
          </div>
        )}
      </div>
    </div>
  )
}
