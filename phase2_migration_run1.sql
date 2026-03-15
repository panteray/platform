-- ============================================================
-- PANTERAY — PHASE 2 MIGRATION — RUN 1 OF 2
-- Expands module_name enum + adds description column
-- Run this FIRST, then run phase2_migration_run2.sql
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

-- Add description to custom_roles
ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS description text;
