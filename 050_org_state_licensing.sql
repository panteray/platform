-- ============================================================================
-- 050_org_state_licensing.sql
-- State Licensing: fix global template, create per-org editable table,
-- seed existing orgs
-- ============================================================================

-- ============================================================================
-- 1. Fix state_licensing_reference (global template)
-- ============================================================================

-- Wipe generic seed data FIRST (before constraint change — old rows have ELECTRICIAN_LICENSE)
TRUNCATE state_licensing_reference;

-- Now safe to drop old CHECK and add simplified one
ALTER TABLE state_licensing_reference
  DROP CONSTRAINT IF EXISTS state_licensing_reference_status_check;

ALTER TABLE state_licensing_reference
  ADD CONSTRAINT state_licensing_reference_status_check
  CHECK (status IN ('LICENSE_REQUIRED', 'NO_STATE_LICENSE'));

-- Insert verified data (source: Dexter's CSV + JVSG 2026-04-15)
INSERT INTO state_licensing_reference (state, license_type, status, requirements_summary, agency_name, agency_url) VALUES
  ('AL', 'Electronic Security License (Burglar Alarms, CCTV, Electronic Access Control)', 'LICENSE_REQUIRED', 'Requires biennial registration, background check, ID badge, NTS course/equivalent (14-hour Video System Technologies course for CCTV), and $250,000 liability insurance.', 'Alabama Electronic Security Board of Licensure', 'https://aesbl.alabama.gov/'),
  ('AK', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('AZ', 'Low Voltage Communication Systems License', 'LICENSE_REQUIRED', 'Registrar of Contractors license required. Qualifying agent needs business and technical exams, criminal background check, and registration with Board of Technical Registration.', 'Arizona Registrar of Contractors', 'https://roc.az.gov/'),
  ('AR', 'Alarm System Company License / Certified Alarm Technician Level I', 'LICENSE_REQUIRED', 'Arkansas State Police regulated. Installers need Certified Alarm Technician Level I (22-hour online course) and background check.', 'Arkansas State Police', 'https://dps.arkansas.gov/'),
  ('CA', 'Low Voltage Systems (C-7) / Lock and Security Equipment (C-28)', 'LICENSE_REQUIRED', 'Requires background check, 2 years paid experience, FBI clearance, and state law exam.', 'California Contractors State License Board', 'https://cslb.ca.gov/'),
  ('CO', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('CT', 'CT L5 Limited Electrical', 'LICENSE_REQUIRED', 'Requires Business/Law and Trade parts exams (120 and 90 min) and 2 years of documented experience.', 'Connecticut Dept of Consumer Protection', 'https://portal.ct.gov/DCP'),
  ('DE', 'State Police Registration', 'LICENSE_REQUIRED', 'Requires registration, deposit, ID card, background check, and no felony/disqualifying record.', 'Delaware State Police', 'https://dsp.delaware.gov/alarms/'),
  ('DC', 'Master Electrician / Qualified Agent', 'LICENSE_REQUIRED', 'Licensed master electrician may apply for a separate license as a qualified agent. Background check required.', 'DC Council', 'https://code.dccouncil.us/'),
  ('FL', 'Certified Alarm Systems Contractor I or II', 'LICENSE_REQUIRED', 'Requires exam, Florida state law/safety test, positive net worth credit report, and $10,000 company net worth.', 'FL Dept of Business and Professional Regulation', 'https://myfloridalicense.com/'),
  ('GA', 'Low Voltage License (LVG, LVT, LVA, LVU)', 'LICENSE_REQUIRED', 'Requires 1 year experience, Business and Law Examination, background check, and three letters of recommendation.', 'Georgia Secretary of State', 'https://sos.ga.gov/'),
  ('HI', 'None', 'NO_STATE_LICENSE', 'No license required for CCTV, but companies must maintain a $5,000 surety bond for the first five years.', 'Dept of Commerce and Consumer Affairs', 'https://cca.hawaii.gov/pvl/'),
  ('ID', 'Specialty Electrical Contractor''s License / Specialty Journeyman License', 'LICENSE_REQUIRED', 'Requires exam, 2 years experience, proof of insurance, and trainee registration.', 'Division of Occupational and Professional Licenses', 'https://dopl.idaho.gov/'),
  ('IL', 'Private Alarm Contractor', 'LICENSE_REQUIRED', 'Requires private alarm contractor licensure exam, 3 years experience, and background check.', 'Illinois DFPR', 'https://idfpr.com/'),
  ('IN', 'None', 'NO_STATE_LICENSE', 'No state license required. Local municipalities may require a contractor''s or low-voltage license.', NULL, NULL),
  ('IA', 'Video Surveillance / Alarm System License', 'LICENSE_REQUIRED', 'Requires NTS Level I exam (22-hour online course) and background check.', 'Iowa Department of Public Safety', 'https://dps.iowa.gov/'),
  ('KS', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('KY', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('LA', 'Type A, Type A-2, or Type A-4 (CCTV Alarm System Contractor)', 'LICENSE_REQUIRED', 'Type A-4 requires NTS Video Systems Technology or VSSE course. Background check required.', 'Louisiana Office of State Fire Marshal', 'https://sfm.dps.louisiana.gov/'),
  ('ME', 'Limited Electrician in Low Energy', 'LICENSE_REQUIRED', 'Requires 270 hours training and 4,000 hours experience.', 'Maine Electricians'' Examination Board', 'https://www.maine.gov/pfr/'),
  ('MD', 'Master Electrician', 'LICENSE_REQUIRED', 'Requires background check, good moral character, and insurance certificate.', 'State Board of Master Electricians', 'https://mdsp.maryland.gov/'),
  ('MA', 'Systems Technician / Systems Contractor', 'LICENSE_REQUIRED', 'Systems Technician requires 300 hours classroom + 4,000 hours experience. Systems Contractor requires 1+ year experience + 75 hours training.', 'Commonwealth of Massachusetts', 'https://www.mass.gov/'),
  ('MI', 'Systems Contractor / Systems Technician', 'LICENSE_REQUIRED', 'Requires background check, bond, and 4 years management experience for contractors.', 'Dept of Licensing and Regulatory Affairs', 'https://www.michigan.gov/lara'),
  ('MN', 'Technology Systems Contractor / Power Limited Technician', 'LICENSE_REQUIRED', 'Technology Systems Contractor license for companies, Power Limited Technician license for qualifying agents.', 'Minnesota Dept of Labor and Industry', 'https://www.dli.mn.gov/'),
  ('MS', 'Class A, B, C, D, or H Alarm License', 'LICENSE_REQUIRED', 'Requires background check. Companies need $300k liability/workers comp. Class B requires NBFAA Level 2 training; Class C requires Level 1.', 'Mississippi Dept of Public Safety', 'https://mid.ms.gov/sfm/'),
  ('MO', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('MT', 'Alarm Installer License', 'LICENSE_REQUIRED', 'Requires background check and proof of insurance.', 'Montana Dept of Labor and Industry', 'https://boards.bsd.dli.mt.gov/'),
  ('NE', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('NV', 'C-2d Low Voltage Systems', 'LICENSE_REQUIRED', 'Requires 4 years experience, business law and technical exams, bond, and financial statements.', 'Nevada State Contractors Board', 'https://nvcontractorsboard.com/'),
  ('NH', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('NJ', 'Burglar Alarm, Fire Alarm, or Locksmith License', 'LICENSE_REQUIRED', 'Requires 4 years experience, 80 hours technical courses, business/law and technical exams, background check, surety bond, and 24-hour emergency phone number.', 'NJ Division of Consumer Affairs', 'https://www.njconsumeraffairs.gov/fbl/'),
  ('NM', 'ES-3: Sound and Intercommunication and Electrical Alarm Systems', 'LICENSE_REQUIRED', 'Requires 2 years experience, exam, background check, and surety bond.', 'NM Regulation and Licensing Department — CID', 'https://www.rld.nm.gov/construction/'),
  ('NY', 'State Security License', 'LICENSE_REQUIRED', 'Requires 81 hours of training, background check, and application.', 'New York State Division of Licensing Services', NULL),
  ('NC', 'Alarm Systems Business License / Low Voltage (SP-LV)', 'LICENSE_REQUIRED', 'Requires 2 years experience or Certified Alarm Technician Level I, references, and background check.', 'NC State Board of Examiners of Electrical Contractors', 'https://ncbeec.org/'),
  ('ND', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('OH', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('OK', 'Oklahoma Alarm License (Company / Manager / Technician)', 'LICENSE_REQUIRED', 'Requires exams, background check, and up to 4 years experience (2 as licensed technician).', 'Oklahoma Alarm and Locksmith Industry Committee', NULL),
  ('OR', 'Burglar Alarm Installer License', 'LICENSE_REQUIRED', 'Requires 3 years apprentice experience (or out-of-state equivalent), background check, and exam.', 'Oregon Dept of Consumer and Business Services', 'https://www.oregon.gov/bcd/'),
  ('PA', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('RI', 'Telecommunication System Contractor / Technician / Limited Installer', 'LICENSE_REQUIRED', 'Requires background check, personal references, bond, and 24-hour service capability.', 'Rhode Island Dept of Labor and Training', NULL),
  ('SC', 'Burglar and Fire Alarm Business / Burglar Alarm Contractor', 'LICENSE_REQUIRED', 'Requires background check, exam, proof of insurance, and collateral.', 'SC Dept of Labor, Licensing and Regulation', 'https://llr.sc.gov/'),
  ('SD', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('TN', 'Low Voltage License / Alarm Systems Contractor Company', 'LICENSE_REQUIRED', 'Requires background check and registration with Alarm Contractors Board.', 'Tennessee Alarm Contractors Board', 'https://www.tn.gov/commerce/'),
  ('TX', 'Texas Private Security Bureau License', 'LICENSE_REQUIRED', 'Requires technical exam, Texas code exam, and Certified Alarm Technician Level I exam. It is a crime to contract to install surveillance cameras without a license.', 'Texas DPS — Private Security Bureau', 'https://www.dps.texas.gov/section/private-security/'),
  ('UT', 'Burglar Alarm Company / Agent / Qualifier', 'LICENSE_REQUIRED', 'Requires 3 years experience (1 supervisory), technical/law exams, insurance, and background check.', 'Utah Division of Occupational and Professional Licensing', NULL),
  ('VT', 'G7-k Electrician''s License', 'LICENSE_REQUIRED', 'Required for electronic access control.', 'Vermont Dept of Fire Prevention and Electrical Safety', 'https://firesafety.vermont.gov/'),
  ('VA', 'Virginia Alarm License / Electronic Security Technician', 'LICENSE_REQUIRED', 'Requires 14 hours state-approved training for technicians, background check.', 'Virginia Dept of Criminal Justice Services', 'https://www.dcjs.virginia.gov/'),
  ('WA', 'Alarm Installation Company License', 'LICENSE_REQUIRED', 'Requires 4 years experience, 48 hours of classroom training in state.', 'Washington State Dept of Labor and Industries', NULL),
  ('WV', 'Specialty Electrician (Fire/Burglar Alarm)', 'LICENSE_REQUIRED', 'Requires 4,000 hours or 2+ years experience in alarms, low-voltage classification.', 'West Virginia Division of Labor', NULL),
  ('WI', 'None', 'NO_STATE_LICENSE', 'No state license is required.', NULL, NULL),
  ('WY', 'Low Voltage Technician / Contractor / Apprentice', 'LICENSE_REQUIRED', 'Requires 3,000+ hours experience for LV-A exam.', 'Wyoming Dept of Fire Prevention and Electrical Safety', 'https://wsfm.wyo.gov/')
ON CONFLICT (state, license_type) DO NOTHING;

-- ============================================================================
-- 2. Create org_state_licensing (per-org editable copy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_state_licensing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  state CHAR(2) NOT NULL,
  license_required BOOLEAN NOT NULL DEFAULT false,
  license_type TEXT,
  requirements_summary TEXT,
  agency_name TEXT,
  agency_url TEXT,
  notes TEXT,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, state)
);

CREATE INDEX IF NOT EXISTS idx_org_state_licensing_org ON org_state_licensing(org_id);
CREATE INDEX IF NOT EXISTS idx_org_state_licensing_state ON org_state_licensing(state);

ALTER TABLE org_state_licensing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_state_licensing_org_isolation" ON org_state_licensing;
CREATE POLICY "org_state_licensing_org_isolation" ON org_state_licensing
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid())
  );

-- Updated_at trigger
CREATE TRIGGER org_state_licensing_updated_at
  BEFORE UPDATE ON org_state_licensing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. Function: copy global template → org
-- ============================================================================
CREATE OR REPLACE FUNCTION seed_org_state_licensing()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO org_state_licensing (org_id, state, license_required, license_type, requirements_summary, agency_name, agency_url)
  SELECT
    NEW.id,
    r.state,
    (r.status = 'LICENSE_REQUIRED'),
    CASE WHEN r.status = 'LICENSE_REQUIRED' THEN r.license_type ELSE NULL END,
    r.requirements_summary,
    r.agency_name,
    r.agency_url
  FROM state_licensing_reference r
  ON CONFLICT (org_id, state) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire on new org creation
DROP TRIGGER IF EXISTS trg_seed_org_state_licensing ON organizations;
CREATE TRIGGER trg_seed_org_state_licensing
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION seed_org_state_licensing();

-- ============================================================================
-- 4. Seed all existing orgs
-- ============================================================================
INSERT INTO org_state_licensing (org_id, state, license_required, license_type, requirements_summary, agency_name, agency_url)
SELECT
  o.id,
  r.state,
  (r.status = 'LICENSE_REQUIRED'),
  CASE WHEN r.status = 'LICENSE_REQUIRED' THEN r.license_type ELSE NULL END,
  r.requirements_summary,
  r.agency_name,
  r.agency_url
FROM organizations o
CROSS JOIN state_licensing_reference r
ON CONFLICT (org_id, state) DO NOTHING;

-- ============================================================================
-- Grants
-- ============================================================================
GRANT ALL ON org_state_licensing TO authenticated;
GRANT ALL ON org_state_licensing TO service_role;
