-- ============================================================
-- 027 — Customer Portal & Acceptance
-- Phase 1E: Token-gated customer document portal
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS customer_portal_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  opp_id          UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  permissions     JSONB NOT NULL DEFAULT '["view_sow","view_quote","view_hardware_schedule"]',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  accepted_at     TIMESTAMPTZ,
  accepted_by_name TEXT,
  accepted_by_email TEXT,
  signature_data  TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_tokens_org ON customer_portal_tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_opp ON customer_portal_tokens(opp_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON customer_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_customer ON customer_portal_tokens(customer_id);

ALTER TABLE customer_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY portal_tokens_org_isolation ON customer_portal_tokens
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER portal_tokens_updated_at
  BEFORE UPDATE ON customer_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
