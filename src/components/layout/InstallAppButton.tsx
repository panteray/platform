'use client'

import { useEffect, useState } from 'react'
import { Download, Share, Plus, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallAppButton({ label = 'Install App' }: { label?: string }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHelp, setShowIOSHelp] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
    setIsIOS(ios)

    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) setInstalled(true)

    const stashed = (window as unknown as { __panterayInstallPrompt?: BeforeInstallPromptEvent | null }).__panterayInstallPrompt
    if (stashed) setPromptEvent(stashed)

    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const installedHandler = () => { setInstalled(true); setPromptEvent(null) }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  if (installed) return null

  async function install() {
    if (isIOS) { setShowIOSHelp(true); return }
    if (!promptEvent) { setShowIOSHelp(true); return }
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
  }

  if (!promptEvent && !isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSHelp(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          <Download className="h-3.5 w-3.5" /> {label}
        </button>
        {showIOSHelp && (
          <InstallHelpModal
            onClose={() => setShowIOSHelp(false)}
            promptEvent={promptEvent}
            onInstall={install}
          />
        )}
      </>
    )
  }

  return (
    <>
      <button
        onClick={install}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <Download className="h-3.5 w-3.5" /> {label}
      </button>
      {showIOSHelp && (
        <InstallHelpModal
          onClose={() => setShowIOSHelp(false)}
          promptEvent={promptEvent}
          onInstall={install}
        />
      )}
    </>
  )
}

function InstallHelpModal({
  onClose,
  promptEvent,
  onInstall,
}: {
  onClose: () => void
  promptEvent: BeforeInstallPromptEvent | null
  onInstall: () => void | Promise<void>
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold">Install Panteray</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <p className="text-muted-foreground">Install Panteray to your device for offline-ready surveys and field ops.</p>
          {promptEvent && (
            <button
              type="button"
              onClick={() => {
                void onInstall()
                onClose()
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Install Now
            </button>
          )}
          <div className="space-y-2">
            <p className="font-medium">iPhone / iPad (Safari):</p>
            <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
              <li>Tap the <Share className="inline h-3.5 w-3.5" /> Share button</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong></li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Android (Chrome):</p>
            <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
              <li>Tap the <strong>⋮</strong> menu</li>
              <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong></li>
            </ol>
          </div>
          <div className="space-y-2">
            <p className="font-medium">Desktop (Chrome/Edge):</p>
            <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
              <li>Click the <Plus className="inline h-3.5 w-3.5" /> install icon in the address bar</li>
              <li>Or use the browser menu → <strong>Install Panteray</strong></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
