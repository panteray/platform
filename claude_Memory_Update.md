# Claude Memory Update — 2026-07-17 — 19-Step Workflow Alignment (Phases 1–5 COMPLETE)

> Written to the repo because Dullnote was unreachable (all reads/writes timed
> out). Merge into `/PANTERAY/PANTERAY_Master_Memory.md` sections when Dullnote
> is reachable again.

---

## Active Work

- 19-step Opportunity → Project → Closure workflow alignment: **ALL 5 PHASES SHIPPED** to main and deployed via Cloud Build.
- Pending Dexter: run the pg_cron job SQL for automated start reminders (needs service role key pasted in — SQL is in the `064_phase4_kickoffs_reminders.sql` footer).
- Pending Dexter: browser testing of all new surfaces.

## Completed (this session)

| Phase | Commit | Contents |
|---|---|---|
| 1 — Schema foundation | `5024cbe` + fix `0546455` | 8 new OppStatus values (ORDER_ENTRY, SHIP_HOLD, PM_ASSIGNMENT, IKOM, CKOM, SCHEDULING, OPERATIONAL_VALIDATION, OPERATIONAL_CLOSURE); `project_team_role` +ISR/OPS; `opp_outcome` enum; 6 new opportunities columns; auto-seeded 5 project milestones. Migrations 061 + 062 ran clean. |
| 2 — Order Entry / Won-Lost / Ship Hold | `453bb1c` | OutcomeSection (Won/Lost + Payment Agreement) and ShipHoldSection on opp Overview; Order Entry queue `/org/ops/order-entry`; new Ops sidebar group; CustomerIntroAction on project detail. Verified live in browser. |
| 3 — Scheduling | `e1b4d6e` | `scheduling_requests` table (soft_book / hard_book / cancelled); Scheduling tab on project detail; opp auto-transitions CKOM→SCHEDULING (create) and SCHEDULING→AWAITING_DELIVERY (hard book). Migration 063 ran clean. |
| 4 — Kickoffs + Reminders + Portal | `59bd7f8` | Meetings tab (full minutes editor: attendees, action items, decisions); KickoffsSection banner (IKOM/CKOM quick tracker); `held_at` + opp transitions IKOM→CKOM→SCHEDULING; ProjectStartReminderAction; `/api/cron/start-reminders` (service-role bearer auth, 7-day window); customer kickoff portal `/portal/kickoff/[token]` + `meeting_portal_tokens`. Migration 064 ran clean. Cron job SQL NOT yet scheduled. |
| 5 — Ops Validation + Closure | `8c0c238` | `operational_validations` table (5-check gate: SOS uploaded, sub PO, sub invoice, customer PO, clean SOS; N/A escapes on sub checks); Ops tab on project detail; Payment Received → project `operational_closure` + opp OPERATIONAL_CLOSURE; Close → opp CLOSED; `/org/ops/validation` queue. Migration 065 ran clean. |

## Rejected

- Rewriting/force-pushing main to clear GitHub "Unverified" commit badges (no GPG key on runner; cosmetic only; Dexter chose "do nothing").
- Payment-processor integration for step 19 — Payment Received is a manual Ops confirmation.
- Smartsheet integration for SOS upload — SOS lives in-platform.

## Feature Status changes

- Opportunity pipeline: 27 statuses (was 19), full 19-step diagram coverage.
- New routes: `/org/ops/order-entry`, `/org/ops/validation`, `/portal/kickoff/[token]`.
- Project detail tabs added: Meetings, Scheduling, Ops. Banners above tabs: Customer Intro, Kickoffs, Start Reminder.
- New tables: `scheduling_requests`, `meeting_portal_tokens`, `operational_validations`.
- New columns: `projects.start_reminder_sent_at`, `meeting_minutes.held_at`, opportunities `outcome` / `lost_reason` / `payment_agreement_signed_at` / `payment_terms` / `ship_hold_cleared_at` / `customer_intro_sent_at`.
- Role mapping (per Dexter): PMO = PM, ISR = Inside Sales Rep, SA = Presales (`PRESALES`), Ops = Operations (`OPS`).

## Incidents / Learnings

- **opportunities.status IS a Postgres enum (`opp_status`)** — its CREATE TYPE is not in the repo's migration files (predates 023). Migration 061 missed the DB-side values; 062 fixed it. Always assume DB enums may exist even when not found in repo SQL.
- Cloud Build "Couldn't read commit" failures (`59bd7f8`, `d8e61a7`) were a GitHub-wide API 503 incident, not code — verified by GitHub API 503s on old known-good commits. Resolved on its own; empty commit `d8e61a7` used as retrigger.
- `meeting_minutes` (migration 030) is the meetings table — there is no `project_meetings` table.
- `ALTER TYPE ... ADD VALUE` cannot run inside a transaction — must run statement-at-a-time in Supabase SQL Editor.
- FK note unchanged: no FK between `design_devices` and `device_library_items`.

## Last Action

- Commit `8c0c238` — "Phase 5: Operational Validation gate + Operational Closure (steps 18, 19)" — pushed to main, built successfully, migration 065 ran clean.
