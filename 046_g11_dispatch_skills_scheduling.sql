-- ============================================================================
-- G11 — Dispatch skills routing + P4/P5 customer self-scheduling
-- ============================================================================
-- Adds:
--   1. psa_tickets.required_skills — text[] for skills-based tech filtering
--   2. dispatch_schedule_tokens — token-gated customer appointment booking
--      for P4/P5 priority tickets
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. required_skills column on psa_tickets
-- ----------------------------------------------------------------------------
ALTER TABLE psa_tickets
  ADD COLUMN IF NOT EXISTS required_skills TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_psa_tickets_required_skills
  ON psa_tickets USING GIN (required_skills);

-- ----------------------------------------------------------------------------
-- 2. dispatch_schedule_tokens — customer self-scheduling
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dispatch_schedule_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id     UUID NOT NULL REFERENCES psa_tickets(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  used_at       TIMESTAMPTZ,
  assignment_id UUID REFERENCES psa_dispatch_assignments(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_tokens_token
  ON dispatch_schedule_tokens(token);
CREATE INDEX IF NOT EXISTS idx_schedule_tokens_org
  ON dispatch_schedule_tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_schedule_tokens_ticket
  ON dispatch_schedule_tokens(ticket_id);

ALTER TABLE dispatch_schedule_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_tokens_org_isolation ON dispatch_schedule_tokens;
CREATE POLICY schedule_tokens_org_isolation ON dispatch_schedule_tokens
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
