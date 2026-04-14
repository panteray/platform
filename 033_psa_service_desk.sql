-- ============================================================
-- 033 — PSA Service Desk Foundation
-- Phase 6A: Tickets, SLA policies, job types, time/parts/notes/photos
-- ============================================================

-- ============================================================
-- Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE psa_vertical AS ENUM ('SEC', 'NET', 'AV', 'MSP', 'CYB', 'SVC', 'INT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE psa_ticket_type AS ENUM (
    'INCIDENT',
    'SERVICE_REQUEST',
    'SCOPE_CHANGE',
    'CHANGE',
    'PROBLEM',
    'EVENT',
    'INTERNAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE psa_priority AS ENUM ('P1', 'P2', 'P3', 'P4', 'P5');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE psa_ticket_status AS ENUM (
    'NEW',
    'OPEN',
    'SCHEDULED',
    'EN_ROUTE',
    'ON_SITE',
    'WORK_IN_PROGRESS',
    'WAITING_ON_CUSTOMER',
    'WAITING_ON_PARTS',
    'WAITING_ON_VENDOR',
    'WAITING_ON_SITE_ACCESS',
    'NEEDS_RMA',
    'COMPLETED',
    'RESOLVED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE psa_sla_event_type AS ENUM (
    'CLOCK_START',
    'PAUSE',
    'RESUME',
    'BREACH_RESPONSE',
    'BREACH_RESOLUTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- psa_sla_policies
-- ============================================================
CREATE TABLE IF NOT EXISTS psa_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vertical psa_vertical NOT NULL,
  ticket_type psa_ticket_type NOT NULL,
  priority psa_priority NOT NULL,
  response_min INTEGER NOT NULL,
  resolution_min INTEGER NOT NULL,
  applies_24x7 BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, vertical, ticket_type, priority)
);

CREATE INDEX IF NOT EXISTS idx_sla_policies_org ON psa_sla_policies(org_id);

DROP TRIGGER IF EXISTS psa_sla_policies_updated_at ON psa_sla_policies;
CREATE TRIGGER psa_sla_policies_updated_at BEFORE UPDATE ON psa_sla_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- psa_job_type_config
-- ============================================================
CREATE TABLE IF NOT EXISTS psa_job_type_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vertical psa_vertical NOT NULL,
  name TEXT NOT NULL,
  checklist_template JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  default_sla_policy_id UUID REFERENCES psa_sla_policies(id) ON DELETE SET NULL,
  auto_tags TEXT[] NOT NULL DEFAULT '{}',
  require_photos BOOLEAN NOT NULL DEFAULT false,
  estimated_duration_min INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_type_org ON psa_job_type_config(org_id);
CREATE INDEX IF NOT EXISTS idx_job_type_vertical ON psa_job_type_config(org_id, vertical);

DROP TRIGGER IF EXISTS psa_job_type_updated_at ON psa_job_type_config;
CREATE TRIGGER psa_job_type_updated_at BEFORE UPDATE ON psa_job_type_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- psa_tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS psa_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,

  -- Linked entities
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  site_id UUID,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  parent_ticket_id UUID REFERENCES psa_tickets(id) ON DELETE SET NULL,

  -- Classification
  vertical psa_vertical NOT NULL,
  category TEXT,
  ticket_type psa_ticket_type NOT NULL DEFAULT 'INCIDENT',
  priority psa_priority NOT NULL DEFAULT 'P3',
  status psa_ticket_status NOT NULL DEFAULT 'NEW',

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  resolution_notes TEXT,

  -- Assignment
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  job_type_id UUID REFERENCES psa_job_type_config(id) ON DELETE SET NULL,

  -- Costing
  costing_enabled BOOLEAN NOT NULL DEFAULT false,

  -- SLA tracking
  sla_policy_id UUID REFERENCES psa_sla_policies(id) ON DELETE SET NULL,
  sla_response_due TIMESTAMPTZ,
  sla_resolution_due TIMESTAMPTZ,
  sla_response_breached BOOLEAN NOT NULL DEFAULT false,
  sla_resolution_breached BOOLEAN NOT NULL DEFAULT false,
  sla_paused_at TIMESTAMPTZ,
  sla_total_pause_min INTEGER NOT NULL DEFAULT 0,

  -- Change window (for CHANGE ticket type)
  change_window_start TIMESTAMPTZ,
  change_window_end TIMESTAMPTZ,

  -- Lifecycle
  first_response_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (org_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_tickets_org ON psa_tickets(org_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON psa_tickets(org_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON psa_tickets(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON psa_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_asset ON psa_tickets(asset_id);
CREATE INDEX IF NOT EXISTS idx_tickets_parent ON psa_tickets(parent_ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_vertical_priority ON psa_tickets(org_id, vertical, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_response ON psa_tickets(sla_response_due) WHERE sla_response_due IS NOT NULL AND first_response_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_sla_resolution ON psa_tickets(sla_resolution_due) WHERE sla_resolution_due IS NOT NULL AND resolved_at IS NULL;

DROP TRIGGER IF EXISTS psa_tickets_updated_at ON psa_tickets;
CREATE TRIGGER psa_tickets_updated_at BEFORE UPDATE ON psa_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-number function: TKT-000001 per org
CREATE OR REPLACE FUNCTION psa_ticket_autonumber()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 5) AS INTEGER)), 0) + 1
      INTO next_num
      FROM psa_tickets
      WHERE org_id = NEW.org_id AND ticket_number LIKE 'TKT-%';
    NEW.ticket_number := 'TKT-' || LPAD(next_num::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS psa_tickets_autonumber ON psa_tickets;
CREATE TRIGGER psa_tickets_autonumber BEFORE INSERT ON psa_tickets
  FOR EACH ROW EXECUTE FUNCTION psa_ticket_autonumber();

-- ============================================================
-- psa_ticket_status_log
-- ============================================================
CREATE TABLE IF NOT EXISTS psa_ticket_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES psa_tickets(id) ON DELETE CASCADE,
  from_status psa_ticket_status,
  to_status psa_ticket_status NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_log_ticket ON psa_ticket_status_log(ticket_id);

-- ============================================================
-- psa_ticket_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS psa_ticket_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES psa_tickets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  internal_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_ticket ON psa_ticket_notes(ticket_id);

-- ============================================================
-- psa_time_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS psa_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES psa_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hours NUMERIC(6,2) NOT NULL,
  description TEXT,
  billable BOOLEAN NOT NULL DEFAULT true,
  rate NUMERIC(10,2),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_ticket ON psa_time_entries(ticket_id);
CREATE INDEX IF NOT EXISTS idx_time_user ON psa_time_entries(user_id, entry_date);

DROP TRIGGER IF EXISTS psa_time_updated_at ON psa_time_entries;
CREATE TRIGGER psa_time_updated_at BEFORE UPDATE ON psa_time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- psa_ticket_parts
-- ============================================================
CREATE TABLE IF NOT EXISTS psa_ticket_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES psa_tickets(id) ON DELETE CASCADE,
  part_number TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  cost NUMERIC(10,2),
  markup_pct NUMERIC(5,2),
  serial_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_ticket ON psa_ticket_parts(ticket_id);

-- ============================================================
-- psa_ticket_photos
-- ============================================================
CREATE TABLE IF NOT EXISTS psa_ticket_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES psa_tickets(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  phase TEXT NOT NULL DEFAULT 'during',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_ticket ON psa_ticket_photos(ticket_id);

-- ============================================================
-- psa_sla_events
-- ============================================================
CREATE TABLE IF NOT EXISTS psa_sla_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES psa_tickets(id) ON DELETE CASCADE,
  event_type psa_sla_event_type NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_paused_min INTEGER,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sla_events_ticket ON psa_sla_events(ticket_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE psa_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_job_type_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_ticket_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_ticket_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_ticket_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_ticket_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE psa_sla_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sla_policies_org ON psa_sla_policies;
CREATE POLICY sla_policies_org ON psa_sla_policies
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS job_type_org ON psa_job_type_config;
CREATE POLICY job_type_org ON psa_job_type_config
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS tickets_org ON psa_tickets;
CREATE POLICY tickets_org ON psa_tickets
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS status_log_org ON psa_ticket_status_log;
CREATE POLICY status_log_org ON psa_ticket_status_log
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS notes_org ON psa_ticket_notes;
CREATE POLICY notes_org ON psa_ticket_notes
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS time_org ON psa_time_entries;
CREATE POLICY time_org ON psa_time_entries
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS parts_org ON psa_ticket_parts;
CREATE POLICY parts_org ON psa_ticket_parts
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS photos_org ON psa_ticket_photos;
CREATE POLICY photos_org ON psa_ticket_photos
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS sla_events_org ON psa_sla_events;
CREATE POLICY sla_events_org ON psa_sla_events
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================================
-- Seed SLA policies — applied to ALL orgs
-- Based on Spec Section 9.5
-- Response / Resolution in minutes
-- ============================================================
DO $$
DECLARE
  org RECORD;
  verticals psa_vertical[] := ARRAY['SEC','NET','AV','MSP','CYB','SVC','INT']::psa_vertical[];
  v psa_vertical;
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    FOREACH v IN ARRAY verticals LOOP
      -- P1: 15min response, 4hr resolution (24x7)
      INSERT INTO psa_sla_policies (org_id, vertical, ticket_type, priority, response_min, resolution_min, applies_24x7)
        VALUES (org.id, v, 'INCIDENT', 'P1', 15, 240, true)
        ON CONFLICT (org_id, vertical, ticket_type, priority) DO NOTHING;
      -- P2: 30min response, 8hr resolution (24x7)
      INSERT INTO psa_sla_policies (org_id, vertical, ticket_type, priority, response_min, resolution_min, applies_24x7)
        VALUES (org.id, v, 'INCIDENT', 'P2', 30, 480, true)
        ON CONFLICT DO NOTHING;
      -- P3: 4hr response, 24hr resolution (business hours)
      INSERT INTO psa_sla_policies (org_id, vertical, ticket_type, priority, response_min, resolution_min, applies_24x7)
        VALUES (org.id, v, 'INCIDENT', 'P3', 240, 1440, false)
        ON CONFLICT DO NOTHING;
      -- P4: 8hr response, 72hr resolution (business hours)
      INSERT INTO psa_sla_policies (org_id, vertical, ticket_type, priority, response_min, resolution_min, applies_24x7)
        VALUES (org.id, v, 'INCIDENT', 'P4', 480, 4320, false)
        ON CONFLICT DO NOTHING;
      -- P5: 24hr response, 7 day resolution
      INSERT INTO psa_sla_policies (org_id, vertical, ticket_type, priority, response_min, resolution_min, applies_24x7)
        VALUES (org.id, v, 'INCIDENT', 'P5', 1440, 10080, false)
        ON CONFLICT DO NOTHING;
      -- Service Request defaults (longer response, same resolution)
      INSERT INTO psa_sla_policies (org_id, vertical, ticket_type, priority, response_min, resolution_min, applies_24x7)
        VALUES (org.id, v, 'SERVICE_REQUEST', 'P3', 480, 2880, false)
        ON CONFLICT DO NOTHING;
      INSERT INTO psa_sla_policies (org_id, vertical, ticket_type, priority, response_min, resolution_min, applies_24x7)
        VALUES (org.id, v, 'SERVICE_REQUEST', 'P4', 1440, 5760, false)
        ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- Seed job types — subset of 87 from spec (foundation set)
-- Full 87 can be added per-org later via admin UI
-- ============================================================
DO $$
DECLARE
  org RECORD;
  jobs TEXT[][] := ARRAY[
    -- SEC (security / physical)
    ARRAY['SEC', 'Camera Install'],
    ARRAY['SEC', 'Camera Replacement'],
    ARRAY['SEC', 'Camera Troubleshoot'],
    ARRAY['SEC', 'DVR/NVR Install'],
    ARRAY['SEC', 'Access Control Install'],
    ARRAY['SEC', 'Reader Replacement'],
    ARRAY['SEC', 'Door Strike Replacement'],
    ARRAY['SEC', 'Alarm Panel Service'],
    ARRAY['SEC', 'Preventive Maintenance'],
    -- NET (network)
    ARRAY['NET', 'Switch Install'],
    ARRAY['NET', 'Switch Replacement'],
    ARRAY['NET', 'AP Install'],
    ARRAY['NET', 'Cable Run'],
    ARRAY['NET', 'Network Troubleshoot'],
    ARRAY['NET', 'Firewall Config'],
    -- AV (audio visual)
    ARRAY['AV', 'Display Install'],
    ARRAY['AV', 'Speaker Install'],
    ARRAY['AV', 'Control System Config'],
    ARRAY['AV', 'Room Integration'],
    ARRAY['AV', 'Projector Service'],
    -- MSP
    ARRAY['MSP', 'Workstation Setup'],
    ARRAY['MSP', 'Server Maintenance'],
    ARRAY['MSP', 'Backup Verification'],
    ARRAY['MSP', 'Software Install'],
    -- CYB (cybersecurity)
    ARRAY['CYB', 'Vulnerability Scan'],
    ARRAY['CYB', 'Incident Response'],
    ARRAY['CYB', 'Security Audit'],
    -- SVC (general service)
    ARRAY['SVC', 'Site Survey'],
    ARRAY['SVC', 'Training'],
    -- INT (internal)
    ARRAY['INT', 'Internal IT'],
    ARRAY['INT', 'Fleet Maintenance']
  ];
  job TEXT[];
BEGIN
  FOR org IN SELECT id FROM organizations LOOP
    FOREACH job SLICE 1 IN ARRAY jobs LOOP
      INSERT INTO psa_job_type_config (org_id, vertical, name, require_photos)
        VALUES (org.id, job[1]::psa_vertical, job[2], true)
        ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
