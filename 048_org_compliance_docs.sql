-- ============================================================================
-- 048_org_compliance_docs.sql
-- Slice G — Org insurance + UL certification tracking (Phase 8E)
--   * org_compliance_docs (General Liability, Workers Comp, E&O, Cyber,
--     Bond, UL 827, UL 2050, UL 294)
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_compliance_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'GENERAL_LIABILITY',
    'WORKERS_COMP',
    'EO_INSURANCE',
    'CYBER_LIABILITY',
    'AUTO_INSURANCE',
    'UMBRELLA',
    'BOND',
    'UL_827',
    'UL_2050',
    'UL_294',
    'UL_10C',
    'OTHER'
  )),
  policy_number TEXT,
  carrier TEXT,
  coverage_limit NUMERIC(15,2),
  effective_date DATE,
  expiration_date DATE,
  audit_due_date DATE,
  document_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'cancelled')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_compliance_docs_org ON org_compliance_docs(org_id);
CREATE INDEX IF NOT EXISTS idx_org_compliance_docs_type ON org_compliance_docs(doc_type);
CREATE INDEX IF NOT EXISTS idx_org_compliance_docs_expiration ON org_compliance_docs(expiration_date);
CREATE INDEX IF NOT EXISTS idx_org_compliance_docs_status ON org_compliance_docs(status);

ALTER TABLE org_compliance_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_compliance_docs_org_isolation" ON org_compliance_docs;
CREATE POLICY "org_compliance_docs_org_isolation" ON org_compliance_docs
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid())
  );

GRANT ALL ON org_compliance_docs TO authenticated;
GRANT ALL ON org_compliance_docs TO service_role;

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION set_org_compliance_docs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_compliance_docs_updated_at ON org_compliance_docs;
CREATE TRIGGER trg_org_compliance_docs_updated_at
  BEFORE UPDATE ON org_compliance_docs
  FOR EACH ROW
  EXECUTE FUNCTION set_org_compliance_docs_updated_at();
