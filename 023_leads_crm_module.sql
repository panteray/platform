-- ============================================================
-- Migration 023: CRM Lead Module
-- Tables: leads, lead_interactions, lead_meetings, user_credentials
-- Enums: lead_status, lead_source, lead_priority,
--        lead_archive_reason, interaction_type, interaction_direction
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('NEW','CONTACTED','QUALIFYING','QUALIFIED','CONVERTED','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM ('BUSINESS_CARD_SCAN','TRADE_SHOW','REFERRAL','COLD_CALL','WEBSITE','WALK_IN','EMAIL','PARTNER','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_priority AS ENUM ('HOT','WARM','COLD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_archive_reason AS ENUM ('NOT_QUALIFIED','WENT_COLD','DUPLICATE','NO_BUDGET','NO_RESPONSE','COMPETITOR','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE interaction_type AS ENUM ('CALL','EMAIL','MEETING','SITE_VISIT','NOTE','TEXT','LINKEDIN','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE interaction_direction AS ENUM ('INBOUND','OUTBOUND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add leads_crm to module_name enum if not already present
DO $$ BEGIN
  ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'leads_crm';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- leads
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_number   TEXT,
  status        lead_status NOT NULL DEFAULT 'NEW',
  source        lead_source,
  source_detail TEXT,

  -- Contact
  company_name       TEXT,
  contact_first_name TEXT NOT NULL,
  contact_last_name  TEXT NOT NULL,
  contact_title      TEXT,
  contact_email      TEXT,
  contact_phone      TEXT,
  contact_mobile     TEXT,

  -- Location
  address         TEXT,
  city            TEXT,
  state           TEXT,
  zip             TEXT,
  primary_website TEXT,

  -- Classification
  vertical           TEXT,  -- K12, HED, GOV, BIZ, MED
  interest_divisions TEXT[],
  estimated_value    NUMERIC,
  priority           lead_priority NOT NULL DEFAULT 'WARM',
  score              INTEGER CHECK (score >= 0 AND score <= 100),

  -- Assignment
  assigned_to UUID REFERENCES users(id),
  referred_by TEXT,

  -- Notes
  pain_points TEXT,
  notes       TEXT,

  -- Card scan
  card_scan_image_url TEXT,
  card_scan_raw       JSONB,

  -- Conversion
  converted_customer_id UUID REFERENCES customers(id),
  converted_opp_id      UUID REFERENCES opportunities(id),
  converted_at          TIMESTAMPTZ,
  converted_by          UUID REFERENCES users(id),

  -- Archive
  archive_reason lead_archive_reason,

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique lead number per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_number ON leads(org_id, lead_number);
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_org_priority ON leads(org_id, priority);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_org_isolation ON leads;
CREATE POLICY leads_org_isolation ON leads
  USING (org_id IN (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- ============================================================
-- lead_interactions
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_interactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id          UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type             interaction_type NOT NULL,
  direction        interaction_direction,
  subject          TEXT,
  body             TEXT,
  outcome          TEXT,
  interaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INTEGER,
  follow_up_date   TIMESTAMPTZ,
  follow_up_note   TEXT,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead ON lead_interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_follow_up ON lead_interactions(follow_up_date) WHERE follow_up_date IS NOT NULL;

ALTER TABLE lead_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_interactions_org_isolation ON lead_interactions;
CREATE POLICY lead_interactions_org_isolation ON lead_interactions
  USING (org_id IN (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- ============================================================
-- lead_meetings
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_meetings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id           UUID REFERENCES leads(id) ON DELETE SET NULL,
  opp_id            UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  location          TEXT,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  attendees         JSONB DEFAULT '[]'::jsonb,
  calendar_provider TEXT,     -- 'google' | 'outlook'
  calendar_event_id TEXT,
  sync_status       TEXT,     -- 'synced' | 'pending' | 'failed'
  outcome           TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_meetings_lead ON lead_meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_meetings_opp ON lead_meetings(opp_id);
CREATE INDEX IF NOT EXISTS idx_lead_meetings_start ON lead_meetings(start_time);

ALTER TABLE lead_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_meetings_org_isolation ON lead_meetings;
CREATE POLICY lead_meetings_org_isolation ON lead_meetings
  USING (org_id IN (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- ============================================================
-- user_credentials (OAuth tokens for calendar sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_credentials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,  -- 'google' | 'outlook'
  access_token_enc  TEXT,
  refresh_token_enc TEXT,
  token_expires_at  TIMESTAMPTZ,
  scope             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_credentials_user_provider ON user_credentials(user_id, provider);

ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- User can only see their own credentials
DROP POLICY IF EXISTS user_credentials_self ON user_credentials;
CREATE POLICY user_credentials_self ON user_credentials
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- ============================================================
-- Supabase Storage bucket for card scans
-- ============================================================
-- Run manually in Supabase Dashboard > Storage:
--   Create bucket: lead-assets (private)
--   Path pattern: {org_id}/card-scans/{lead_id}_{timestamp}.jpg
