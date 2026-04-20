-- ============================================================================
-- 059_purge_non_cctv_library.sql
-- Purge previously imported device_library_items rows EXCEPT CCTV.
-- Run BEFORE the seed SQL in scripts/device-library-import/out/.
--
-- Handles all references to device_library_items:
--   device_assets.device_id                 FK ON DELETE SET NULL  — auto
--   device_item_accessories.*               FK ON DELETE CASCADE   — auto
--   design_devices.device_library_item_id   NO FK                  — manual null
-- ============================================================================

-- Null design_devices refs that point at non-CCTV items (no FK to cascade)
UPDATE design_devices
   SET device_library_item_id = NULL
 WHERE device_library_item_id IN (
   SELECT id FROM device_library_items WHERE category <> 'cctv'
 );

-- Null any pre-existing orphan refs (point at IDs that no longer exist)
UPDATE design_devices
   SET device_library_item_id = NULL
 WHERE device_library_item_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM device_library_items li WHERE li.id = design_devices.device_library_item_id
   );

-- Delete non-CCTV items. device_assets.device_id auto-nulls via FK.
-- device_item_accessories rows auto-cascade via FK.
DELETE FROM device_library_items
 WHERE category <> 'cctv';
