-- ============================================================================
-- 051_technician_certifications.sql
-- 8B: Technician certifications (industry + state-required)
-- 8D: Subcontractor operating states for license validation
-- ============================================================================

-- ============================================================================
-- technician_certifications
-- Industry certs (NICET, ESA, ASIS, AVIXA, CompTIA, vendor) + state-required
-- ============================================================================
CREATE TABLE IF NOT EXISTS technician_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cert_body TEXT NOT NULL,
  cert_type TEXT NOT NULL,
  credential_id TEXT,
  state CHAR(2),
  issue_date DATE,
  expiration_date DATE,
  cpd_required BOOLEAN NOT NULL DEFAULT false,
  cpd_hours_completed INTEGER NOT NULL DEFAULT 0,
  cpd_hours_required INTEGER NOT NULL DEFAULT 0,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'revoked')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tech_certs_user ON technician_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_tech_certs_org ON technician_certifications(org_id);
CREATE INDEX IF NOT EXISTS idx_tech_certs_expiration ON technician_certifications(expiration_date);
CREATE INDEX IF NOT EXISTS idx_tech_certs_body ON technician_certifications(cert_body);

ALTER TABLE technician_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tech_certs_org_isolation" ON technician_certifications;
CREATE POLICY "tech_certs_org_isolation" ON technician_certifications
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid())
  );

CREATE TRIGGER technician_certifications_updated_at
  BEFORE UPDATE ON technician_certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Subcontractor operating states (for state license validation)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subcontractors' AND column_name = 'operating_states'
  ) THEN
    ALTER TABLE subcontractors ADD COLUMN operating_states TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- Grants
-- ============================================================================
GRANT ALL ON technician_certifications TO authenticated;
GRANT ALL ON technician_certifications TO service_role;
