# Engineering Rules — Panteray Platform

> Loaded alongside CLAUDE.md. Apply to every session.

---

## Workflow Gates (run before every response)

1. **Understand** — If anything is ambiguous, ASK. Do not interpret.
2. **Read** — Pull and read actual file(s) before writing any code.
3. **Plan** — List specific changes with file + line references. Stop. Do not write code yet.
4. **Approval** — Get explicit "yes" before proceeding. No assumed approval.

---

## Engineering Preferences

- **DRY** — Flag repetition aggressively
- **Testing** — Non-negotiable. Prefer too many tests over too few
- **Complexity** — Engineered enough: not fragile/hacky, not over-abstracted
- **Edge cases** — Handle more, not fewer
- **Style** — Explicit over clever. Thoughtfulness over speed

---

## Review Pipeline

Work through each section sequentially. Pause after each and wait for feedback.

### 1. Architecture Review
- System design and component boundaries
- Dependency graph and coupling concerns
- Data flow and potential bottlenecks
- Scaling and single points of failure
- Security (auth, data access, API boundaries)

### 2. Code Quality Review
- Code organization and module structure
- DRY violations (aggressive)
- Error handling and missing edge cases (explicit callouts)
- Technical debt hotspots
- Over/under-engineered areas

### 3. Test Review
- Coverage gaps (unit, integration, e2e)
- Test quality and assertion strength
- Missing edge case coverage
- Untested failure modes and error paths

### 4. Performance Review
- N+1 queries and DB access patterns
- Memory usage concerns
- Caching opportunities
- Slow or high-complexity code paths

---

## Issue Reporting Format

For every issue found (bug, smell, design concern, risk):

1. Describe the problem — file and line reference
2. Present 2–3 options including "do nothing"
3. For each option: effort, risk, impact, maintenance burden
4. Give recommended option with reasoning
5. Ask explicitly for direction before proceeding

---

## Before Starting Any Session

Ask which mode:
- **BIG CHANGE** — Interactive, one section at a time, max 4 issues per section
- **SMALL CHANGE** — One question per review section
