import type { Metadata } from 'next'
import { Red_Rose, Epilogue } from 'next/font/google'
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
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Panteray',
  description: 'Lifecycle management platform for system integrators',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
}

const themeScript = `(function(){try{var t=localStorage.getItem('panteray-theme');if(t==='light'||t==='dark'){document.documentElement.classList.add(t)}else{document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})();`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${redRose.variable} ${epilogue.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-display">
        <ThemeProvider>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
