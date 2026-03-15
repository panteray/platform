'use client'

import { useRouter } from 'next/navigation'
import { Search, Sun, Moon, HelpCircle, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/layout/ThemeProvider'
import { Button } from '@/components/ui/button'

export function Topbar() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="flex h-14 min-h-[56px] items-center justify-between border-b border-border bg-card px-6">
      {/* Search */}
      <div className="flex max-w-[400px] flex-1 items-center gap-2 rounded-md border border-input bg-secondary px-3 py-1.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search on email, name or role"
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={toggleTheme} className="h-[34px] w-[34px]">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="default" size="sm" className="ml-2 gap-1.5">
          <HelpCircle className="h-4 w-4" />
          Help
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  )
}
