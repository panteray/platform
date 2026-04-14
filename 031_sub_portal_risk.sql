-- ============================================================
-- 031 — Subcontractor Portal + Risk Assessment
-- Phase 4D + 4E
-- ============================================================

-- ============================================================
-- Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE sub_assignment_status AS ENUM (
    'rfp_sent',
    'quoted',
    'quote_review',
    'quote_accepted',
    'po_issued',
    'po_acknowledged',
    'mobilizing',
    'on_site',
    'in_progress',
    'blocked',
    'daily_report_pending',
    'qc_pending',
    'punch_list',
    'punch_complete',
    'invoice_pending',
    'invoice_received',
    'subcontractor_complete'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sub_doc_type AS ENUM (
    'coi', 'w9', 'license', 'bond', 'msa', 'nda', 'safety_cert', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- sub_portal_tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS sub_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  sub_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  permissions TEXT[] DEFAULT ARRAY['view', 'upload', 'invoice'],
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spt_token ON sub_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_spt_project ON sub_portal_tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_spt_sub ON sub_portal_tokens(sub_id);

ALTER TABLE sub_portal_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS spt_org_isolation ON sub_portal_tokens;
CREATE POLICY spt_org_isolation ON sub_portal_tokens
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_spt_updated ON sub_portal_tokens;
CREATE TRIGGER trg_spt_updated BEFORE UPDATE ON sub_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- sub_assignments
-- ============================================================

CREATE TABLE IF NOT EXISTS sub_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sub_id UUID NOT NULL,
  status sub_assignment_status NOT NULL DEFAULT 'rfp_sent',
  scope TEXT,
  deliverables TEXT,
  po_number TEXT,
  po_amount NUMERIC,
  invoiced_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  -- Status timestamps
  rfp_sent_at TIMESTAMPTZ,
  quoted_at TIMESTAMPTZ,
  po_issued_at TIMESTAMPTZ,
  mobilized_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- Links
  opp_sub_quote_id UUID REFERENCES opp_sub_quotes(id),
  pm_assignee_id UUID REFERENCES users(id),
  notes TEXT,
  blockers TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_project ON sub_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_sa_sub ON sub_assignments(sub_id);
CREATE INDEX IF NOT EXISTS idx_sa_org ON sub_assignments(org_id);

ALTER TABLE sub_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sa_org_isolation ON sub_assignments;
CREATE POLICY sa_org_isolation ON sub_assignments
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_sa_updated ON sub_assignments;
CREATE TRIGGER trg_sa_updated BEFORE UPDATE ON sub_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- sub_documents (COI, W9, licenses, bonds)
-- ============================================================

CREATE TABLE IF NOT EXISTS sub_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  sub_id UUID NOT NULL,
  doc_type sub_doc_type NOT NULL,
  doc_name TEXT NOT NULL,
  storage_url TEXT,
  file_size_bytes INTEGER,
  issued_date DATE,
  expires_at DATE,
  policy_number TEXT,
  carrier TEXT,
  coverage_amount NUMERIC,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_sub ON sub_documents(sub_id);
CREATE INDEX IF NOT EXISTS idx_sd_org ON sub_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_sd_expires ON sub_documents(expires_at);

ALTER TABLE sub_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sd_org_isolation ON sub_documents;
CREATE POLICY sd_org_isolation ON sub_documents
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_sd_updated ON sub_documents;
CREATE TRIGGER trg_sd_updated BEFORE UPDATE ON sub_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- sub_po_variances
-- ============================================================

CREATE TABLE IF NOT EXISTS sub_po_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  assignment_id UUID NOT NULL REFERENCES sub_assignments(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  variance_amount NUMERIC NOT NULL,
  variance_pct NUMERIC,
  reason TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spv_assignment ON sub_po_variances(assignment_id);
CREATE INDEX IF NOT EXISTS idx_spv_org ON sub_po_variances(org_id);

ALTER TABLE sub_po_variances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS spv_org_isolation ON sub_po_variances;
CREATE POLICY spv_org_isolation ON sub_po_variances
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- ============================================================
-- sub_skill_matrix
-- ============================================================

CREATE TABLE IF NOT EXISTS sub_skill_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  sub_id UUID UNIQUE NOT NULL,
  -- Technical skills (10 categories, 0-4 scale)
  technical_skills JSONB DEFAULT '{}'::JSONB,
  -- {video_surveillance: 4, access_control: 3, intrusion: 2, ...}
  -- Soft skills (8 categories, 0-4 scale)
  soft_skills JSONB DEFAULT '{}'::JSONB,
  -- {communication: 4, punctuality: 3, ...}
  -- Certifications (boolean map)
  certifications JSONB DEFAULT '{}'::JSONB,
  -- {axis_certified: true, genetec_certified: false, ...}
  territory TEXT[],
  approved_practices TEXT[],
  notes TEXT,
  last_updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssm_sub ON sub_skill_matrix(sub_id);
CREATE INDEX IF NOT EXISTS idx_ssm_org ON sub_skill_matrix(org_id);

ALTER TABLE sub_skill_matrix ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ssm_org_isolation ON sub_skill_matrix;
CREATE POLICY ssm_org_isolation ON sub_skill_matrix
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_ssm_updated ON sub_skill_matrix;
CREATE TRIGGER trg_ssm_updated BEFORE UPDATE ON sub_skill_matrix
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- risk_assessments (Stage 1 + Stage 2)
-- ============================================================

CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Stage 1: Initial scoring (5 categories × P × I, 1-5 scale)
  -- Each category: { probability: 1-5, impact: 1-5, score: P*I }
  technical JSONB DEFAULT '{"probability": 1, "impact": 1, "score": 1, "notes": ""}'::JSONB,
  schedule JSONB DEFAULT '{"probability": 1, "impact": 1, "score": 1, "notes": ""}'::JSONB,
  cost JSONB DEFAULT '{"probability": 1, "impact": 1, "score": 1, "notes": ""}'::JSONB,
  scope JSONB DEFAULT '{"probability": 1, "impact": 1, "score": 1, "notes": ""}'::JSONB,
  team JSONB DEFAULT '{"probability": 1, "impact": 1, "score": 1, "notes": ""}'::JSONB,
  -- Stage 2: Mitigations
  -- Per category: { strategy: avoid|mitigate|transfer|accept, action: text, owner_id: uuid, residual: 1-25 }
  technical_mitigation JSONB DEFAULT '{}'::JSONB,
  schedule_mitigation JSONB DEFAULT '{}'::JSONB,
  cost_mitigation JSONB DEFAULT '{}'::JSONB,
  scope_mitigation JSONB DEFAULT '{}'::JSONB,
  team_mitigation JSONB DEFAULT '{}'::JSONB,
  -- Computed totals
  total_risk_score INTEGER DEFAULT 0, -- sum of category scores (max 125)
  residual_risk_score INTEGER DEFAULT 0,
  overall_risk_level TEXT DEFAULT 'low', -- low, medium, high, critical
  -- Workflow
  status TEXT DEFAULT 'draft', -- draft, stage_1_complete, stage_2_complete, approved
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ra_project ON risk_assessments(project_id);
CREATE INDEX IF NOT EXISTS idx_ra_org ON risk_assessments(org_id);

ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ra_org_isolation ON risk_assessments;
CREATE POLICY ra_org_isolation ON risk_assessments
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_ra_updated ON risk_assessments;
CREATE TRIGGER trg_ra_updated BEFORE UPDATE ON risk_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Done
-- ============================================================
