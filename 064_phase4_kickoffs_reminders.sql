-- ============================================================
-- 064 — Phase 4: IKOM/CKOM kickoffs, start reminders, kickoff portal
-- Steps 11, 12, 14 of the 19-step workflow
-- ============================================================
-- Transaction-safe: run as one block in Supabase SQL Editor.
-- (The pg_cron scheduling SQL is separate — see bottom comment.)
-- ============================================================

-- 1. Manual/automated Project Start Reminder stamp
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_reminder_sent_at TIMESTAMPTZ;

-- 2. Kickoff completion marker on meetings
ALTER TABLE meeting_minutes
  ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ;

-- 3. Customer-facing kickoff portal tokens
CREATE TABLE IF NOT EXISTS meeting_portal_tokens (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id),
  meeting_id           UUID NOT NULL REFERENCES meeting_minutes(id) ON DELETE CASCADE,
  token                TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  acknowledged_at      TIMESTAMPTZ,
  acknowledged_by_name TEXT,
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_portal_tokens_meeting ON meeting_portal_tokens(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_portal_tokens_org ON meeting_portal_tokens(org_id);

ALTER TABLE meeting_portal_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_portal_tokens_org_isolation ON meeting_portal_tokens;
CREATE POLICY meeting_portal_tokens_org_isolation ON meeting_portal_tokens
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- ============================================================
-- pg_cron scheduling (run separately AFTER the app deploys):
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--
--   SELECT cron.schedule(
--     'project-start-reminders-daily',
--     '0 12 * * *',
--     $$
--     SELECT net.http_post(
--       url     := 'https://<YOUR-APP-URL>/api/cron/start-reminders',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>',
--         'Content-Type', 'application/json'
--       ),
--       body    := '{}'::jsonb
--     )
--     $$
--   );
-- ============================================================
