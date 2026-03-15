'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { roleLabel } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UserDivision } from '@/types/enums'

const DIVISION_LABELS: Record<string, string> = {
  SEC: 'Security', AV: 'Audio/Video', NET: 'Networking',
  CYB: 'Cybersecurity', MSP: 'MSP', SVC: 'Service',
  SALES: 'Sales', OPS: 'Operations',
}

const ORG_ASSETS_BUCKET = 'org-assets'
const AVATAR_SIGNED_EXPIRY = 3600

interface ProfileData {
  id: string
  org_id: string | null
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  title: string | null
  role: string
  divisions: UserDivision[]
  region: string | null
  region_state: string | null
  avatar_url: string | null
  created_at: string
  org_name: string | null
}

export default function ProfilePage() {
  const { user } = useUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [avatarDisplayUrl, setAvatarDisplayUrl] = useState<string | null>(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    title: '',
  })
  const [dirty, setDirty] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [changingPw, setChangingPw] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) { setLoading(false); return }
      const data: ProfileData = await res.json()
      setProfile(data)
      setForm({
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        phone: data.phone ?? '',
        title: data.title ?? '',
      })
      setDirty(false)

      // Resolve avatar URL
      if (data.avatar_url) {
        if (data.avatar_url.startsWith('http')) {
          setAvatarDisplayUrl(data.avatar_url)
        } else {
          const supabase = createClient()
          const { data: signed } = await supabase.storage
            .from(ORG_ASSETS_BUCKET)
            .createSignedUrl(data.avatar_url, AVATAR_SIGNED_EXPIRY)
          setAvatarDisplayUrl(signed?.signedUrl ?? null)
        }
      }
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadProfile() }, [loadProfile])

  async function handleSave() {
    if (!dirty) return
    setSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setDirty(false)
      setProfile((p) => p ? { ...p, ...form } : null)
    }
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile?.id || !profile?.org_id) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return

    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${profile.org_id}/avatars/${profile.id}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from(ORG_ASSETS_BUCKET)
      .upload(path, file, { upsert: true })

    if (!uploadErr) {
      // Save path to profile
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: path }),
      })
      // Get signed URL for display
      const { data: signed } = await supabase.storage
        .from(ORG_ASSETS_BUCKET)
        .createSignedUrl(path, AVATAR_SIGNED_EXPIRY)
      setAvatarDisplayUrl(signed?.signedUrl ?? null)
      setProfile((p) => p ? { ...p, avatar_url: path } : null)
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleChangePassword() {
    setPasswordMsg(null)
    if (passwordForm.newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' })
      return
    }
    setChangingPw(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: passwordForm.newPassword }),
    })
    if (res.ok) {
      setPasswordMsg({ type: 'success', text: 'Password changed successfully' })
      setPasswordForm({ newPassword: '', confirmPassword: '' })
    } else {
      const data = await res.json()
      setPasswordMsg({ type: 'error', text: data.error ?? 'Failed to change password' })
    }
    setChangingPw(false)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-medium">Profile</h1>
        <p className="text-sm text-muted-foreground">Profile not found.</p>
      </div>
    )
  }

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email
  const initials = [profile.first_name?.[0], profile.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '??'
  const roleLbl = roleLabel(profile.role as Parameters<typeof roleLabel>[0])

  return (
    <div className="max-w-2xl">
      <Link
        href="/org/management"
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Management
      </Link>

      <h1 className="mb-6 text-lg font-medium">My Profile</h1>

      {/* Avatar + summary */}
      <div className="mb-6 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            {avatarDisplayUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarDisplayUrl}
                alt="Avatar"
                className="h-20 w-20 rounded-full border-2 border-border object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-blue-500 bg-zinc-900 text-xl font-semibold text-white">
                {initials}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 rounded-full bg-blue-500 p-1.5 shadow-md hover:bg-blue-600 disabled:opacity-50"
              aria-label="Upload photo"
            >
              <Camera className="h-3.5 w-3.5 text-white" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{fullName}</p>
            <p className="text-sm text-muted-foreground">{roleLbl}</p>
            {profile.title && <p className="text-xs text-muted-foreground">{profile.title}</p>}
          </div>
        </div>
      </div>

      {/* Read-only info */}
      <div className="mb-6 space-y-3 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Profile Information</h2>
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="font-medium text-muted-foreground">Email</dt>
            <dd className="text-foreground">{profile.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Role</dt>
            <dd className="text-foreground">{roleLbl}</dd>
          </div>
          {profile.divisions?.length > 0 && (
            <div>
              <dt className="mb-1 font-medium text-muted-foreground">Divisions</dt>
              <dd className="flex flex-wrap gap-1.5">
                {profile.divisions.map((d) => (
                  <span key={d} className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                    {DIVISION_LABELS[d] ?? d}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {profile.region && (
            <div>
              <dt className="font-medium text-muted-foreground">Region</dt>
              <dd className="text-foreground">{profile.region}{profile.region_state ? `, ${profile.region_state}` : ''}</dd>
            </div>
          )}
          <div>
            <dt className="font-medium text-muted-foreground">Joined</dt>
            <dd className="text-foreground">{new Date(profile.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

      {/* Editable fields */}
      <div className="mb-6 space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Edit Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">First name</Label>
            <Input
              value={form.first_name}
              onChange={(e) => { setForm((f) => ({ ...f, first_name: e.target.value })); setDirty(true) }}
              placeholder="First"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Last name</Label>
            <Input
              value={form.last_name}
              onChange={(e) => { setForm((f) => ({ ...f, last_name: e.target.value })); setDirty(true) }}
              placeholder="Last"
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs font-medium text-muted-foreground">Title</Label>
          <Input
            value={form.title}
            onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setDirty(true) }}
            placeholder="e.g. Lead Technician"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); setDirty(true) }}
            placeholder="(504) 555-0000"
            className="mt-1"
          />
        </div>
        {dirty && (
          <Button size="sm" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      {/* Password */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          Change Password
        </h2>
        <div className="grid max-w-sm gap-4">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">New password</Label>
            <Input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              placeholder="Min 8 characters"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Confirm password</Label>
            <Input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="Confirm password"
              className="mt-1"
            />
          </div>
        </div>
        {passwordMsg && (
          <p className={`text-sm font-medium ${passwordMsg.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
            {passwordMsg.text}
          </p>
        )}
        <Button size="sm" disabled={changingPw} onClick={handleChangePassword}>
          {changingPw ? 'Changing...' : 'Change Password'}
        </Button>
      </div>
    </div>
  )
}
