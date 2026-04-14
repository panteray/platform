-- ============================================================================
-- Migration 036 — PSA Problem Management + Known Error Database (KEDB)
-- Phase 6D
-- ============================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE psa_problem_status AS ENUM (
    'NEW', 'UNDER_INVESTIGATION', 'ROOT_CAUSE_IDENTIFIED',
    'WORKAROUND_AVAILABLE', 'RESOLVED', 'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE psa_problem_type AS ENUM ('REACTIVE', 'PROACTIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE psa_rca_method AS ENUM ('FIVE_WHYS', 'FISHBONE', 'FREE_TEXT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Problems ----------
CREATE TABLE IF NOT EXISTS psa_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  problem_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  problem_type psa_problem_type NOT NULL DEFAULT 'REACTIVE',
  status psa_problem_status NOT NULL DEFAULT 'NEW',
  priority psa_priority,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  category TEXT,
  -- RCA
  rca_method psa_rca_method,
  rca_five_whys JSONB,          -- [{"q":"why?","a":"because..."} x5]
  rca_fishbone JSONB,           -- { "people":[], "process":[], "equipment":[], "environment":[], "materials":[], "measurement":[] }
  rca_free_text TEXT,
  root_cause TEXT,
  workaround TEXT,
  permanent_fix TEXT,
  -- Lifecycle
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, problem_number)
);

CREATE INDEX IF NOT EXISTS idx_psa_problems_org ON psa_problems (org_id);
CREATE INDEX IF NOT EXISTS idx_psa_problems_status ON psa_problems (org_id, status);
CREATE INDEX IF NOT EXISTS idx_psa_problems_assigned ON psa_problems (assigned_to);

-- PRB-000001 auto-number (per-org)
CREATE OR REPLACE FUNCTION psa_problem_number_trigger() RETURNS TRIGGER AS $$
DECLARE
  next_num BIGINT;
BEGIN
  IF NEW.problem_number IS NULL OR NEW.problem_number = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(problem_number FROM 5) AS BIGINT)), 0) + 1
      INTO next_num
      FROM psa_problems
      WHERE org_id = NEW.org_id AND problem_number ~ '^PRB-[0-9]+$';
    NEW.problem_number := 'PRB-' || LPAD(next_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS psa_problems_number ON psa_problems;
CREATE TRIGGER psa_problems_number
  BEFORE INSERT ON psa_problems
  FOR EACH ROW EXECUTE FUNCTION psa_problem_number_trigger();

DROP TRIGGER IF EXISTS psa_problems_touch ON psa_problems;
CREATE TRIGGER psa_problems_touch
  BEFORE UPDATE ON psa_problems
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- Problem ↔ Ticket join (linked incidents) ----------
CREATE TABLE IF NOT EXISTS psa_problem_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES psa_problems(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES psa_tickets(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  linked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (problem_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_psa_problem_tickets_ticket ON psa_problem_tickets (ticket_id);

-- ---------- Problem status log ----------
CREATE TABLE IF NOT EXISTS psa_problem_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES psa_problems(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_status psa_problem_status,
  to_status psa_problem_status NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psa_problem_status_log_problem ON psa_problem_status_log (problem_id);

-- ---------- KEDB (Known Error Database) ----------
CREATE TABLE IF NOT EXISTS psa_kedb_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kedb_number TEXT NOT NULL,
  title TEXT NOT NULL,
  symptoms TEXT NOT NULL,
  root_cause TEXT,
  workaround TEXT,
  permanent_fix TEXT,
  category TEXT,
  tags TEXT[],
  problem_id UUID REFERENCES psa_problems(id) ON DELETE SET NULL,
  audience TEXT NOT NULL DEFAULT 'internal' CHECK (audience IN ('internal', 'customer_portal', 'both')),
  match_count INTEGER NOT NULL DEFAULT 0,
  last_matched_at TIMESTAMPTZ,
  -- Lifecycle: auto-expires 6 months after creation
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 months'),
  archived_at TIMESTAMPTZ,
  UNIQUE (org_id, kedb_number)
);

CREATE INDEX IF NOT EXISTS idx_psa_kedb_org ON psa_kedb_entries (org_id);
CREATE INDEX IF NOT EXISTS idx_psa_kedb_active ON psa_kedb_entries (org_id, archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_psa_kedb_category ON psa_kedb_entries (org_id, category);

-- KEDB auto-number (per-org)
CREATE OR REPLACE FUNCTION psa_kedb_number_trigger() RETURNS TRIGGER AS $$
DECLARE
  next_num BIGINT;
BEGIN
  IF NEW.kedb_number IS NULL OR NEW.kedb_number = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(kedb_number FROM 5) AS BIGINT)), 0) + 1
      INTO next_num
      FROM psa_kedb_entries
      WHERE org_id = NEW.org_id AND kedb_number ~ '^KE-[0-9]+$';
    NEW.kedb_number := 'KE-' || LPAD(next_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS psa_kedb_number ON psa_kedb_entries;
CREATE TRIGGER psa_kedb_number
  BEFORE INSERT ON psa_kedb_entries
  FOR EACH ROW EXECUTE FUNCTION psa_kedb_number_trigger();

DROP TRIGGER IF EXISTS psa_kedb_touch ON psa_kedb_entries;
CREATE TRIGGER psa_kedb_touch
  BEFORE UPDATE ON psa_kedb_entries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- Problem suggestions (auto-generated from recurrence) ----------
CREATE TABLE IF NOT EXISTS psa_problem_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  incident_count INTEGER NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 30,
  sample_ticket_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  problem_id UUID REFERENCES psa_problems(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_psa_problem_suggestions_pending ON psa_problem_suggestions (org_id, status) WHERE status = 'pending';

-- ---------- RLS ----------
ALTER TABLE psa_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_problem_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_problem_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_kedb_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_problem_suggestions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY psa_problems_org ON psa_problems FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY psa_problem_tickets_org ON psa_problem_tickets FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY psa_problem_status_log_org ON psa_problem_status_log FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY psa_kedb_org ON psa_kedb_entries FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY psa_problem_suggestions_org ON psa_problem_suggestions FOR ALL
    USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
    WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
