import type { Metadata, Viewport } from 'next'
import { Red_Rose, Epilogue, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import './globals.css'

const redRose = Red_Rose({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['300', '400', '700'],
})

const epilogue = Epilogue({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Panteray',
  description: 'Lifecycle management platform for system integrators',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f172a',
}

/* FOUC prevention: apply saved theme class before paint. Daylight = :root (no class needed). */
const themeScript = `(function(){try{var t=localStorage.getItem('panteray-theme');var v=['morning','dusk','midnight'];if(v.indexOf(t)!==-1){document.documentElement.classList.add(t)}}catch(e){}})();`

/* Service worker registration: production only, after load to avoid dev HMR conflicts */
const swScript = `(function(){if('serviceWorker' in navigator && location.protocol === 'https:'){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}})();`

/* Capture beforeinstallprompt before React mounts so the event isn't lost during hydration. */
const installPromptScript = `(function(){window.__panterayInstallPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__panterayInstallPrompt=e;});window.addEventListener('appinstalled',function(){window.__panterayInstallPrompt=null;});})();`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${redRose.variable} ${epilogue.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: installPromptScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
