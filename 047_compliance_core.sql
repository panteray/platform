-- ============================================================================
-- 047_compliance_core.sql
-- Phase 8 — Compliance Engine core
--   * state_licensing_reference (shared 50-state + DC reference, no org_id)
--   * technician_licenses (org-scoped per-user license records)
--   * dispatch compliance helper view
-- ============================================================================

-- ============================================================================
-- state_licensing_reference
-- Shared reference table. No org_id — same data for every tenant.
-- Status values:
--   LICENSE_REQUIRED   — state issues a dedicated low-voltage/alarm license
--   NO_STATE_LICENSE   — no state-level license; local/municipal only
--   ELECTRICIAN_LICENSE— state requires electrician license for LV work
-- ============================================================================
CREATE TABLE IF NOT EXISTS state_licensing_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state CHAR(2) NOT NULL,
  license_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('LICENSE_REQUIRED', 'NO_STATE_LICENSE', 'ELECTRICIAN_LICENSE')),
  requirements_summary TEXT,
  agency_name TEXT,
  agency_url TEXT,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (state, license_type)
);

CREATE INDEX IF NOT EXISTS idx_state_licensing_state ON state_licensing_reference(state);
CREATE INDEX IF NOT EXISTS idx_state_licensing_status ON state_licensing_reference(status);

ALTER TABLE state_licensing_reference ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user (reference data)
DROP POLICY IF EXISTS "state_licensing_read_all" ON state_licensing_reference;
CREATE POLICY "state_licensing_read_all" ON state_licensing_reference
  FOR SELECT TO authenticated
  USING (true);

-- Only ORG_ADMIN / GLOBAL_ADMIN can mutate (maintenance UI is deferred)
DROP POLICY IF EXISTS "state_licensing_admin_write" ON state_licensing_reference;
CREATE POLICY "state_licensing_admin_write" ON state_licensing_reference
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('ORG_ADMIN', 'GLOBAL_ADMIN')
    )
  );

-- ============================================================================
-- technician_licenses
-- Per-user license records, org-scoped.
-- ============================================================================
CREATE TABLE IF NOT EXISTS technician_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_type TEXT NOT NULL,
  license_number TEXT,
  state CHAR(2) NOT NULL,
  issued_date DATE,
  expiration_date DATE,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'revoked')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tech_licenses_user ON technician_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_tech_licenses_org ON technician_licenses(org_id);
CREATE INDEX IF NOT EXISTS idx_tech_licenses_state ON technician_licenses(state);
CREATE INDEX IF NOT EXISTS idx_tech_licenses_expiration ON technician_licenses(expiration_date);

ALTER TABLE technician_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tech_licenses_org_isolation" ON technician_licenses;
CREATE POLICY "tech_licenses_org_isolation" ON technician_licenses
  FOR ALL TO authenticated
  USING (
    org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE users.id = auth.uid())
  );

-- ============================================================================
-- Seed state_licensing_reference — 50 states + DC
-- Best-effort from IPVM + SIA summary data. last_verified_at stub NOW().
-- Admins can update via UI later.
-- ============================================================================
INSERT INTO state_licensing_reference (state, license_type, status, requirements_summary, agency_name, agency_url)
VALUES
  ('AL', 'Low Voltage/Alarm', 'LICENSE_REQUIRED', 'Alabama Electronic Security Board license required for alarm/security work.', 'Alabama Electronic Security Board of Licensure', 'https://aesbl.alabama.gov/'),
  ('AK', 'Electrical (Low Voltage)', 'ELECTRICIAN_LICENSE', 'Alaska requires an electrical administrator license for low-voltage work.', 'Alaska Dept of Labor — Mechanical Inspection', 'https://labor.alaska.gov/lss/mechlist.htm'),
  ('AZ', 'Alarm/Security', 'LICENSE_REQUIRED', 'Alarm Agent and Alarm Business licenses via AZDPS.', 'Arizona Department of Public Safety', 'https://www.azdps.gov/services/public/licensing/alarm'),
  ('AR', 'Alarm Systems', 'LICENSE_REQUIRED', 'Alarm Systems License through Arkansas State Police.', 'Arkansas State Police — Regulatory Services', 'https://asp.arkansas.gov/divisions/regulatory-services/alarm-systems-licensing'),
  ('CA', 'Alarm Company Qualified Manager', 'LICENSE_REQUIRED', 'ACO license + qualified manager; C-7 (low-voltage) or C-10 (electrical) for install.', 'CA Bureau of Security and Investigative Services / CSLB', 'https://www.bsis.ca.gov/'),
  ('CO', 'Local Only', 'NO_STATE_LICENSE', 'No state-level license. Municipal requirements vary (Denver, Aurora, etc.).', NULL, NULL),
  ('CT', 'Low Voltage (L-5/L-6)', 'LICENSE_REQUIRED', 'Limited Electrical (L-5 unlimited, L-6 restricted) for low-voltage work.', 'CT Dept of Consumer Protection — Occupational Licensing', 'https://portal.ct.gov/DCP/Trade-Practitioner-Licensing/Trade-Practitioner-Licensing-Page'),
  ('DE', 'Alarm/Security', 'LICENSE_REQUIRED', 'Delaware State Police licensing for alarm system installers.', 'Delaware State Police — Detective Licensing', 'https://dsp.delaware.gov/detective-licensing/'),
  ('DC', 'Security Systems', 'LICENSE_REQUIRED', 'Security Agency license via DC Metropolitan Police Department.', 'DC Metropolitan Police Department — SOMB', 'https://mpdc.dc.gov/page/security-officers-management-branch'),
  ('FL', 'Electrical Contractor (ES/EC)', 'LICENSE_REQUIRED', 'Limited Energy (ES12000) or Alarm System Contractor I/II via DBPR.', 'FL Dept of Business and Professional Regulation', 'https://www2.myfloridalicense.com/'),
  ('GA', 'Low Voltage Contractor', 'LICENSE_REQUIRED', 'LVG/LVT Low Voltage Contractor license from state licensing board.', 'GA State Licensing Board for Residential & General Contractors', 'https://sos.ga.gov/board/low-voltage-contractors'),
  ('HI', 'Contractor C-61', 'LICENSE_REQUIRED', 'C-61 specialty contractor license for low-voltage systems.', 'HI DCCA — Professional & Vocational Licensing', 'https://cca.hawaii.gov/pvl/boards/contractor/'),
  ('ID', 'Electrical (Limited Energy)', 'ELECTRICIAN_LICENSE', 'Requires a limited energy electrical license for low-voltage installation.', 'Idaho Division of Occupational & Professional Licenses', 'https://dopl.idaho.gov/electrical/'),
  ('IL', 'Local Only', 'NO_STATE_LICENSE', 'No state license; Chicago and other cities have their own requirements.', NULL, NULL),
  ('IN', 'Local Only', 'NO_STATE_LICENSE', 'No state license. Municipal requirements vary.', NULL, NULL),
  ('IA', 'Electrical (Class B/SP)', 'ELECTRICIAN_LICENSE', 'Iowa requires an electrician license; low-voltage may fall under Class SP.', 'Iowa Electrical Examining Board', 'https://dial.iowa.gov/licenses/electrical-examining-board'),
  ('KS', 'Local Only', 'NO_STATE_LICENSE', 'No state license. Municipal or county registration may apply.', NULL, NULL),
  ('KY', 'Alarm/Electronic Security', 'LICENSE_REQUIRED', 'Alarm System Contractor / Alarm System Installer via Board of Licensure.', 'KY Board of Licensure of Private Investigators', 'https://kpia.ky.gov/'),
  ('LA', 'Fire/Life Safety (LSFM)', 'LICENSE_REQUIRED', 'Louisiana State Fire Marshal licenses alarm, CCTV, access control. Supersedes local AHJ.', 'Louisiana Office of State Fire Marshal', 'https://sfm.dps.louisiana.gov/'),
  ('ME', 'Local Only', 'NO_STATE_LICENSE', 'No state license. Municipal requirements may apply.', NULL, NULL),
  ('MD', 'Alarm/Security Systems', 'LICENSE_REQUIRED', 'Maryland State Police license for alarm installers (13.C certificate).', 'MD State Police — Licensing Division', 'https://mdsp.maryland.gov/Organization/Pages/CriminalInvestigationBureau/LicensingDivision/'),
  ('MA', 'Low Voltage (LC, Class B)', 'LICENSE_REQUIRED', 'Class B / Systems Contractor license for security, fire alarm, etc.', 'MA Board of State Examiners of Electricians', 'https://www.mass.gov/orgs/board-of-state-examiners-of-electricians'),
  ('MI', 'Electrical (Fire Alarm Sign Specialty)', 'ELECTRICIAN_LICENSE', 'Electrical license or Fire Alarm Specialty license through LARA.', 'MI LARA — Electrical Division', 'https://www.michigan.gov/lara/bureau-list/bcc/divisions/electrical'),
  ('MN', 'Power Limited Technician (PLT)', 'LICENSE_REQUIRED', 'Power Limited Technician license via Dept of Labor & Industry.', 'MN Dept of Labor & Industry', 'https://www.dli.mn.gov/business/licensing-and-registration/cceb-power-limited-technician'),
  ('MS', 'Alarm System Contractor', 'LICENSE_REQUIRED', 'Alarm system company and qualifier license via Department of Insurance — Fire Marshal.', 'MS State Fire Marshal', 'https://www.mid.ms.gov/fire-marshal/'),
  ('MO', 'Local Only', 'NO_STATE_LICENSE', 'No state license. St. Louis, KC, others have local requirements.', NULL, NULL),
  ('MT', 'Local Only', 'NO_STATE_LICENSE', 'No state license for LV/alarm; municipal registration may apply.', NULL, NULL),
  ('NE', 'Local Only', 'NO_STATE_LICENSE', 'No state license. Check Omaha, Lincoln for city rules.', NULL, NULL),
  ('NV', 'NSCB C-28 Low Voltage / PILB', 'LICENSE_REQUIRED', 'Contractors Board C-28 license + PILB for surveillance/alarm businesses.', 'NV State Contractors Board / PILB', 'https://nscb.nv.gov/'),
  ('NH', 'Local Only', 'NO_STATE_LICENSE', 'No state license. Municipal requirements vary.', NULL, NULL),
  ('NJ', 'Fire Alarm / Burglar Alarm', 'LICENSE_REQUIRED', 'Fire Alarm / Burglar Alarm / Locksmith License Advisory Committee.', 'NJ Division of Consumer Affairs', 'https://www.njconsumeraffairs.gov/falbl/'),
  ('NM', 'Contractor EE-98 / ES-1', 'LICENSE_REQUIRED', 'EE-98 Electrical or ES-1 Alarm & Low Voltage contractor via CID.', 'NM Regulation & Licensing Department — CID', 'https://www.rld.nm.gov/construction/'),
  ('NY', 'Local Only (NYC is separate)', 'NO_STATE_LICENSE', 'No statewide license. NYC requires separate contractor licensing via DOB/DCWP.', NULL, NULL),
  ('NC', 'Low Voltage / Alarm Systems', 'LICENSE_REQUIRED', 'Alarm Systems License Board + Electrical Contractor Limited License.', 'NC Alarm Systems Licensing Board', 'https://ncaslb.nc.gov/'),
  ('ND', 'Local Only', 'NO_STATE_LICENSE', 'No state license for low-voltage/alarm work.', NULL, NULL),
  ('OH', 'Local Only', 'NO_STATE_LICENSE', 'No state license. Municipal rules apply (Cleveland, Columbus, etc.).', NULL, NULL),
  ('OK', 'Alarm / Locksmith Industry', 'LICENSE_REQUIRED', 'Alarm/Locksmith Industry Committee license through CIB.', 'OK Construction Industries Board', 'https://cib.ok.gov/'),
  ('OR', 'Limited Energy Technician (LEA/LEB)', 'LICENSE_REQUIRED', 'Oregon BCD Limited Energy Technician license (Class A or B).', 'OR Building Codes Division', 'https://www.oregon.gov/bcd/licensing/Pages/electrical.aspx'),
  ('PA', 'Local Only', 'NO_STATE_LICENSE', 'No state license. Philadelphia and others have local rules.', NULL, NULL),
  ('RI', 'Electrician (Limited Premises / BL)', 'ELECTRICIAN_LICENSE', 'Limited Premises or Burglar/Fire Alarm license via Dept of Labor.', 'RI Department of Labor & Training', 'https://dlt.ri.gov/individuals/professional-regulation/electricians'),
  ('SC', 'Burglar Alarm / Fire Alarm', 'LICENSE_REQUIRED', 'Burglar Alarm / Fire Alarm licenses via LLR.', 'SC Dept of Labor, Licensing and Regulation', 'https://llr.sc.gov/'),
  ('SD', 'Local Only', 'NO_STATE_LICENSE', 'No state license for alarm/low-voltage work.', NULL, NULL),
  ('TN', 'Alarm Systems Contractor', 'LICENSE_REQUIRED', 'Alarm Systems Contractors Board via Dept of Commerce & Insurance.', 'TN Alarm Systems Contractors Board', 'https://www.tn.gov/commerce/regboards/alarm.html'),
  ('TX', 'PSB Class A / Alarm License', 'LICENSE_REQUIRED', 'DPS Private Security Bureau license for alarm/CCTV/access control.', 'Texas DPS — Private Security Bureau', 'https://www.dps.texas.gov/section/private-security'),
  ('UT', 'Alarm Company / Alarm Agent', 'LICENSE_REQUIRED', 'Alarm Company + Alarm Company Agent licenses via DOPL.', 'UT Division of Occupational & Professional Licensing', 'https://dopl.utah.gov/alarm/'),
  ('VT', 'Electrician (Type E / EL)', 'ELECTRICIAN_LICENSE', 'Type E or EL electrician license covers low-voltage work.', 'VT Electrical Licensing Board', 'https://firesafety.vermont.gov/electrical'),
  ('VA', 'DCJS Private Security Services', 'LICENSE_REQUIRED', 'Electronic Security Business / Technician via DCJS.', 'VA Dept of Criminal Justice Services', 'https://www.dcjs.virginia.gov/private-security-services'),
  ('WA', 'Electrical (06A/06B Limited Energy)', 'ELECTRICIAN_LICENSE', 'Specialty electrical license 06A (telecom) or 06B (limited energy).', 'WA Dept of Labor & Industries', 'https://www.lni.wa.gov/licensing-permits/electrical/'),
  ('WV', 'Contractor Electrical (Low Voltage)', 'ELECTRICIAN_LICENSE', 'Contractor Licensing Board — Electrical (Low Voltage) classification.', 'WV Division of Labor — Contractor Licensing', 'https://labor.wv.gov/Licensing/Contractor-Licensing/'),
  ('WI', 'Electrical (Journeyman / Cable Installer)', 'ELECTRICIAN_LICENSE', 'Journeyman Electrician or Cable Installer credential via DSPS.', 'WI Department of Safety & Professional Services', 'https://dsps.wi.gov/Pages/Professions/Electricians/Default.aspx'),
  ('WY', 'Electrical (Low Voltage Installer)', 'ELECTRICIAN_LICENSE', 'Wyoming Electrical Board — Low Voltage Installer classification.', 'WY Department of Fire Prevention & Electrical Safety', 'https://wyofire.wyo.gov/electrical')
ON CONFLICT (state, license_type) DO NOTHING;

-- ============================================================================
-- Grants
-- ============================================================================
GRANT SELECT ON state_licensing_reference TO authenticated;
GRANT ALL ON state_licensing_reference TO service_role;
GRANT ALL ON technician_licenses TO authenticated;
GRANT ALL ON technician_licenses TO service_role;
