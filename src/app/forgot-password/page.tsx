'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950">
      <div className="w-full max-w-sm p-8">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Panteray
        </h1>
        <p className="mb-8 text-center text-sm text-neutral-400">
          Reset your password
        </p>

        {sent ? (
          <div className="text-center">
            <div className="mb-4 rounded-md border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
              If an account exists for <span className="font-medium text-white">{email}</span>, a password reset link has been sent. Check your email.
            </div>
            <Link
              href="/login"
              className="text-sm text-neutral-400 hover:text-white"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-neutral-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-neutral-600 focus:outline-none"
                required
                placeholder="you@company.com"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-white py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-neutral-400 hover:text-white"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
