import type { Metadata } from 'next'
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

/* FOUC prevention: apply saved theme class before paint. Daylight = :root (no class needed). */
const themeScript = `(function(){try{var t=localStorage.getItem('panteray-theme');var v=['morning','dusk','midnight'];if(v.indexOf(t)!==-1){document.documentElement.classList.add(t)}}catch(e){}})();`

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
