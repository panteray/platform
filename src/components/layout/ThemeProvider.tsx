'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
})

/**
 * ThemeProvider — runtime theme toggling.
 *
 * Initial class is already set by the inline script in layout.tsx
 * (prevents FOUC). This provider reads that class on mount and
 * keeps React state in sync for the toggle button.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  // Sync state with the class the inline script already applied
  useEffect(() => {
    const root = document.documentElement
    if (root.classList.contains('light')) {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }, [])

  // Apply class changes on toggle (not on mount — inline script handles that)
  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(next)
      localStorage.setItem('panteray-theme', next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
