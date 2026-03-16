'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Send, Trash2 } from 'lucide-react'
import type { OppHuddleMessage } from '@/types/database'
import { HUDDLE_ADMIN_ROLES } from '@/types/enums'

type AuthorInfo = { id: string; first_name: string; last_name: string; email: string; role: string }
type OrgUser = { id: string; first_name: string; last_name: string; email: string; role: string }

interface HuddleTabProps {
  oppId: string
  callerRole: string | null
  callerUserId: string | null
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function renderMessageWithMentions(text: string) {
  const parts = text.split(/(@\w+(?:\s\w+)?)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? <span key={i} className="text-primary font-medium">{part}</span> : <span key={i}>{part}</span>
  )
}

export function HuddleTab({ oppId, callerRole, callerUserId }: HuddleTabProps) {
  const [messages, setMessages] = useState<OppHuddleMessage[]>([])
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [mentionSearch, setMentionSearch] = useState<string | null>(null)
  const [mentionIdx, setMentionIdx] = useState(0)
  const [pendingMentions, setPendingMentions] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isAdmin = callerRole ? (HUDDLE_ADMIN_ROLES as readonly string[]).includes(callerRole) : false

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/org/opportunities/${oppId}/huddle`)
    if (res.ok) setMessages(await res.json())
    setLoading(false)
  }, [oppId])

  useEffect(() => {
    const t = setTimeout(() => {
      void Promise.all([
        loadMessages(),
        fetch('/api/org/users').then(async (r) => {
          if (r.ok) setOrgUsers(await r.json())
        }),
      ])
    }, 0)
    return () => clearTimeout(t)
  }, [loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const filteredMentionUsers = mentionSearch !== null
    ? orgUsers.filter((u) => {
        const full = `${u.first_name} ${u.last_name}`.toLowerCase()
        return full.includes(mentionSearch.toLowerCase())
      }).slice(0, 6)
    : []

  function handleTextChange(val: string) {
    setText(val)
    const cursorPos = inputRef.current?.selectionStart ?? val.length
    const beforeCursor = val.slice(0, cursorPos)
    const atIdx = beforeCursor.lastIndexOf('@')
    if (atIdx >= 0 && (atIdx === 0 || beforeCursor[atIdx - 1] === ' ')) {
      const query = beforeCursor.slice(atIdx + 1)
      if (!query.includes(' ') || query.length < 20) {
        setMentionSearch(query)
        setMentionIdx(0)
        return
      }
    }
    setMentionSearch(null)
  }

  function insertMention(user: OrgUser) {
    const cursorPos = inputRef.current?.selectionStart ?? text.length
    const beforeCursor = text.slice(0, cursorPos)
    const atIdx = beforeCursor.lastIndexOf('@')
    const afterCursor = text.slice(cursorPos)
    const mentionText = `@${user.first_name} ${user.last_name} `
    const newText = beforeCursor.slice(0, atIdx) + mentionText + afterCursor
    setText(newText)
    setMentionSearch(null)
    setPendingMentions((prev) => [...prev, user.id])
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (mentionSearch !== null && filteredMentionUsers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx((i) => Math.min(i + 1, filteredMentionUsers.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMentionUsers[mentionIdx]); return }
      if (e.key === 'Escape') { setMentionSearch(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  async function sendMessage() {
    if (!text.trim() || sending) return
    setSending(true)
    const res = await fetch(`/api/org/opportunities/${oppId}/huddle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim(), mentions: pendingMentions.length > 0 ? pendingMentions : undefined }),
    })
    if (res.ok) { setText(''); setPendingMentions([]); await loadMessages() }
    setSending(false)
  }

  async function deleteMessage(messageId: string) {
    const res = await fetch(`/api/org/opportunities/${oppId}/huddle/${messageId}`, { method: 'DELETE' })
    if (res.ok) setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, is_deleted: true } : m))
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading huddle...</p>

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-2">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation.</p>
        )}
        {messages.map((m) => {
          const author = (m as unknown as Record<string, unknown>).author as AuthorInfo | null
          const authorName = author ? `${author.first_name} ${author.last_name}` : 'Unknown'
          const isOwn = m.author_id === callerUserId
          const canDelete = isAdmin || isOwn

          return (
            <div key={m.id} className="group flex gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-foreground">{authorName}</span>
                  {author?.role && <span className="text-[10px] text-muted-foreground">{author.role.replace(/_/g, ' ')}</span>}
                  <span className="text-[10px] text-muted-foreground">{formatTime(m.created_at)}</span>
                </div>
                {m.is_deleted ? (
                  <p className="text-sm italic text-muted-foreground">Message deleted</p>
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words text-foreground">{renderMessageWithMentions(m.message)}</p>
                )}
              </div>
              {canDelete && !m.is_deleted && (
                <button onClick={() => deleteMessage(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 flex-shrink-0 mt-1" title="Delete message">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="relative border-t border-border pt-3 mt-2">
        {mentionSearch !== null && filteredMentionUsers.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 w-64 rounded-md border border-border bg-card shadow-md z-10 max-h-48 overflow-y-auto">
            {filteredMentionUsers.map((u, idx) => (
              <button key={u.id} onClick={() => insertMention(u)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${idx === mentionIdx ? 'bg-muted' : ''}`}>
                {u.first_name} {u.last_name}
                <span className="ml-2 text-xs text-muted-foreground">{u.role.replace(/_/g, ' ')}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... Use @ to mention"
            rows={2}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <button onClick={sendMessage} disabled={!text.trim() || sending}
            className="self-end h-9 w-9 rounded-md bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
