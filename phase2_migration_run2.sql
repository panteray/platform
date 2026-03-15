-- ============================================================
-- PANTERAY — PHASE 2 MIGRATION — RUN 2 OF 2
-- Seeds module config rows + adds unique constraints
-- Run this AFTER phase2_migration_run1.sql has completed
-- ============================================================

-- Seed new module config rows for all existing organizations
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
