-- ============================================================
-- 025 — Survey Module Tables
-- Phase 1C: Full offline-first survey system
-- ============================================================

-- Ensure updated_at trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ---- Enum Types ----
DO $$ BEGIN
  CREATE TYPE survey_status AS ENUM ('draft', 'in_progress', 'submitted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE survey_floor_plan_mode AS ENUM ('floorplan', 'satellite', 'grid', 'photos_only');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE survey_device_status AS ENUM ('new', 'existing_keep', 'existing_remove', 'relocate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE survey_condition AS ENUM ('good', 'fair', 'poor', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE survey_infra_type AS ENUM ('mdf', 'idf', 'conduit', 'fiber', 'power', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 1. surveys
-- ============================================================
CREATE TABLE IF NOT EXISTS surveys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id),
  opp_id         UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  site_name      TEXT NOT NULL DEFAULT '',
  site_address   TEXT,
  customer_name  TEXT,
  surveyor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  surveyor_name  TEXT,
  survey_date    DATE DEFAULT CURRENT_DATE,
  status         survey_status NOT NULL DEFAULT 'draft',
  site_notes     TEXT,
  infrastructure_notes TEXT,
  synced         BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at      TIMESTAMPTZ,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_org ON surveys(org_id);
CREATE INDEX IF NOT EXISTS idx_surveys_opp ON surveys(opp_id);
CREATE INDEX IF NOT EXISTS idx_surveys_surveyor ON surveys(surveyor_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);

ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY surveys_org_isolation ON surveys
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. survey_floor_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS survey_floor_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id),
  name            TEXT NOT NULL DEFAULT 'Floor Plan',
  mode            survey_floor_plan_mode NOT NULL DEFAULT 'floorplan',
  image_url       TEXT,
  image_width     INT,
  image_height    INT,
  satellite_lat   DOUBLE PRECISION,
  satellite_lng   DOUBLE PRECISION,
  satellite_zoom  INT DEFAULT 18,
  scale_px_per_ft DOUBLE PRECISION,
  display_order   INT NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_fps_survey ON survey_floor_plans(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_fps_org ON survey_floor_plans(org_id);

ALTER TABLE survey_floor_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY survey_fps_org_isolation ON survey_floor_plans
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER survey_fps_updated_at
  BEFORE UPDATE ON survey_floor_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. survey_devices
-- ============================================================
CREATE TABLE IF NOT EXISTS survey_devices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id             UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  floor_plan_id         UUID REFERENCES survey_floor_plans(id) ON DELETE SET NULL,
  org_id                UUID NOT NULL REFERENCES organizations(id),
  system_type           TEXT NOT NULL DEFAULT 'cctv',
  device_type           TEXT NOT NULL DEFAULT 'camera',
  label                 TEXT NOT NULL DEFAULT '',
  status                survey_device_status NOT NULL DEFAULT 'new',
  condition             survey_condition DEFAULT 'unknown',
  existing_make_model   TEXT,
  location_description  TEXT,
  vendor                TEXT,
  model                 TEXT,
  resolution            TEXT,
  mount_type            TEXT,
  mount_height_in       DOUBLE PRECISION,
  cable_type            TEXT,
  cable_run_ft          DOUBLE PRECISION,
  color_hex             TEXT,
  fov_angle             DOUBLE PRECISION DEFAULT 90,
  fov_rotation          DOUBLE PRECISION DEFAULT 0,
  notes                 TEXT,
  position_x            DOUBLE PRECISION DEFAULT 0,
  position_y            DOUBLE PRECISION DEFAULT 0,
  -- Vape / Environmental detection
  detection_capabilities JSONB DEFAULT '{}',
  alert_destination     TEXT,
  integration_method    TEXT,
  relay_output          TEXT,
  power_source          TEXT,
  -- ACS door config
  door_config           JSONB DEFAULT '{}',
  -- WPTP pairing
  wptp_pair_id          UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_devices_survey ON survey_devices(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_devices_fp ON survey_devices(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_survey_devices_org ON survey_devices(org_id);
CREATE INDEX IF NOT EXISTS idx_survey_devices_system ON survey_devices(system_type);

ALTER TABLE survey_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY survey_devices_org_isolation ON survey_devices
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER survey_devices_updated_at
  BEFORE UPDATE ON survey_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. survey_infrastructure
-- ============================================================
CREATE TABLE IF NOT EXISTS survey_infrastructure (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id               UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  floor_plan_id           UUID REFERENCES survey_floor_plans(id) ON DELETE SET NULL,
  org_id                  UUID NOT NULL REFERENCES organizations(id),
  type                    survey_infra_type NOT NULL DEFAULT 'mdf',
  name                    TEXT NOT NULL DEFAULT '',
  mdf_idf_locations       TEXT,
  conduit_pathway         TEXT,
  power_availability      TEXT,
  network_infrastructure  TEXT,
  location                TEXT,
  notes                   TEXT,
  photos                  JSONB DEFAULT '[]',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_infra_survey ON survey_infrastructure(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_infra_org ON survey_infrastructure(org_id);

ALTER TABLE survey_infrastructure ENABLE ROW LEVEL SECURITY;
CREATE POLICY survey_infra_org_isolation ON survey_infrastructure
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER survey_infra_updated_at
  BEFORE UPDATE ON survey_infrastructure
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. survey_photos
-- ============================================================
CREATE TABLE IF NOT EXISTS survey_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id    UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  device_id    UUID REFERENCES survey_devices(id) ON DELETE SET NULL,
  infra_id     UUID REFERENCES survey_infrastructure(id) ON DELETE SET NULL,
  org_id       UUID NOT NULL REFERENCES organizations(id),
  storage_url  TEXT NOT NULL,
  caption      TEXT,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  taken_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_photos_survey ON survey_photos(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_photos_device ON survey_photos(device_id);
CREATE INDEX IF NOT EXISTS idx_survey_photos_org ON survey_photos(org_id);

ALTER TABLE survey_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY survey_photos_org_isolation ON survey_photos
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

-- ============================================================
-- Storage bucket for survey photos
-- Run separately in Supabase dashboard if needed:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('survey-photos', 'survey-photos', false);
-- ============================================================
