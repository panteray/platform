-- ============================================================================
-- Phase 6B — PSA Dispatch Board
-- ============================================================================
-- Assignments link tickets to techs with a scheduled date/time window.
-- Assignment status cascades to parent ticket status.
-- Tech availability + skills drive the "auto-suggest tech" filter.
-- ============================================================================

-- Enum: assignment lifecycle
DO $$ BEGIN
  CREATE TYPE psa_dispatch_status AS ENUM (
    'scheduled', 'en_route', 'on_site', 'wip', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- psa_dispatch_assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS psa_dispatch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES psa_tickets(id) ON DELETE CASCADE,
  tech_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scheduled_date DATE NOT NULL,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  status psa_dispatch_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  travel_notes TEXT,
  geolocation JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_org_date ON psa_dispatch_assignments(org_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_tech_date ON psa_dispatch_assignments(tech_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_dispatch_ticket ON psa_dispatch_assignments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_status ON psa_dispatch_assignments(status);

ALTER TABLE psa_dispatch_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispatch_org_isolation ON psa_dispatch_assignments;
CREATE POLICY dispatch_org_isolation ON psa_dispatch_assignments
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- psa_tech_availability — weekly recurring schedule
-- ============================================================================
CREATE TABLE IF NOT EXISTS psa_tech_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_tech_availability_user ON psa_tech_availability(user_id);

ALTER TABLE psa_tech_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tech_availability_org_isolation ON psa_tech_availability;
CREATE POLICY tech_availability_org_isolation ON psa_tech_availability
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- psa_tech_skills — for skills-based routing
-- ============================================================================
CREATE TABLE IF NOT EXISTS psa_tech_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  proficiency TEXT NOT NULL DEFAULT 'mid' CHECK (proficiency IN ('junior', 'mid', 'senior')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_tech_skills_user ON psa_tech_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_tech_skills_skill ON psa_tech_skills(skill);

ALTER TABLE psa_tech_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tech_skills_org_isolation ON psa_tech_skills;
CREATE POLICY tech_skills_org_isolation ON psa_tech_skills
  FOR ALL USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dispatch_touch ON psa_dispatch_assignments;
CREATE TRIGGER trg_dispatch_touch BEFORE UPDATE ON psa_dispatch_assignments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_tech_avail_touch ON psa_tech_availability;
CREATE TRIGGER trg_tech_avail_touch BEFORE UPDATE ON psa_tech_availability
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
