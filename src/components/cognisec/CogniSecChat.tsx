'use client';

// components/CogniSecChat.tsx
// Floating chat bubble that connects to the /api/cognisec route.
// Drop this into any Panteray page or layout:
//   import CogniSecChat from '@/components/CogniSecChat';
//   <CogniSecChat userId={session.user.email} />

import { useState, useRef, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

interface CogniSecChatProps {
  userId?: string;      // Pass the logged-in user's email or ID from session
  sessionId?: string;   // Optional: pass a stable session ID for conversation memory
}

// ── Helpers ────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Parse SSE stream from Agent Engine and extract text chunks.
// Agent Engine SSE events contain JSON with content parts.
async function* parseAgentStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        // Agent Engine streaming format: content.parts[].text
        const parts = parsed?.content?.parts ?? [];
        for (const part of parts) {
          if (typeof part?.text === 'string' && part.text) {
            yield part.text;
          }
        }
      } catch {
        // Non-JSON line — skip
      }
    }
  }
}

// ── Suggested prompts ──────────────────────────────────────────────────────

const SUGGESTED = [
  'What electric strike for a HM door with cylindrical lockset?',
  'Maglock on a fire-rated door — is this code compliant?',
  'What camera for a low-light parking garage?',
  'Wiring a Von Duprin 99EL to Mercury LP1502',
];

// ── Component ──────────────────────────────────────────────────────────────

export default function CogniSecChat({ userId = 'panteray-user', sessionId }: CogniSecChatProps) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);
  const abortRef                = useRef<AbortController | null>(null);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: uid(), role: 'user', content: trimmed };
    const assistantId = uid();
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', pending: true };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setLoading(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/cognisec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, userId, sessionId }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `Error: ${err.error ?? res.statusText}`, pending: false }
            : m
        ));
        return;
      }

      const reader = res.body.getReader();
      let accumulated = '';

      for await (const chunk of parseAgentStream(reader)) {
        accumulated += chunk;
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: accumulated, pending: true } : m
        ));
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: accumulated, pending: false } : m
      ));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Connection error. Please try again.', pending: false }
          : m
      ));
    } finally {
      setLoading(false);
    }
  }, [loading, userId, sessionId]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleSuggest = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setLoading(false);
    setMessages(prev => prev.map(m =>
      m.pending ? { ...m, pending: false } : m
    ));
  };

  const handleClear = () => {
    abortRef.current?.abort();
    setLoading(false);
    setMessages([]);
    setInput('');
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* ── Global styles injected once ──────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@400;500;600;700;800&display=swap');

        :root {
          --cs-bg:          #0a0c0f;
          --cs-surface:     #111318;
          --cs-surface2:    #181c22;
          --cs-border:      #1e2530;
          --cs-border2:     #252d38;
          --cs-accent:      #00d4aa;
          --cs-accent2:     #0099ff;
          --cs-text:        #e2e8f0;
          --cs-text-muted:  #64748b;
          --cs-text-dim:    #334155;
          --cs-user-bg:     #0f2035;
          --cs-user-border: #0099ff33;
          --cs-ai-bg:       #0d1a14;
          --cs-ai-border:   #00d4aa22;
          --cs-danger:      #ef4444;
          --cs-font-ui:     'Syne', sans-serif;
          --cs-font-mono:   'JetBrains Mono', monospace;
          --cs-radius:      12px;
          --cs-shadow:      0 24px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(0,212,170,.06);
        }

        .cs-panel *,
        .cs-panel *::before,
        .cs-panel *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .cs-panel {
          font-family: var(--cs-font-ui);
          position: fixed;
          bottom: 96px;
          right: 24px;
          width: 420px;
          max-width: calc(100vw - 48px);
          height: 600px;
          max-height: calc(100vh - 140px);
          background: var(--cs-bg);
          border: 1px solid var(--cs-border);
          border-radius: var(--cs-radius);
          box-shadow: var(--cs-shadow);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 9999;
          transform-origin: bottom right;
          animation: cs-panel-in .18s cubic-bezier(.34,1.56,.64,1) both;
        }

        @keyframes cs-panel-in {
          from { opacity: 0; transform: scale(.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Header */
        .cs-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--cs-border);
          background: var(--cs-surface);
          flex-shrink: 0;
        }

        .cs-logo {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: linear-gradient(135deg, var(--cs-accent), var(--cs-accent2));
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .cs-logo svg { width: 14px; height: 14px; }

        .cs-header-text { flex: 1; min-width: 0; }

        .cs-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--cs-text);
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .cs-subtitle {
          font-size: 10px;
          color: var(--cs-text-muted);
          letter-spacing: .02em;
          margin-top: 1px;
        }

        .cs-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--cs-accent);
          box-shadow: 0 0 6px var(--cs-accent);
          flex-shrink: 0;
        }

        .cs-header-actions {
          display: flex;
          gap: 4px;
        }

        .cs-icon-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--cs-text-muted);
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          transition: color .15s, background .15s;
        }

        .cs-icon-btn:hover {
          color: var(--cs-text);
          background: var(--cs-border);
        }

        .cs-icon-btn svg { width: 14px; height: 14px; }

        /* Messages */
        .cs-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scroll-behavior: smooth;
        }

        .cs-messages::-webkit-scrollbar { width: 4px; }
        .cs-messages::-webkit-scrollbar-track { background: transparent; }
        .cs-messages::-webkit-scrollbar-thumb {
          background: var(--cs-border2);
          border-radius: 2px;
        }

        /* Empty state */
        .cs-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 16px;
          padding: 24px;
        }

        .cs-empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(0,212,170,.12), rgba(0,153,255,.12));
          border: 1px solid rgba(0,212,170,.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--cs-accent);
        }

        .cs-empty-icon svg { width: 22px; height: 22px; }

        .cs-empty h3 {
          font-size: 14px;
          font-weight: 700;
          color: var(--cs-text);
          letter-spacing: .02em;
        }

        .cs-empty p {
          font-size: 12px;
          color: var(--cs-text-muted);
          line-height: 1.6;
          max-width: 280px;
        }

        .cs-suggest-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
          max-width: 340px;
        }

        .cs-suggest-btn {
          background: var(--cs-surface2);
          border: 1px solid var(--cs-border2);
          border-radius: 8px;
          padding: 8px 12px;
          color: var(--cs-text-muted);
          font-family: var(--cs-font-ui);
          font-size: 11px;
          text-align: left;
          cursor: pointer;
          transition: all .15s;
          line-height: 1.4;
        }

        .cs-suggest-btn:hover {
          background: var(--cs-border);
          color: var(--cs-text);
          border-color: var(--cs-accent);
        }

        /* Message bubbles */
        .cs-msg {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-width: 100%;
        }

        .cs-msg-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .cs-msg-user .cs-msg-label { color: var(--cs-accent2); }
        .cs-msg-ai   .cs-msg-label { color: var(--cs-accent); }

        .cs-bubble {
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.65;
          word-break: break-word;
          white-space: pre-wrap;
        }

        .cs-msg-user .cs-bubble {
          background: var(--cs-user-bg);
          border: 1px solid var(--cs-user-border);
          color: var(--cs-text);
          font-family: var(--cs-font-ui);
        }

        .cs-msg-ai .cs-bubble {
          background: var(--cs-ai-bg);
          border: 1px solid var(--cs-ai-border);
          color: var(--cs-text);
          font-family: var(--cs-font-mono);
          font-size: 12px;
        }

        /* Cursor blink while streaming */
        .cs-cursor::after {
          content: '▋';
          display: inline-block;
          color: var(--cs-accent);
          animation: cs-blink .7s step-end infinite;
          margin-left: 2px;
        }

        @keyframes cs-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }

        /* Typing indicator */
        .cs-typing {
          display: flex;
          gap: 4px;
          align-items: center;
          padding: 10px 14px;
        }

        .cs-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--cs-accent);
          animation: cs-pulse 1.2s ease-in-out infinite;
        }

        .cs-dot:nth-child(2) { animation-delay: .2s; }
        .cs-dot:nth-child(3) { animation-delay: .4s; }

        @keyframes cs-pulse {
          0%, 100% { opacity: .3; transform: scale(.8); }
          50%       { opacity: 1;  transform: scale(1.1); }
        }

        /* Footer */
        .cs-footer {
          border-top: 1px solid var(--cs-border);
          padding: 12px;
          background: var(--cs-surface);
          flex-shrink: 0;
        }

        .cs-input-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .cs-textarea {
          flex: 1;
          background: var(--cs-surface2);
          border: 1px solid var(--cs-border2);
          border-radius: 8px;
          padding: 9px 12px;
          color: var(--cs-text);
          font-family: var(--cs-font-ui);
          font-size: 13px;
          line-height: 1.5;
          resize: none;
          outline: none;
          min-height: 38px;
          max-height: 120px;
          transition: border-color .15s;
          overflow-y: auto;
        }

        .cs-textarea::placeholder { color: var(--cs-text-dim); }

        .cs-textarea:focus {
          border-color: var(--cs-accent);
          box-shadow: 0 0 0 2px rgba(0,212,170,.08);
        }

        .cs-send-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all .15s;
        }

        .cs-send-btn:not(:disabled) {
          background: var(--cs-accent);
          color: #000;
        }

        .cs-send-btn:not(:disabled):hover {
          background: #00f0c0;
          transform: scale(1.05);
        }

        .cs-send-btn:disabled {
          background: var(--cs-border);
          color: var(--cs-text-dim);
          cursor: not-allowed;
        }

        .cs-send-btn.cs-stop {
          background: var(--cs-danger) !important;
          color: #fff !important;
        }

        .cs-send-btn svg { width: 15px; height: 15px; }

        .cs-footer-meta {
          margin-top: 7px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .cs-hint {
          font-size: 10px;
          color: var(--cs-text-dim);
        }

        .cs-clear-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 10px;
          color: var(--cs-text-dim);
          font-family: var(--cs-font-ui);
          padding: 2px 4px;
          border-radius: 3px;
          transition: color .15s;
        }

        .cs-clear-btn:hover { color: var(--cs-text-muted); }

        /* FAB trigger */
        .cs-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 16px;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, var(--cs-accent), var(--cs-accent2));
          box-shadow: 0 8px 32px rgba(0,212,170,.35), 0 2px 8px rgba(0,0,0,.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9998;
          transition: transform .15s, box-shadow .15s;
        }

        .cs-fab:hover {
          transform: scale(1.08);
          box-shadow: 0 12px 40px rgba(0,212,170,.45), 0 2px 8px rgba(0,0,0,.4);
        }

        .cs-fab svg { width: 22px; height: 22px; color: #000; }

        .cs-fab-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--cs-danger);
          border: 2px solid var(--cs-bg);
          font-size: 9px;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--cs-font-mono);
          animation: cs-badge-in .2s cubic-bezier(.34,1.56,.64,1) both;
        }

        @keyframes cs-badge-in {
          from { transform: scale(0); }
          to   { transform: scale(1); }
        }
      `}</style>

      {/* ── Chat panel ───────────────────────────────────────────────── */}
      {open && (
        <div className="cs-panel" role="dialog" aria-label="CogniSec AI Assistant">

          {/* Header */}
          <div className="cs-header">
            <div className="cs-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="cs-header-text">
              <div className="cs-title">CogniSec AI</div>
              <div className="cs-subtitle">PANDEX v1.0 · Physical Security Assistant</div>
            </div>
            <div className="cs-status-dot" title="Online" />
            <div className="cs-header-actions">
              <button className="cs-icon-btn" onClick={handleClear} title="Clear conversation">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
              </button>
              <button className="cs-icon-btn" onClick={() => setOpen(false)} title="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="cs-messages">
            {isEmpty ? (
              <div className="cs-empty">
                <div className="cs-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h3>CogniSec AI</h3>
                <p>Physical security design assistant. Hardware, access control, CCTV, code compliance, and field guidance.</p>
                <div className="cs-suggest-list">
                  {SUGGESTED.map(s => (
                    <button key={s} className="cs-suggest-btn" onClick={() => handleSuggest(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`cs-msg cs-msg-${msg.role === 'user' ? 'user' : 'ai'}`}>
                  <div className="cs-msg-label">
                    {msg.role === 'user' ? 'YOU' : 'COGNISEC'}
                  </div>
                  {msg.role === 'assistant' && msg.pending && !msg.content ? (
                    <div className="cs-bubble">
                      <div className="cs-typing">
                        <div className="cs-dot" /><div className="cs-dot" /><div className="cs-dot" />
                      </div>
                    </div>
                  ) : (
                    <div className={`cs-bubble${msg.pending ? ' cs-cursor' : ''}`}>
                      {msg.content}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Footer */}
          <div className="cs-footer">
            <div className="cs-input-row">
              <textarea
                ref={inputRef}
                className="cs-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about hardware, wiring, code, cameras..."
                rows={1}
                disabled={loading}
              />
              {loading ? (
                <button className="cs-send-btn cs-stop" onClick={handleStop} title="Stop">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                </button>
              ) : (
                <button
                  className="cs-send-btn"
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  title="Send (Enter)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="cs-footer-meta">
              <span className="cs-hint">Enter to send · Shift+Enter for new line</span>
              {messages.length > 0 && (
                <button className="cs-clear-btn" onClick={handleClear}>Clear</button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ── FAB trigger ──────────────────────────────────────────────── */}
      <button
        className="cs-fab"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close CogniSec AI' : 'Open CogniSec AI'}
        title="CogniSec AI"
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        )}
        {!open && messages.length > 0 && (
          <span className="cs-fab-badge">{messages.filter(m => m.role === 'assistant').length}</span>
        )}
      </button>
    </>
  );
}
