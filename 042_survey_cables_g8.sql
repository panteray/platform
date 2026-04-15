-- ============================================================
-- 042_survey_cables_g8.sql
-- G8: Survey cable polyline drawing
-- ============================================================
-- Adds survey_cables table for cable polyline drawing on survey
-- floor plans. Each row is one cable run (polyline) with type,
-- color, slack %, and computed length. Org-isolated RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS survey_cables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  floor_plan_id   UUID REFERENCES survey_floor_plans(id) ON DELETE SET NULL,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  label           TEXT NOT NULL DEFAULT '',
  cable_type      TEXT,
  color_hex       TEXT DEFAULT '#2563eb',
  slack_pct       DOUBLE PRECISION DEFAULT 10,
  polyline        JSONB NOT NULL DEFAULT '[]', -- [[x,y],[x,y],...]
  length_ft       DOUBLE PRECISION,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_cables_survey ON survey_cables(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_cables_fp ON survey_cables(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_survey_cables_org ON survey_cables(org_id);

ALTER TABLE survey_cables ENABLE ROW LEVEL SECURITY;
CREATE POLICY survey_cables_org_isolation ON survey_cables
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER survey_cables_updated_at
  BEFORE UPDATE ON survey_cables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
