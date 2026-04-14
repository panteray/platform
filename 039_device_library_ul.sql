-- G2: UL listing flags on device library
-- Adds UL 294/2050/827 certification tracking alongside existing NDAA compliance

ALTER TABLE device_library_items
  ADD COLUMN IF NOT EXISTS ul_listed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ul_listing_code text;

COMMENT ON COLUMN device_library_items.ul_listed IS 'Device carries a UL listing';
COMMENT ON COLUMN device_library_items.ul_listing_code IS 'UL listing code, e.g. UL 294, UL 2050, UL 827';
