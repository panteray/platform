-- ============================================================
-- 063 — Scheduling Requests (Soft Book / Hard Book)
-- Phase 3 of 5: models step 13 Pre-Implementation Communication
-- ============================================================

DO $$ BEGIN
  CREATE TYPE booking_state AS ENUM ('soft_book', 'hard_book', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS scheduling_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  state                booking_state NOT NULL DEFAULT 'soft_book',
  requested_start_date DATE NOT NULL,
  requested_end_date   DATE,
  confirmed_start_date DATE,
  confirmed_end_date   DATE,
  cutoff_date          DATE,
  poc_name             TEXT,
  poc_email            TEXT,
  poc_phone            TEXT,
  notes                TEXT,
  hard_booked_at       TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  cancelled_reason     TEXT,
  created_by           UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_req_project ON scheduling_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_sched_req_state ON scheduling_requests(state);
CREATE INDEX IF NOT EXISTS idx_sched_req_org ON scheduling_requests(org_id);

ALTER TABLE scheduling_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheduling_requests_org_isolation ON scheduling_requests;
CREATE POLICY scheduling_requests_org_isolation ON scheduling_requests
  USING (org_id = (SELECT org_id FROM users WHERE auth_id = auth.uid()));

DROP TRIGGER IF EXISTS scheduling_requests_updated_at ON scheduling_requests;
CREATE TRIGGER scheduling_requests_updated_at
  BEFORE UPDATE ON scheduling_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
