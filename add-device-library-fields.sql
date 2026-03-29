-- Add new device library fields for camera specs
ALTER TABLE device_library_items
  ADD COLUMN IF NOT EXISTS form text,
  ADD COLUMN IF NOT EXISTS ir text,
  ADD COLUMN IF NOT EXISTS super_low_light boolean,
  ADD COLUMN IF NOT EXISTS focal_length text,
  ADD COLUMN IF NOT EXISTS focal_type text,
  ADD COLUMN IF NOT EXISTS aov text,
  ADD COLUMN IF NOT EXISTS imager_count integer,
  ADD COLUMN IF NOT EXISTS multi_imager_type text,
  ADD COLUMN IF NOT EXISTS codecs text,
  ADD COLUMN IF NOT EXISTS fisheye_view text,
  ADD COLUMN IF NOT EXISTS environment text;
