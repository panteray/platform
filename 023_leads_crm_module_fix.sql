-- Fix: Drop existing policies then recreate (tables/enums already exist from partial run)

-- leads
DROP POLICY IF EXISTS leads_org_isolation ON leads;
CREATE POLICY leads_org_isolation ON leads
  USING (org_id IN (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- lead_interactions
ALTER TABLE lead_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_interactions_org_isolation ON lead_interactions;
CREATE POLICY lead_interactions_org_isolation ON lead_interactions
  USING (org_id IN (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- lead_meetings
ALTER TABLE lead_meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_meetings_org_isolation ON lead_meetings;
CREATE POLICY lead_meetings_org_isolation ON lead_meetings
  USING (org_id IN (SELECT org_id FROM users WHERE auth_id = auth.uid()));

-- user_credentials
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_credentials_self ON user_credentials;
CREATE POLICY user_credentials_self ON user_credentials
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
