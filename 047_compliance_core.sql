-- ============================================================================
-- 047_compliance_core.sql
-- Phase 8 — Compliance Engine core
--   * state_licensing_reference (shared 50-state + DC reference, no org_id)
--   * technician_licenses (org-scoped per-user license records)
--   * dispatch compliance helper view
-- ============================================================================

-- ============================================================================
-- state_licensing_reference
-- Shared reference table. No org_id — same data for every tenant.
-- Status values:
--   LICENSE_REQUIRED   — state issues a dedicated low-voltage/alarm license
--   NO_STATE_LICENSE   — no state-level license; local/municipal only
--   ELECTRICIAN_LICENSE— state requires electrician license for LV work
-- ============================================================================
CREATE TABLE IF NOT EXISTS state_licensing_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state CHAR(2) NOT NULL,
  license_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('LICENSE_REQUIRED', 'NO_STATE_LICENSE')),
  requirements_summary TEXT,
  agency_name TEXT,
  agency_url TEXT,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (state, license_type)
);

CREATE INDEX IF NOT EXISTS idx_state_licensing_state ON state_licensing_reference(state);
CREATE INDEX IF NOT EXISTS idx_state_licensing_status ON state_licensing_reference(status);

ALTER TABLE state_licensing_reference ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user (reference data)
DROP POLICY IF EXISTS "state_licensing_read_all" ON state_licensing_reference;
CREATE POLICY "state_licensing_read_all" ON state_licensing_reference
  FOR SELECT TO authenticated
  USING (true);

-- Only ORG_ADMIN / GLOBAL_ADMIN can mutate (maintenance UI is deferred)
DROP POLICY IF EXISTS "state_licensing_admin_write" ON state_licensing_reference;
CREATE POLICY "state_licensing_admin_write" ON state_licensing_reference
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('ORG_ADMIN', 'GLOBAL_ADMIN')
    )
  );

-- ============================================================================
-- technician_licenses
-- Per-user license records, org-scoped.
-- ============================================================================
CREATE TABLE IF NOT EXISTS technician_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_type TEXT NOT NULL,
  license_number TEXT,
  state CHAR(2) NOT NULL,
  issued_date DATE,
  expiration_date DATE,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'revoked')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tech_licenses_user ON technician_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_tech_licenses_org ON technician_licenses(org_id);
CREATE INDEX IF NOT EXISTS idx_tech_licenses_state ON technician_licenses(state);
CREATE INDEX IF NOT EXISTS idx_tech_licenses_expiration ON technician_licenses(expiration_date);

ALTER TABLE technician_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tech_licenses_org_isolation" ON technician_licenses;
CREATE POLICY "tech_licenses_org_isolation" ON technician_licenses
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid())
  );

-- Seed data removed — see 050_org_state_licensing.sql for verified data (Dexter CSV + JVSG 2026-04-15)

-- ============================================================================
-- Grants
-- ============================================================================
GRANT SELECT ON state_licensing_reference TO authenticated;
GRANT ALL ON state_licensing_reference TO service_role;
GRANT ALL ON technician_licenses TO authenticated;
GRANT ALL ON technician_licenses TO service_role;
