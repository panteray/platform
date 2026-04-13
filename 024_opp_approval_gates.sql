-- 024_opp_approval_gates.sql
-- Phase 1B: OPP Approval Gates table + indexes + RLS

-- Approval gate types
DO $$ BEGIN
  CREATE TYPE opp_approval_gate AS ENUM (
    'QUOTE_REVIEW',
    'SOW_REVIEW',
    'PROJECT_KICKOFF',
    'CHANGE_ORDER',
    'SIGN_OFF',
    'CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Approval request statuses
DO $$ BEGIN
  CREATE TYPE opp_approval_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Approval requests table
CREATE TABLE IF NOT EXISTS opp_approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opp_id        uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  gate_type     opp_approval_gate NOT NULL,
  status        opp_approval_status NOT NULL DEFAULT 'PENDING',
  target_status text,  -- the OPP status being transitioned TO
  requested_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  request_notes text,
  review_notes  text,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_opp_approvals_opp_id ON opp_approvals(opp_id);
CREATE INDEX IF NOT EXISTS idx_opp_approvals_org_id ON opp_approvals(org_id);
CREATE INDEX IF NOT EXISTS idx_opp_approvals_status ON opp_approvals(status);
CREATE INDEX IF NOT EXISTS idx_opp_approvals_requested_by ON opp_approvals(requested_by);

-- RLS
ALTER TABLE opp_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opp_approvals_org_isolation ON opp_approvals;
CREATE POLICY opp_approvals_org_isolation ON opp_approvals
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- Auto-update trigger
CREATE OR REPLACE TRIGGER opp_approvals_updated_at
  BEFORE UPDATE ON opp_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
