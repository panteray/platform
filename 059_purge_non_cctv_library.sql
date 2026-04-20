-- ============================================================================
-- 059_purge_non_cctv_library.sql
-- Purge previously imported device_library_items rows EXCEPT CCTV.
-- CCTV rows are preserved per user directive.
-- Run BEFORE the seed SQL produced by scripts/device-library-import/.
--
-- No orphans: every table that references device_library_items(id) is either
-- cleared via FK cascade/SET NULL, or manually nulled here (for columns that
-- have no FK constraint).
-- ============================================================================
--
-- Reference map:
--   device_assets.device_id                 FK ON DELETE SET NULL  — auto
--   device_item_accessories.item_id         FK ON DELETE CASCADE   — auto
--   device_item_accessories.accessory_item_id FK ON DELETE CASCADE — auto
--   design_devices.device_library_item_id   NO FK                  — nulled here
-- ============================================================================

BEGIN;

-- Show what will be affected (counts only)
DO $$
DECLARE
  v_total  INT;
  v_keep   INT;
  v_drop   INT;
  v_design INT;
  v_assets INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM device_library_items;
  SELECT COUNT(*) INTO v_keep  FROM device_library_items WHERE category = 'cctv';
  v_drop := v_total - v_keep;

  SELECT COUNT(*) INTO v_design
    FROM design_devices dd
    JOIN device_library_items li ON li.id = dd.device_library_item_id
   WHERE li.category <> 'cctv';

  IF to_regclass('public.device_assets') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM device_assets da
               JOIN device_library_items li ON li.id = da.device_id
              WHERE li.category <> ''cctv'''
      INTO v_assets;
  ELSE
    v_assets := 0;
  END IF;

  RAISE NOTICE 'device_library_items: total=%, keep_cctv=%, delete=%', v_total, v_keep, v_drop;
  RAISE NOTICE 'design_devices rows to null: %', v_design;
  RAISE NOTICE 'device_assets rows auto-nulled via FK: %', v_assets;
END $$;

-- Null design_devices references before delete (no FK to cascade)
UPDATE design_devices
   SET device_library_item_id = NULL
 WHERE device_library_item_id IN (
   SELECT id FROM device_library_items WHERE category <> 'cctv'
 );

-- Delete. device_assets.device_id auto-nulls via FK.
-- device_item_accessories rows auto-cascade via FK.
DELETE FROM device_library_items
 WHERE category <> 'cctv';

-- Verify no orphans remain
DO $$
DECLARE
  v_orphan_design INT;
BEGIN
  SELECT COUNT(*) INTO v_orphan_design
    FROM design_devices dd
   WHERE dd.device_library_item_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM device_library_items li WHERE li.id = dd.device_library_item_id);

  IF v_orphan_design > 0 THEN
    RAISE EXCEPTION 'Orphan design_devices rows remain: %', v_orphan_design;
  END IF;

  RAISE NOTICE 'Purge complete. No orphan references.';
END $$;

COMMIT;
