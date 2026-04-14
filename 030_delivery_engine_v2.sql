-- ============================================================
-- 030 — Delivery Engine V2: Change Orders, RAID, QC, SOS,
--       Status Reports, Lessons Learned, Stakeholders, Meetings
-- Phase 4: Delivery Engine Advanced + PM Templates
-- ============================================================

-- ============================================================
-- Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE change_order_status AS ENUM (
    'initiated',
    'classified',
    'engineering_delegated',
    'quote_delegated',
    'pm_review',
    'customer_sig',
    'injected',
    'field_acknowledged',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE change_order_type AS ENUM ('minor', 'major');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE raid_item_type AS ENUM ('RISK', 'ACTION', 'ISSUE', 'DECISION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE raid_item_status AS ENUM (
    'open', 'in_progress', 'ongoing', 'on_track',
    'needs_review', 'approved', 'overdue', 'on_hold',
    'resolved', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE qc_checklist_status AS ENUM ('draft', 'in_progress', 'submitted', 'approved', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sos_status AS ENUM ('draft', 'pending_customer', 'pending_sub', 'pending_pm', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add in_review to install_item_status if not present
DO $$ BEGIN
  ALTER TYPE install_item_status ADD VALUE IF NOT EXISTS 'in_review' AFTER 'installation_requested';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- change_orders
-- ============================================================

CREATE TABLE IF NOT EXISTS change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  co_number TEXT,
  type change_order_type NOT NULL DEFAULT 'minor',
  status change_order_status NOT NULL DEFAULT 'initiated',
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT,
  cost_impact NUMERIC DEFAULT 0,
  price_change BOOLEAN DEFAULT FALSE,
  schedule_impact_days INTEGER DEFAULT 0,
  install_item_id UUID REFERENCES install_items(id),
  initiated_by UUID REFERENCES users(id),
  engineering_assignee_id UUID REFERENCES users(id),
  engineering_notes TEXT,
  engineering_completed_at TIMESTAMPTZ,
  quote_assignee_id UUID REFERENCES users(id),
  quote_amount NUMERIC,
  quote_notes TEXT,
  quote_completed_at TIMESTAMPTZ,
  pm_approved_by UUID REFERENCES users(id),
  pm_approved_at TIMESTAMPTZ,
  pm_decline_reason TEXT,
  customer_signed_at TIMESTAMPTZ,
  customer_sig_data TEXT,
  injected_at TIMESTAMPTZ,
  field_acknowledged_by UUID REFERENCES users(id),
  field_acknowledged_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate CO number
CREATE OR REPLACE FUNCTION generate_co_number()
RETURNS TRIGGER AS $$
DECLARE seq INT;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN co_number ~ '^CO-\d+$'
    THEN CAST(SUBSTRING(co_number FROM 4) AS INT) ELSE 0 END
  ), 0) + 1 INTO seq
  FROM change_orders WHERE project_id = NEW.project_id;
  NEW.co_number := 'CO-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_co_number ON change_orders;
CREATE TRIGGER trg_co_number
  BEFORE INSERT ON change_orders
  FOR EACH ROW WHEN (NEW.co_number IS NULL)
  EXECUTE FUNCTION generate_co_number();

CREATE INDEX IF NOT EXISTS idx_co_project ON change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_co_org ON change_orders(org_id);

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS co_org_isolation ON change_orders;
CREATE POLICY co_org_isolation ON change_orders
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_co_updated ON change_orders;
CREATE TRIGGER trg_co_updated BEFORE UPDATE ON change_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- raid_items
-- ============================================================

CREATE TABLE IF NOT EXISTS raid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type raid_item_type NOT NULL,
  raid_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status raid_item_status NOT NULL DEFAULT 'open',
  -- Risk-specific: P x I scoring
  probability INTEGER CHECK (probability IS NULL OR (probability >= 1 AND probability <= 10)),
  impact INTEGER CHECK (impact IS NULL OR (impact >= 1 AND impact <= 10)),
  risk_rating INTEGER GENERATED ALWAYS AS (COALESCE(probability, 0) * COALESCE(impact, 0)) STORED,
  response_type TEXT, -- avoid, mitigate, transfer, accept
  response_actions TEXT,
  -- Action-specific
  assigned_to UUID REFERENCES users(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  -- Issue-specific
  severity TEXT, -- high, medium, low
  resolution TEXT,
  -- Decision-specific
  decision_maker TEXT,
  decision_date DATE,
  rationale TEXT,
  -- Common
  category TEXT, -- project_management, design, installation, etc.
  owner_id UUID REFERENCES users(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate RAID number (R-001, A-001, I-001, D-001)
CREATE OR REPLACE FUNCTION generate_raid_number()
RETURNS TRIGGER AS $$
DECLARE prefix TEXT; seq INT;
BEGIN
  prefix := SUBSTRING(NEW.type::TEXT FROM 1 FOR 1);
  SELECT COALESCE(MAX(
    CASE WHEN raid_number ~ ('^' || prefix || '-\d+$')
    THEN CAST(SUBSTRING(raid_number FROM 3) AS INT) ELSE 0 END
  ), 0) + 1 INTO seq
  FROM raid_items WHERE project_id = NEW.project_id AND type = NEW.type;
  NEW.raid_number := prefix || '-' || LPAD(seq::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_raid_number ON raid_items;
CREATE TRIGGER trg_raid_number
  BEFORE INSERT ON raid_items
  FOR EACH ROW WHEN (NEW.raid_number IS NULL)
  EXECUTE FUNCTION generate_raid_number();

CREATE INDEX IF NOT EXISTS idx_raid_project ON raid_items(project_id);
CREATE INDEX IF NOT EXISTS idx_raid_org ON raid_items(org_id);
CREATE INDEX IF NOT EXISTS idx_raid_type ON raid_items(type);

ALTER TABLE raid_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS raid_org_isolation ON raid_items;
CREATE POLICY raid_org_isolation ON raid_items
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_raid_updated ON raid_items;
CREATE TRIGGER trg_raid_updated BEFORE UPDATE ON raid_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- qc_checklists
-- ============================================================

CREATE TABLE IF NOT EXISTS qc_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  area_id UUID,
  area_name TEXT,
  status qc_checklist_status NOT NULL DEFAULT 'draft',
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- items shape: [{id, label, passed: bool, notes, photo_before_url, photo_after_url}]
  corrective_actions JSONB DEFAULT '[]'::JSONB,
  -- [{id, description, assigned_to, status, due_date, completed_at}]
  submitted_by UUID REFERENCES users(id),
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  photos JSONB DEFAULT '[]'::JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qc_project ON qc_checklists(project_id);
CREATE INDEX IF NOT EXISTS idx_qc_org ON qc_checklists(org_id);

ALTER TABLE qc_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qc_org_isolation ON qc_checklists;
CREATE POLICY qc_org_isolation ON qc_checklists
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_qc_updated ON qc_checklists;
CREATE TRIGGER trg_qc_updated BEFORE UPDATE ON qc_checklists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- sign_off_sheets
-- ============================================================

CREATE TABLE IF NOT EXISTS sign_off_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status sos_status NOT NULL DEFAULT 'draft',
  scope_summary TEXT,
  customer_name TEXT,
  customer_title TEXT,
  customer_sig_data TEXT, -- base64 canvas
  customer_signed_at TIMESTAMPTZ,
  sub_name TEXT,
  sub_sig_data TEXT,
  sub_signed_at TIMESTAMPTZ,
  pm_name TEXT,
  pm_sig_data TEXT,
  pm_signed_at TIMESTAMPTZ,
  photos JSONB DEFAULT '[]'::JSONB,
  gate_install_complete BOOLEAN DEFAULT FALSE,
  gate_co_closed BOOLEAN DEFAULT FALSE,
  gate_qc_passed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sos_project ON sign_off_sheets(project_id);
CREATE INDEX IF NOT EXISTS idx_sos_org ON sign_off_sheets(org_id);

ALTER TABLE sign_off_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sos_org_isolation ON sign_off_sheets;
CREATE POLICY sos_org_isolation ON sign_off_sheets
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_sos_updated ON sign_off_sheets;
CREATE TRIGGER trg_sos_updated BEFORE UPDATE ON sign_off_sheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- status_reports
-- ============================================================

CREATE TABLE IF NOT EXISTS status_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overall_status TEXT DEFAULT 'on_track', -- on_track, at_risk, behind, critical
  summary TEXT,
  accomplishments TEXT,
  next_steps TEXT,
  blockers TEXT,
  -- Auto-pulled snapshot
  snapshot JSONB DEFAULT '{}'::JSONB,
  -- {open_risks, open_issues, open_actions, milestone_status, install_progress, budget_status}
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sr_project ON status_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_sr_org ON status_reports(org_id);

ALTER TABLE status_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_org_isolation ON status_reports;
CREATE POLICY sr_org_isolation ON status_reports
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_sr_updated ON status_reports;
CREATE TRIGGER trg_sr_updated BEFORE UPDATE ON status_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- lessons_learned
-- ============================================================

CREATE TABLE IF NOT EXISTS lessons_learned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  practice_area TEXT NOT NULL,
  -- 14 areas: project_management, design, installation, programming,
  -- commissioning, operations, customer_management, presales,
  -- procurement, subcontractor, safety, quality, communication, documentation
  issue_category TEXT NOT NULL,
  -- 7 categories: customer, design, installation, operations, programming,
  -- project_management, presales
  subcategory TEXT,
  what_happened TEXT NOT NULL,
  impact TEXT,
  recommendation TEXT,
  severity TEXT DEFAULT 'medium', -- low, medium, high
  status TEXT DEFAULT 'open', -- open, reviewed, implemented
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ll_project ON lessons_learned(project_id);
CREATE INDEX IF NOT EXISTS idx_ll_org ON lessons_learned(org_id);

ALTER TABLE lessons_learned ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ll_org_isolation ON lessons_learned;
CREATE POLICY ll_org_isolation ON lessons_learned
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_ll_updated ON lessons_learned;
CREATE TRIGGER trg_ll_updated BEFORE UPDATE ON lessons_learned
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- stakeholder_register (lightweight — exportable module)
-- ============================================================

CREATE TABLE IF NOT EXISTS stakeholder_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  organization TEXT,
  category TEXT DEFAULT 'internal', -- internal, external
  power INTEGER DEFAULT 3 CHECK (power >= 1 AND power <= 5),
  influence INTEGER DEFAULT 3 CHECK (influence >= 1 AND influence <= 5),
  interest INTEGER DEFAULT 3 CHECK (interest >= 1 AND interest <= 5),
  email TEXT,
  phone TEXT,
  communication_preference TEXT, -- email, phone, in_person, teams
  communication_frequency TEXT, -- daily, weekly, biweekly, monthly, as_needed
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sh_project ON stakeholder_register(project_id);
CREATE INDEX IF NOT EXISTS idx_sh_org ON stakeholder_register(org_id);

ALTER TABLE stakeholder_register ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sh_org_isolation ON stakeholder_register;
CREATE POLICY sh_org_isolation ON stakeholder_register
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- ============================================================
-- meeting_minutes (exportable module)
-- ============================================================

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_type TEXT DEFAULT 'status', -- kickoff, status, closeout, ad_hoc
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location TEXT,
  attendees JSONB DEFAULT '[]'::JSONB,
  -- [{name, role, present: bool}]
  agenda TEXT,
  discussion_notes TEXT,
  action_items JSONB DEFAULT '[]'::JSONB,
  -- [{description, assigned_to, due_date, status}]
  decisions JSONB DEFAULT '[]'::JSONB,
  -- [{description, decided_by, rationale}]
  next_meeting_date TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mm_project ON meeting_minutes(project_id);
CREATE INDEX IF NOT EXISTS idx_mm_org ON meeting_minutes(org_id);

ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mm_org_isolation ON meeting_minutes;
CREATE POLICY mm_org_isolation ON meeting_minutes
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- ============================================================
-- Done
-- ============================================================
