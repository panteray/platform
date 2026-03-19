-- ============================================================
-- PANTERAY Phase 5D Migration
-- Vendor→Manufacturer rename + Distributors + Material Tracking
-- Run in Supabase SQL Editor
-- ============================================================

-- Add unique constraints for customer_number and sub_number
ALTER TABLE customers ADD CONSTRAINT unique_customer_number UNIQUE (customer_number);
ALTER TABLE subcontractors ADD CONSTRAINT unique_sub_number UNIQUE (sub_number);
-- If vendors table exists and has vendor_number, add:
-- ALTER TABLE vendors ADD CONSTRAINT unique_vendor_number UNIQUE (vendor_number);

-- ── RENAME VENDORS → MANUFACTURERS ──

ALTER TABLE vendors RENAME TO manufacturers;
ALTER TABLE manufacturers RENAME COLUMN vendor_number TO manufacturer_number;

ALTER TABLE vendor_types RENAME TO manufacturer_types;
ALTER TABLE manufacturer_types RENAME COLUMN vendor_id TO manufacturer_id;

ALTER TABLE vendor_contacts RENAME TO manufacturer_contacts;
ALTER TABLE manufacturer_contacts RENAME COLUMN vendor_id TO manufacturer_id;

ALTER TABLE opp_vendors RENAME TO opp_manufacturers;
ALTER TABLE opp_manufacturers RENAME COLUMN vendor_id TO manufacturer_id;

ALTER TYPE vendor_type RENAME TO manufacturer_type;

-- ── DISTRIBUTORS (NEW) ──

CREATE TABLE distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  distributor_number text,
  name text NOT NULL,
  account_number text,
  rep_name text,
  rep_email text,
  rep_phone text,
  website text,
  portal_login text,
  address text,
  city text,
  state text,
  zip text,
  region text,
  region_state text,
  payment_terms text,
  shipping_methods text[] DEFAULT '{}',
  credit_limit numeric,
  discount_tier text,
  is_preferred boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  status text DEFAULT 'Active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_distributors_org ON distributors(org_id);
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "distributors_org_isolation" ON distributors
  FOR ALL USING (org_id IN (
    SELECT org_id FROM users WHERE auth_id = auth.uid()
  ));

CREATE TRIGGER set_distributors_updated_at
  BEFORE UPDATE ON distributors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── OPP-DISTRIBUTOR JUNCTION ──

CREATE TABLE opp_distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  opp_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  distributor_id uuid NOT NULL REFERENCES distributors(id),
  quote_number text,
  quote_date date,
  quote_amount numeric,
  status text NOT NULL DEFAULT 'QUOTING',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_opp_distributors_opp ON opp_distributors(opp_id);
CREATE INDEX idx_opp_distributors_org ON opp_distributors(org_id);
ALTER TABLE opp_distributors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opp_distributors_org_isolation" ON opp_distributors
  FOR ALL USING (org_id IN (
    SELECT org_id FROM users WHERE auth_id = auth.uid()
  ));

-- ── MATERIAL TRACKING ──

CREATE TABLE opp_material_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  opp_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  line_number text,
  distributor_id uuid REFERENCES distributors(id),
  manufacturer_id uuid REFERENCES manufacturers(id),
  item_description text NOT NULL,
  part_number text,
  quantity integer NOT NULL DEFAULT 1,
  unit_cost numeric,
  extended_cost numeric,
  order_number text,
  tracking_number text,
  carrier text,
  ship_status text NOT NULL DEFAULT 'NOT_ORDERED',
  date_ordered date,
  estimated_delivery_date date,
  actual_delivery_date date,
  ship_to_address text,
  ship_to_city text,
  ship_to_state text,
  ship_to_zip text,
  warehouse_location text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_opp_material_opp ON opp_material_tracking(opp_id);
CREATE INDEX idx_opp_material_org ON opp_material_tracking(org_id);
ALTER TABLE opp_material_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opp_material_org_isolation" ON opp_material_tracking
  FOR ALL USING (org_id IN (
    SELECT org_id FROM users WHERE auth_id = auth.uid()
  ));

CREATE TRIGGER set_opp_material_updated_at
  BEFORE UPDATE ON opp_material_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
