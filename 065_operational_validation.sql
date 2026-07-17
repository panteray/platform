-- ============================================================
-- 065 — Operational Validation & Closure
-- Phase 5 of 5: steps 18 (Operational Validation) and
-- 19 (Project Closure) of the 19-step workflow
-- ============================================================
-- Transaction-safe: run as one block in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS operational_validations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id),
  project_id                UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

  -- Step 18 checklist
  sos_uploaded_at           TIMESTAMPTZ,
  sos_uploaded_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  sub_po_confirmed_at       TIMESTAMPTZ,
  sub_po_confirmed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  sub_po_na                 BOOLEAN NOT NULL DEFAULT FALSE,
  sub_invoice_confirmed_at  TIMESTAMPTZ,
  sub_invoice_confirmed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  sub_invoice_na            BOOLEAN NOT NULL DEFAULT FALSE,
  customer_po_confirmed_at  TIMESTAMPTZ,
  customer_po_confirmed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  clean_sos_confirmed_at    TIMESTAMPTZ,
  clean_sos_confirmed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at              TIMESTAMPTZ,   -- stamped when all 5 checks pass

  -- Step 19 closure
  payment_received_at       TIMESTAMPTZ,
  payment_received_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at                 TIMESTAMPTZ,

  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_validation_org ON operational_validations(org_id);
CREATE INDEX IF NOT EXISTS idx_ops_validation_project ON operational_validations(project_id);

ALTER TABLE operational_validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ops_validation_org_isolation ON operational_validations;
CREATE POLICY ops_validation_org_isolation ON operational_validations
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS operational_validations_updated_at ON operational_validations;
CREATE TRIGGER operational_validations_updated_at
  BEFORE UPDATE ON operational_validations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
