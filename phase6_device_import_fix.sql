-- Phase 6: Fix device_import_batches missing columns
-- The import API writes file_type, total_rows, and approved_rows but these columns
-- were never added to the table.

ALTER TABLE device_import_batches
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS total_rows integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_rows integer DEFAULT 0;
