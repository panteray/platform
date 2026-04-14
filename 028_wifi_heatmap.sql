-- ============================================================
-- 028 — WiFi Heatmap + Jurisdiction Rulesets
-- Phase 2E: WiFi AP placement + heatmap, Plan Review rules
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. design_wifi_aps — WiFi access point placement on canvas
-- ============================================================
CREATE TABLE IF NOT EXISTS design_wifi_aps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  design_id     UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  area_id       UUID,
  canvas_id     UUID,
  ap_model      TEXT,
  vendor        TEXT,
  band          TEXT NOT NULL DEFAULT 'dual',  -- 2.4 | 5 | 6 | dual | tri
  channel       INT,
  channel_width INT DEFAULT 40,                -- MHz: 20, 40, 80, 160
  tx_power_dbm  DOUBLE PRECISION DEFAULT 20,
  antenna_gain_dbi DOUBLE PRECISION DEFAULT 3,
  mount_height_ft DOUBLE PRECISION DEFAULT 10,
  environment   TEXT DEFAULT 'office',         -- office | warehouse | outdoor | classroom | hospital
  position_x    DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y    DOUBLE PRECISION NOT NULL DEFAULT 0,
  label         TEXT NOT NULL DEFAULT '',
  color_hex     TEXT DEFAULT '#3b82f6',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wifi_aps_design ON design_wifi_aps(design_id);
CREATE INDEX IF NOT EXISTS idx_wifi_aps_org ON design_wifi_aps(org_id);

ALTER TABLE design_wifi_aps ENABLE ROW LEVEL SECURITY;
CREATE POLICY wifi_aps_org_isolation ON design_wifi_aps
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE TRIGGER wifi_aps_updated_at
  BEFORE UPDATE ON design_wifi_aps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. jurisdiction_rulesets — Plan review compliance rules
-- ============================================================
CREATE TABLE IF NOT EXISTS jurisdiction_rulesets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id),
  jurisdiction    TEXT NOT NULL,            -- e.g. 'LA', 'IBC_2021', 'NFPA_72', 'LASFM'
  rule_code       TEXT NOT NULL,            -- e.g. 'IBC_716.2', 'NFPA_80_6.4.4'
  rule_category   TEXT NOT NULL,            -- e.g. 'fire_rated', 'egress', 'ada', 'maglock'
  severity        TEXT NOT NULL DEFAULT 'HIGH',  -- HIGH | MED | LOW | INFO
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  fix_hint        TEXT,
  applies_to      TEXT[],                   -- e.g. '{door,maglock,delayed_egress}'
  conditions      JSONB DEFAULT '{}',       -- machine-readable rule conditions
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jurisdiction_org ON jurisdiction_rulesets(org_id);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_code ON jurisdiction_rulesets(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_jurisdiction_category ON jurisdiction_rulesets(rule_category);

ALTER TABLE jurisdiction_rulesets ENABLE ROW LEVEL SECURITY;
CREATE POLICY jurisdiction_rulesets_isolation ON jurisdiction_rulesets
  USING (
    org_id IS NULL OR
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

CREATE TRIGGER jurisdiction_rulesets_updated_at
  BEFORE UPDATE ON jurisdiction_rulesets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed base IBC/NFPA rules
INSERT INTO jurisdiction_rulesets (jurisdiction, rule_code, rule_category, severity, title, description, fix_hint, applies_to) VALUES
  ('IBC_2021', 'IBC_716.2', 'fire_rated', 'HIGH', 'Maglock prohibited on fire-rated doors', 'Magnetic locks shall not be used on fire-rated door assemblies per IBC 716.2', 'Use electric strike or electrified mortise lock instead', '{maglock,fire_rated}'),
  ('NFPA_80', 'NFPA_80_6.4.4', 'fire_rated', 'HIGH', 'Fire door hardware must be listed', 'Hardware on fire door assemblies must be listed and labeled per NFPA 80 Section 6.4.4', 'Verify UL listing for all hardware on fire-rated doors', '{fire_rated}'),
  ('IBC_2021', 'IBC_1010.1.9.8', 'egress', 'HIGH', 'Delayed egress prohibited in Assembly', 'Delayed egress locks prohibited in Assembly occupancy per IBC 1010.1.9.8', 'Use fail-safe electric strike or panic hardware instead', '{delayed_egress,assembly}'),
  ('ADA', 'ADA_309.4', 'ada', 'MED', 'Card reader height non-compliant', 'Operable parts must be between 15-48 inches AFF per ADA 309.4', 'Mount card reader between 42-48 inches AFF', '{reader,ada}'),
  ('ADA', 'ADA_404.2.7', 'ada', 'MED', 'Door opening force exceeds limit', 'Interior hinged doors shall not exceed 5 lbs opening force per ADA 404.2.7', 'Verify auto-operator or adjust closer', '{door,ada}'),
  ('IBC_2021', 'IBC_1009.3', 'egress', 'HIGH', 'Stairwell door must be fail-safe', 'Stairwell egress doors must fail safe (unlock on power loss) per IBC 1009.3', 'Use fail-safe lock; verify backup power does NOT keep door locked', '{stairwell,egress}'),
  ('LASFM', 'LASFM_AHJ', 'jurisdiction', 'MED', 'LASFM jurisdiction — additional review required', 'Louisiana State Fire Marshal has additional requirements beyond IBC base code', 'Submit plans to LASFM for review; verify local amendments', '{louisiana}')
ON CONFLICT DO NOTHING;
