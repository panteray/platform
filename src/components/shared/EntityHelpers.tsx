'use client'

import { TIER_COLORS } from '@/types/enums'

export function healthBadgeColor(status: string | null): { bg: string; fg: string } {
  if (!status) return { bg: 'rgba(245,158,11,0.1)', fg: '#f59e0b' }
  const s = status.toLowerCase()
  if (s === 'active') return { bg: 'rgba(34,197,94,0.1)', fg: '#22c55e' }
  if (s.includes('review') || s.includes('approval')) return { bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6' }
  if (s.includes('risk') || s.includes('stalled')) return { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' }
  return { bg: 'rgba(245,158,11,0.1)', fg: '#f59e0b' }
}

export function tierBadgeColor(tier: string | null): { bg: string; fg: string } {
  if (!tier) return { bg: 'rgba(161,161,170,0.12)', fg: '#a1a1aa' }
  return TIER_COLORS[tier] ?? { bg: 'rgba(161,161,170,0.12)', fg: '#a1a1aa' }
}

export function scoreColor(score: number | null): string {
  if (score == null) return '#71717a'
  if (score >= 80) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

export function StatusBadge({ status }: { status: string | null }) {
  const c = healthBadgeColor(status)
  return (
    <span style={{ background: c.bg, color: c.fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {status ?? '—'}
    </span>
  )
}

export function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null
  const c = tierBadgeColor(tier)
  return (
    <span style={{ background: c.bg, color: c.fg, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {tier}
    </span>
  )
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>
  return <span style={{ color: scoreColor(score), fontSize: 12, fontWeight: 700 }}>{score}</span>
}

export function DiscountTag({ pct }: { pct: number | null }) {
  if (pct == null) return null
  return <span style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', whiteSpace: 'nowrap' }}>{pct}% off</span>
}
