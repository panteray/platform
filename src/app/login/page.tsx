'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-pt-purple/8 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[500px] -translate-x-1/4 translate-y-1/4 rounded-full bg-pt-teal/5 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[380px] px-6">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-primary-icon.svg" alt="Panteray" className="h-14 w-14" />
        </div>
        <h1 className="mb-1 text-center text-2xl font-bold tracking-tight text-white">
          Welcome back
        </h1>
        <p className="mb-8 text-center text-sm text-slate-400">
          Sign in to Panteray
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700/60 bg-slate-800/50 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-pt-purple/60 focus:outline-none focus:ring-1 focus:ring-pt-purple/30"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700/60 bg-slate-800/50 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-pt-purple/60 focus:outline-none focus:ring-1 focus:ring-pt-purple/30"
              placeholder="Enter your password"
              required
            />
          </div>
          {error && (
            <p className="rounded-md bg-pt-red/10 px-3 py-2 text-[13px] text-pt-red">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-b from-pt-purple-light to-pt-purple py-2.5 text-sm font-semibold text-white shadow-pt-md transition-all hover:from-pt-purple hover:to-pt-purple-dark disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <div className="pt-1 text-center">
            <Link
              href="/forgot-password"
              className="text-[13px] text-slate-400 transition-colors hover:text-pt-purple-light"
            >
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
