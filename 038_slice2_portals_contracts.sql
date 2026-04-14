-- ============================================================================
-- Migration 038 — Slice 2: Customer Account Portal + Sub Compliance + Contract Builder
-- Phase 7D + 7E + 7F
-- ============================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE customer_portal_scope AS ENUM ('OPP_ACCEPT', 'CUSTOMER_ACCOUNT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customer_portal_request_type AS ENUM ('TICKET', 'QUOTE', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customer_portal_request_status AS ENUM ('NEW', 'TRIAGED', 'CONVERTED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_template_type AS ENUM (
    'MSA', 'SLA_ADDENDUM', 'SOW', 'MONITORING', 'PM',
    'MSSP', 'AVAAS', 'SUB_MASTER', 'WORK_ORDER', 'NDA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_template_status AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE generated_contract_status AS ENUM (
    'DRAFT', 'PENDING_REVIEW', 'SENT', 'PARTIAL_SIGN',
    'ACTIVE', 'EXPIRED', 'CANCELLED', 'AMENDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- ALTER customer_portal_tokens (027) ----------
ALTER TABLE customer_portal_tokens
  ALTER COLUMN opp_id DROP NOT NULL;

ALTER TABLE customer_portal_tokens
  ADD COLUMN IF NOT EXISTS scope customer_portal_scope NOT NULL DEFAULT 'OPP_ACCEPT';

-- ---------- ALTER subcontractors ----------
ALTER TABLE subcontractors
  ADD COLUMN IF NOT EXISTS compliance_hold BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE subcontractors
  ADD COLUMN IF NOT EXISTS compliance_hold_reason TEXT;

ALTER TABLE subcontractors
  ADD COLUMN IF NOT EXISTS compliance_recalc_at TIMESTAMPTZ;

-- ---------- recalculate_sub_compliance() ----------
-- Sets compliance_hold = TRUE if any required doc type is missing or expired.
-- Required doc types: license, coi (GL), bond
CREATE OR REPLACE FUNCTION recalculate_sub_compliance(p_sub_id UUID)
RETURNS VOID AS $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_expired TEXT[] := ARRAY[]::TEXT[];
  v_required TEXT[] := ARRAY['license', 'coi', 'bond'];
  v_doc_type TEXT;
  v_count INTEGER;
  v_expired_count INTEGER;
  v_reason TEXT;
BEGIN
  FOREACH v_doc_type IN ARRAY v_required LOOP
    SELECT COUNT(*) INTO v_count
    FROM sub_documents
    WHERE sub_id = p_sub_id
      AND doc_type::TEXT = v_doc_type
      AND is_active = TRUE;

    IF v_count = 0 THEN
      v_missing := array_append(v_missing, v_doc_type);
    ELSE
      SELECT COUNT(*) INTO v_expired_count
      FROM sub_documents
      WHERE sub_id = p_sub_id
        AND doc_type::TEXT = v_doc_type
        AND is_active = TRUE
        AND expires_at IS NOT NULL
        AND expires_at < CURRENT_DATE;

      IF v_expired_count > 0 THEN
        v_expired := array_append(v_expired, v_doc_type);
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 OR array_length(v_expired, 1) > 0 THEN
    v_reason := '';
    IF array_length(v_missing, 1) > 0 THEN
      v_reason := v_reason || 'Missing: ' || array_to_string(v_missing, ', ');
    END IF;
    IF array_length(v_expired, 1) > 0 THEN
      IF v_reason <> '' THEN v_reason := v_reason || ' | '; END IF;
      v_reason := v_reason || 'Expired: ' || array_to_string(v_expired, ', ');
    END IF;

    UPDATE subcontractors
    SET compliance_hold = TRUE,
        compliance_hold_reason = v_reason,
        compliance_recalc_at = NOW()
    WHERE id = p_sub_id;
  ELSE
    UPDATE subcontractors
    SET compliance_hold = FALSE,
        compliance_hold_reason = NULL,
        compliance_recalc_at = NOW()
    WHERE id = p_sub_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalc whenever sub_documents change
CREATE OR REPLACE FUNCTION trg_recalc_sub_compliance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_sub_compliance(OLD.sub_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_sub_compliance(NEW.sub_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sub_documents_recalc_compliance ON sub_documents;
CREATE TRIGGER sub_documents_recalc_compliance
  AFTER INSERT OR UPDATE OR DELETE ON sub_documents
  FOR EACH ROW EXECUTE FUNCTION trg_recalc_sub_compliance();

-- ---------- customer_portal_requests ----------
CREATE TABLE IF NOT EXISTS customer_portal_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_id        UUID REFERENCES customer_portal_tokens(id) ON DELETE SET NULL,
  type            customer_portal_request_type NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT,
  priority        TEXT,
  status          customer_portal_request_status NOT NULL DEFAULT 'NEW',
  converted_to_ticket_id UUID REFERENCES psa_tickets(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_by_email TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cpr_org ON customer_portal_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_cpr_customer ON customer_portal_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpr_status ON customer_portal_requests(status);

ALTER TABLE customer_portal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cpr_org_isolation ON customer_portal_requests;
CREATE POLICY cpr_org_isolation ON customer_portal_requests
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---------- customer_signatures ----------
CREATE TABLE IF NOT EXISTS customer_signatures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  signature_url   TEXT NOT NULL,
  signed_by_name  TEXT NOT NULL,
  signed_by_email TEXT,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csig_org ON customer_signatures(org_id);
CREATE INDEX IF NOT EXISTS idx_csig_entity ON customer_signatures(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_csig_customer ON customer_signatures(customer_id);

ALTER TABLE customer_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS csig_org_isolation ON customer_signatures;
CREATE POLICY csig_org_isolation ON customer_signatures
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---------- contract_clauses ----------
CREATE TABLE IF NOT EXISTS contract_clauses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT,
  body_md     TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_org ON contract_clauses(org_id);
CREATE INDEX IF NOT EXISTS idx_cc_category ON contract_clauses(category);

ALTER TABLE contract_clauses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_org_isolation ON contract_clauses;
CREATE POLICY cc_org_isolation ON contract_clauses
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---------- contract_templates ----------
CREATE TABLE IF NOT EXISTS contract_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type        contract_template_type NOT NULL,
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  status      contract_template_status NOT NULL DEFAULT 'DRAFT',
  body_md     TEXT NOT NULL DEFAULT '',
  variables   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ct_org ON contract_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_ct_type ON contract_templates(type);

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ct_org_isolation ON contract_templates;
CREATE POLICY ct_org_isolation ON contract_templates
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ---------- contract_template_clauses (M:N) ----------
CREATE TABLE IF NOT EXISTS contract_template_clauses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
  clause_id   UUID NOT NULL REFERENCES contract_clauses(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctc_template ON contract_template_clauses(template_id);

ALTER TABLE contract_template_clauses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ctc_org_isolation ON contract_template_clauses;
CREATE POLICY ctc_org_isolation ON contract_template_clauses
  USING (template_id IN (
    SELECT id FROM contract_templates
    WHERE org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  ));

-- ---------- generated_contracts ----------
CREATE TABLE IF NOT EXISTS generated_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  template_id     UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
  template_type   contract_template_type NOT NULL,
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  opp_id          UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  service_contract_id UUID REFERENCES service_contracts(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  status          generated_contract_status NOT NULL DEFAULT 'DRAFT',
  variables       JSONB NOT NULL DEFAULT '{}'::jsonb,
  sign_token      TEXT UNIQUE,
  sent_at         TIMESTAMPTZ,
  signed_at       TIMESTAMPTZ,
  signed_by_name  TEXT,
  signed_by_email TEXT,
  signature_url   TEXT,
  expires_at      TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, contract_number)
);

CREATE INDEX IF NOT EXISTS idx_gc_org ON generated_contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_gc_customer ON generated_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_gc_status ON generated_contracts(status);
CREATE INDEX IF NOT EXISTS idx_gc_sign_token ON generated_contracts(sign_token);

ALTER TABLE generated_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_org_isolation ON generated_contracts;
CREATE POLICY gc_org_isolation ON generated_contracts
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Auto-number CG-xxxxxx per org
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TRIGGER AS $$
DECLARE
  v_max INTEGER;
BEGIN
  IF NEW.contract_number IS NOT NULL AND NEW.contract_number <> '' THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(CAST(SUBSTRING(contract_number FROM 4) AS INTEGER)), 0)
    INTO v_max
    FROM generated_contracts
    WHERE org_id = NEW.org_id
      AND contract_number ~ '^CG-[0-9]+$';
  NEW.contract_number := 'CG-' || LPAD((v_max + 1)::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generated_contracts_number ON generated_contracts;
CREATE TRIGGER generated_contracts_number
  BEFORE INSERT ON generated_contracts
  FOR EACH ROW EXECUTE FUNCTION generate_contract_number();

-- ---------- updated_at triggers ----------
DO $$ BEGIN
  CREATE TRIGGER cpr_updated_at BEFORE UPDATE ON customer_portal_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER cc_updated_at BEFORE UPDATE ON contract_clauses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER ct_updated_at BEFORE UPDATE ON contract_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER gc_updated_at BEFORE UPDATE ON generated_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Storage buckets ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-signatures', 'customer-signatures', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-pdfs', 'contract-pdfs', false)
ON CONFLICT (id) DO NOTHING;
