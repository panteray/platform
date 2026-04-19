-- 054_design_device_placed.sql
-- Adds `placed` flag so BOM-only rows (added from library or typed on the
-- BOM tab) don't draw on the map until the user places them.
-- Existing rows default to TRUE — they're already placed.

ALTER TABLE design_devices
  ADD COLUMN IF NOT EXISTS placed BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_design_devices_design_placed
  ON design_devices (design_id, placed);
