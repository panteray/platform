'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Lightbulb, ChevronDown, ChevronUp, X } from 'lucide-react'

type KedbMatch = {
  id: string
  kedb_number: string
  title: string
  symptoms: string
  workaround: string | null
  category: string | null
  score: number
}

export function KedbMatchBanner({ title, description, category }: {
  title: string
  description?: string | null
  category?: string | null
}) {
  const [matches, setMatches] = useState<KedbMatch[]>([])
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!title) return
    fetch('/api/org/psa/kedb/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, category }),
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: KedbMatch[]) => setMatches(data))
      .catch(() => setMatches([]))
  }, [title, description, category])

  if (dismissed || matches.length === 0) return null

  const top = matches[0]

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
              Known Error Match{matches.length > 1 ? ` (${matches.length})` : ''}
            </div>
            <div className="flex items-center gap-1">
              {matches.length > 1 && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="p-0.5 text-amber-700 hover:bg-amber-100 rounded"
                  title={expanded ? 'Collapse' : 'Expand'}
                >
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="p-0.5 text-amber-700 hover:bg-amber-100 rounded"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <KedbEntryRow match={top} />

          {expanded && matches.slice(1).map(m => (
            <div key={m.id} className="mt-2 pt-2 border-t border-amber-100">
              <KedbEntryRow match={m} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function KedbEntryRow({ match }: { match: KedbMatch }) {
  return (
    <div className="mt-1">
      <Link
        href={`/org/psa/kedb/${match.id}`}
        className="text-sm font-medium text-amber-900 hover:underline"
      >
        <span className="font-mono text-xs text-amber-700 mr-1.5">{match.kedb_number}</span>
        {match.title}
      </Link>
      <div className="text-xs text-amber-700 mt-0.5 line-clamp-2">{match.symptoms}</div>
      {match.workaround && (
        <div className="text-xs text-amber-800 mt-1">
          <span className="font-semibold">Workaround:</span> {match.workaround}
        </div>
      )}
      <div className="text-[10px] text-amber-600 mt-0.5">Match: {(match.score * 100).toFixed(0)}%</div>
    </div>
  )
}
