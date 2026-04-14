-- ============================================================
-- 032 — Asset Intelligence Engine
-- Phase 5: Assets, firmware history, maintenance, lifecycle events
-- ============================================================

-- ============================================================
-- Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE asset_status AS ENUM (
    'active',
    'maintenance',
    'retired',
    'rma',
    'lost',
    'replaced'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_maintenance_type AS ENUM (
    'preventive',
    'repair',
    'inspection',
    'firmware_update',
    'cleaning',
    'calibration'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_event_type AS ENUM (
    'installed',
    'serviced',
    'firmware_updated',
    'relocated',
    'retired',
    'rma_initiated',
    'replaced',
    'reactivated',
    'inspection_passed',
    'inspection_failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- assets
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  install_item_id UUID REFERENCES install_items(id) ON DELETE SET NULL,
  device_id UUID REFERENCES device_library_items(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  site_id UUID,

  -- Identification
  asset_tag TEXT,
  label TEXT NOT NULL,
  category TEXT,
  vendor TEXT,
  model TEXT,
  serial_number TEXT,
  mac_address TEXT,

  -- Status
  status asset_status NOT NULL DEFAULT 'active',

  -- Lifecycle dates
  install_date DATE,
  warranty_start DATE,
  warranty_expires_at DATE,
  eol_date DATE,
  retired_at TIMESTAMPTZ,

  -- State
  firmware_version TEXT,
  ip_address TEXT,
  location_notes TEXT,
  position_x NUMERIC,
  position_y NUMERIC,

  -- Metadata
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_org ON assets(org_id);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_customer ON assets(customer_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_serial ON assets(org_id, serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_warranty ON assets(warranty_expires_at) WHERE warranty_expires_at IS NOT NULL;

DROP TRIGGER IF EXISTS assets_updated_at ON assets;
CREATE TRIGGER assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- asset_firmware_history
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_firmware_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  previous_version TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  cve_fixes TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_firmware_asset ON asset_firmware_history(asset_id);

-- ============================================================
-- asset_maintenance
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  type asset_maintenance_type NOT NULL,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  technician_notes TEXT,
  cost NUMERIC,
  parts_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON asset_maintenance(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_scheduled ON asset_maintenance(scheduled_at) WHERE completed_at IS NULL;

DROP TRIGGER IF EXISTS asset_maintenance_updated_at ON asset_maintenance;
CREATE TRIGGER asset_maintenance_updated_at BEFORE UPDATE ON asset_maintenance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- asset_lifecycle_events
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  event_type asset_event_type NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_asset ON asset_lifecycle_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_type ON asset_lifecycle_events(event_type);

-- ============================================================
-- Trigger: auto-create asset from install_item when status becomes 'installed'
-- ============================================================
CREATE OR REPLACE FUNCTION create_asset_from_install_item()
RETURNS TRIGGER AS $$
DECLARE
  proj_customer UUID;
  new_asset_id UUID;
BEGIN
  -- Only fire when transitioning INTO installed state
  IF NEW.status = 'installed' AND (OLD.status IS DISTINCT FROM 'installed') THEN
    -- Lookup project's customer
    SELECT customer_id INTO proj_customer FROM projects WHERE id = NEW.project_id;

    -- Skip if asset already exists for this install_item
    IF EXISTS (SELECT 1 FROM assets WHERE install_item_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    INSERT INTO assets (
      org_id, project_id, install_item_id, device_id, customer_id,
      label, category, vendor, model, serial_number, mac_address,
      status, install_date, photos, created_by
    ) VALUES (
      NEW.org_id, NEW.project_id, NEW.id, NEW.device_id, proj_customer,
      NEW.label, NEW.category, NEW.vendor, NEW.model, NEW.serial_number, NEW.mac_address,
      'active', COALESCE(NEW.installed_at::date, CURRENT_DATE), NEW.photos, NEW.installed_by
    ) RETURNING id INTO new_asset_id;

    -- Log lifecycle event
    INSERT INTO asset_lifecycle_events (org_id, asset_id, event_type, details, user_id)
    VALUES (NEW.org_id, new_asset_id, 'installed',
            jsonb_build_object('install_item_id', NEW.id, 'hw_schedule_line', NEW.hw_schedule_line),
            NEW.installed_by);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS install_item_to_asset ON install_items;
CREATE TRIGGER install_item_to_asset AFTER UPDATE ON install_items
  FOR EACH ROW EXECUTE FUNCTION create_asset_from_install_item();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_firmware_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_lifecycle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assets_org_isolation ON assets;
CREATE POLICY assets_org_isolation ON assets
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS firmware_org_isolation ON asset_firmware_history;
CREATE POLICY firmware_org_isolation ON asset_firmware_history
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS maintenance_org_isolation ON asset_maintenance;
CREATE POLICY maintenance_org_isolation ON asset_maintenance
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS lifecycle_org_isolation ON asset_lifecycle_events;
CREATE POLICY lifecycle_org_isolation ON asset_lifecycle_events
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
