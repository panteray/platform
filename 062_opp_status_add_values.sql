-- ============================================================
-- 062 — Add Phase 1 OppStatus values to opp_status enum
-- ============================================================
-- Fixes an oversight in migration 061: opportunities.status IS a
-- Postgres enum (opp_status), not a TEXT column as previously assumed.
-- The 8 new statuses added to src/types/enums.ts in Phase 1 must also
-- exist in the DB or transitions will fail with 22P02:
--   invalid input value for enum opp_status: "ORDER_ENTRY"
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- In Supabase SQL Editor, run these one statement at a time.
-- ============================================================

ALTER TYPE opp_status ADD VALUE IF NOT EXISTS 'ORDER_ENTRY';
ALTER TYPE opp_status ADD VALUE IF NOT EXISTS 'SHIP_HOLD';
ALTER TYPE opp_status ADD VALUE IF NOT EXISTS 'PM_ASSIGNMENT';
ALTER TYPE opp_status ADD VALUE IF NOT EXISTS 'IKOM';
ALTER TYPE opp_status ADD VALUE IF NOT EXISTS 'CKOM';
ALTER TYPE opp_status ADD VALUE IF NOT EXISTS 'SCHEDULING';
ALTER TYPE opp_status ADD VALUE IF NOT EXISTS 'OPERATIONAL_VALIDATION';
ALTER TYPE opp_status ADD VALUE IF NOT EXISTS 'OPERATIONAL_CLOSURE';
