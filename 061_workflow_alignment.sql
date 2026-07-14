-- ============================================================
-- 061 — Align schema to 19-step Opportunity → Project → Closure workflow
-- Phase 1 of 5 (schema foundation only, no UI)
-- ============================================================
-- NOTE: opportunities.status is TEXT (not a Postgres enum), so the
-- new OppStatus values (ORDER_ENTRY, SHIP_HOLD, PM_ASSIGNMENT, IKOM,
-- CKOM, SCHEDULING, OPERATIONAL_VALIDATION, OPERATIONAL_CLOSURE)
-- live in src/types/enums.ts only. No ALTER TYPE opp_status here.
-- ============================================================

-- 1. Extend project_team_role with ISR and OPS
ALTER TYPE project_team_role ADD VALUE IF NOT EXISTS 'ISR';
ALTER TYPE project_team_role ADD VALUE IF NOT EXISTS 'OPS';

-- 2. Extend project_status with operational_closure
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'operational_closure';

-- 3. Won/Lost outcome enum + opportunities columns
DO $$ BEGIN
  CREATE TYPE opp_outcome AS ENUM ('PENDING', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS outcome                     opp_outcome NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS lost_reason                 TEXT,
  ADD COLUMN IF NOT EXISTS payment_agreement_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_terms               TEXT,
  ADD COLUMN IF NOT EXISTS ship_hold_cleared_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_intro_sent_at      TIMESTAMPTZ;

-- 4. Document ikom / ckom meeting_type convention
COMMENT ON COLUMN project_meetings.meeting_type IS
  'ikom | ckom | status | closeout | ad_hoc — ikom = internal kickoff, ckom = customer kickoff';

-- 5. Auto-seed 5 canonical named milestones on project insert
CREATE OR REPLACE FUNCTION seed_project_milestones()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_milestones (org_id, project_id, title, sort_order) VALUES
    (NEW.org_id, NEW.id, 'Customer Decision',      1),
    (NEW.org_id, NEW.id, 'Kickoff Prep Complete',  2),
    (NEW.org_id, NEW.id, 'Kickoff Complete',       3),
    (NEW.org_id, NEW.id, 'Project Completed',      4),
    (NEW.org_id, NEW.id, 'Project Closed',         5);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_project_milestones ON projects;
CREATE TRIGGER trg_seed_project_milestones
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION seed_project_milestones();
