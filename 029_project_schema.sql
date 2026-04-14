-- ============================================================
-- 029 — Delivery Engine Core: Project Schema
-- Phase 3A: Projects, tasks, milestones, team, daily reports,
--           install items, inventory transactions
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'planning',
    'active',
    'on_hold',
    'punch_list',
    'closeout',
    'completed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE project_task_status AS ENUM (
    'todo',
    'in_progress',
    'blocked',
    'done',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE project_team_role AS ENUM (
    'PM',
    'LEAD_TECH',
    'FIELD_TECH',
    'SUB',
    'PRESALES',
    'ENGINEER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE install_item_status AS ENUM (
    'planned',
    'installation_requested',
    'installed',
    'deviation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE deviation_type AS ENUM (
    'minor',
    'major'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE inventory_txn_type AS ENUM (
    'DEBIT',
    'CREDIT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 1. projects — Core project entity linked to opportunity
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  opp_id          UUID REFERENCES opportunities(id),
  pn              TEXT,                                    -- project number e.g. PN-000001
  name            TEXT NOT NULL,
  pm_id           UUID REFERENCES users(id),               -- project manager
  status          project_status NOT NULL DEFAULT 'planning',
  risk_score      DOUBLE PRECISION DEFAULT 0,
  risk_level      TEXT DEFAULT 'LOW',                       -- LOW | MODERATE | ELEVATED | HIGH | CRITICAL
  contingency_pct DOUBLE PRECISION DEFAULT 0,
  site_address    TEXT,
  site_city       TEXT,
  site_state      TEXT,
  site_zip        TEXT,
  site_notes      TEXT,
  start_date      DATE,
  target_end_date DATE,
  actual_end_date DATE,
  budget_amount   NUMERIC(12,2),
  customer_id     UUID REFERENCES customers(id),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_opp ON projects(opp_id);
CREATE INDEX IF NOT EXISTS idx_projects_pm ON projects(pm_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_org_isolation ON projects
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate project number
CREATE OR REPLACE FUNCTION generate_project_number()
RETURNS TRIGGER AS $$
DECLARE next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(pn FROM 4) AS INT)), 0) + 1
    INTO next_num
    FROM projects
    WHERE org_id = NEW.org_id AND pn IS NOT NULL;
  IF NEW.pn IS NULL THEN
    NEW.pn := 'PN-' || LPAD(next_num::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_auto_pn
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION generate_project_number();

-- ============================================================
-- 2. project_tasks — Task management per project
-- ============================================================
CREATE TABLE IF NOT EXISTS project_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  assignee_id   UUID REFERENCES users(id),
  status        project_task_status NOT NULL DEFAULT 'todo',
  priority      TEXT DEFAULT 'MEDIUM',                     -- LOW | MEDIUM | HIGH | URGENT
  area_id       UUID,                                      -- optional link to design_areas
  due_date      DATE,
  completed_at  TIMESTAMPTZ,
  sort_order    INT DEFAULT 0,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee ON project_tasks(assignee_id);

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_tasks_org_isolation ON project_tasks
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER project_tasks_updated_at
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. project_milestones — Key project milestones
-- ============================================================
CREATE TABLE IF NOT EXISTS project_milestones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  target_date   DATE,
  completed_at  TIMESTAMPTZ,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_milestones_org_isolation ON project_milestones
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER project_milestones_updated_at
  BEFORE UPDATE ON project_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. project_team — Team members assigned to a project
-- ============================================================
CREATE TABLE IF NOT EXISTS project_team (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  role          project_team_role NOT NULL DEFAULT 'FIELD_TECH',
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_team_project ON project_team(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_user ON project_team(user_id);

ALTER TABLE project_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_team_org_isolation ON project_team
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

-- ============================================================
-- 5. daily_reports — Field daily reports
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  author_id     UUID NOT NULL REFERENCES users(id),
  summary       TEXT,
  weather       TEXT,
  crew_count    INT DEFAULT 0,
  hours_worked  DOUBLE PRECISION DEFAULT 0,
  safety_notes  TEXT,
  photos        JSONB DEFAULT '[]',                        -- [{url, caption, taken_at}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_project ON daily_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);

ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_reports_org_isolation ON daily_reports
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. daily_report_items — Line items within a daily report
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_report_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  report_id     UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  task_id       UUID REFERENCES project_tasks(id),
  description   TEXT NOT NULL,
  hours         DOUBLE PRECISION DEFAULT 0,
  photos        JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_report_items_report ON daily_report_items(report_id);

ALTER TABLE daily_report_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_report_items_org_isolation ON daily_report_items
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

-- ============================================================
-- 7. install_items — Hardware install tracking (Smart Hub)
-- ============================================================
CREATE TABLE IF NOT EXISTS install_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  device_id           UUID,                                 -- ref to design_devices if applicable
  area_id             UUID,                                 -- ref to design_areas
  hw_schedule_line    INT,                                  -- line number from hardware schedule
  label               TEXT NOT NULL,
  category            TEXT,                                 -- cctv, access_control, network, etc.
  description         TEXT,
  vendor              TEXT,
  model               TEXT,
  quantity            INT DEFAULT 1,
  status              install_item_status NOT NULL DEFAULT 'planned',
  installed_by        UUID REFERENCES users(id),
  installed_at        TIMESTAMPTZ,
  serial_number       TEXT,
  mac_address         TEXT,
  deviation_type      deviation_type,
  deviation_note      TEXT,
  deviation_ai_analysis TEXT,
  position_x          DOUBLE PRECISION,
  position_y          DOUBLE PRECISION,
  photos              JSONB DEFAULT '[]',                   -- [{url, caption, phase, taken_at}]
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_install_items_project ON install_items(project_id);
CREATE INDEX IF NOT EXISTS idx_install_items_status ON install_items(status);
CREATE INDEX IF NOT EXISTS idx_install_items_area ON install_items(area_id);

ALTER TABLE install_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY install_items_org_isolation ON install_items
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER install_items_updated_at
  BEFORE UPDATE ON install_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. inventory_txns — Van Stock / project inventory ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_txns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  item_description TEXT NOT NULL,
  part_number     TEXT,
  type            inventory_txn_type NOT NULL,
  quantity        INT NOT NULL DEFAULT 1,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_txns_project ON inventory_txns(project_id);
CREATE INDEX IF NOT EXISTS idx_inventory_txns_user ON inventory_txns(user_id);

ALTER TABLE inventory_txns ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_txns_org_isolation ON inventory_txns
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);
