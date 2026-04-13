-- ============================================================
-- 026 — Subcontractor RFP & Labor Quoting
-- Phase 1D: OPP sub-quote tracking for RFP workflow
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TYPE opp_sub_quote_status AS ENUM ('draft', 'rfp_sent', 'quoted', 'accepted', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS opp_sub_quotes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id),
  opp_id            UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  sub_id            UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  status            opp_sub_quote_status NOT NULL DEFAULT 'draft',
  rfp_notes         TEXT,
  labor_hours       NUMERIC(10,2),
  labor_amount      NUMERIC(12,2),
  material_amount   NUMERIC(12,2),
  total_amount      NUMERIC(12,2),
  quote_doc_url     TEXT,
  rfp_sent_at       TIMESTAMPTZ,
  quote_received_at TIMESTAMPTZ,
  accepted_at       TIMESTAMPTZ,
  accepted_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  decline_reason    TEXT,
  valid_until       DATE,
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opp_sub_quotes_org ON opp_sub_quotes(org_id);
CREATE INDEX IF NOT EXISTS idx_opp_sub_quotes_opp ON opp_sub_quotes(opp_id);
CREATE INDEX IF NOT EXISTS idx_opp_sub_quotes_sub ON opp_sub_quotes(sub_id);
CREATE INDEX IF NOT EXISTS idx_opp_sub_quotes_status ON opp_sub_quotes(status);

ALTER TABLE opp_sub_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY opp_sub_quotes_org_isolation ON opp_sub_quotes
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER opp_sub_quotes_updated_at
  BEFORE UPDATE ON opp_sub_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
