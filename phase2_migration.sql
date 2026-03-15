-- ============================================================
-- PANTERAY — PHASE 2 MIGRATION
-- Expands module_name enum from 9 to 24 values
-- Run in Supabase SQL Editor BEFORE deploying Phase 2 code
-- ============================================================

-- Add PSA parent toggle
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'psa';

-- Add PSA sub-modules (Phases 11-20)
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'service_desk';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'dispatch';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'compliance_engine';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'job_costing';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'problem_management';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'change_orders';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'mobile_tech';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'invoicing';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'rmr_billing';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'sub_portal';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'customer_portal';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'contract_builder';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'integrations';
ALTER TYPE module_name ADD VALUE IF NOT EXISTS 'reporting';

-- Seed new module config rows for all existing organizations
-- This ensures every org has a row for every module (all disabled by default)
INSERT INTO org_module_config (org_id, module_name, enabled)
SELECT o.id, m.name, false
FROM organizations o
CROSS JOIN (
  VALUES
    ('psa'::module_name),
    ('service_desk'::module_name),
    ('dispatch'::module_name),
    ('compliance_engine'::module_name),
    ('job_costing'::module_name),
    ('problem_management'::module_name),
    ('change_orders'::module_name),
    ('mobile_tech'::module_name),
    ('invoicing'::module_name),
    ('rmr_billing'::module_name),
    ('sub_portal'::module_name),
    ('customer_portal'::module_name),
    ('contract_builder'::module_name),
    ('integrations'::module_name),
    ('reporting'::module_name)
) AS m(name)
ON CONFLICT (org_id, module_name) DO NOTHING;

-- Add unique constraint on org_module_config if not exists
-- (needed for upsert in the API)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_module_config_org_id_module_name_key'
  ) THEN
    ALTER TABLE org_module_config
      ADD CONSTRAINT org_module_config_org_id_module_name_key
      UNIQUE (org_id, module_name);
  END IF;
END $$;

-- Add unique constraint on org_calculator_config if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'org_calculator_config_org_id_calculator_type_key'
  ) THEN
    ALTER TABLE org_calculator_config
      ADD CONSTRAINT org_calculator_config_org_id_calculator_type_key
      UNIQUE (org_id, calculator_type);
  END IF;
END $$;

-- Add unique constraint on role_field_permissions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_field_permissions_org_role_field_key'
  ) THEN
    ALTER TABLE role_field_permissions
      ADD CONSTRAINT role_field_permissions_org_role_field_key
      UNIQUE (org_id, role_identifier, field_key);
  END IF;
END $$;
