-- ============================================================
-- PANTERAY — PHASE 3 MIGRATION
-- Adds preferences column to users table for dashboard layout
-- Run in Supabase SQL Editor BEFORE deploying Phase 3 code
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}';
