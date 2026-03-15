-- ============================================================
-- PANTERAY — PHASE 2 MIGRATION
-- Expands module_name enum from 9 to 24 values
-- Adds description column to custom_roles
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

-- Add description to custom_roles (needed for Phase 2 UI)
ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS description text;

-- Seed new module config rows for all existing organizations
-- Column is "module" (not "module_name"), "is_enabled" (not "enabled")
INSERT INTO org_module_config (org_id, module, is_enabled)
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
ON CONFLICT (org_id, module) DO NOTHING;

-- Add unique constraint on role_field_permissions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_field_permissions_org_role_field_key'
  ) THEN
    ALTER TABLE role_field_permissions
      ADD CONSTRAINT role_field_permissions_org_role_field_key
      UNIQUE (org_id, role_key, field_key);
  END IF;
END $$;
