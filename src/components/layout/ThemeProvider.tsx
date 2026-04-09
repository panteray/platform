'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'daylight' | 'morning' | 'dusk' | 'midnight'

const THEMES: Theme[] = ['morning', 'daylight', 'dusk', 'midnight']
const NON_DEFAULT_THEMES: Theme[] = ['morning', 'dusk', 'midnight'] // daylight = :root (no class)

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  themes: readonly Theme[]
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'daylight',
  setTheme: () => {},
  themes: THEMES,
})

/**
 * ThemeProvider — 4 time-of-day themes.
 *
 * Daylight is the default (:root CSS, no class needed).
 * Morning/Dusk/Midnight each add their class to <html>.
 * FOUC prevention inline script in layout.tsx handles pre-paint.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('daylight')

  // Sync state with the class the inline script already applied
  useEffect(() => {
    const root = document.documentElement
    for (const t of NON_DEFAULT_THEMES) {
      if (root.classList.contains(t)) {
        setThemeState(t)
        return
      }
    }
    setThemeState('daylight')
  }, [])

  const setTheme = (next: Theme) => {
    const root = document.documentElement
    root.classList.remove(...NON_DEFAULT_THEMES)
    if (next !== 'daylight') {
      root.classList.add(next)
    }
    localStorage.setItem('panteray-theme', next)
    setThemeState(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
