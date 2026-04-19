-- 055_device_library_unique.sql
-- Prevent duplicate device library items within an org.
-- Dedup existing rows (keep earliest created_at) before adding unique indexes.

-- 1) Dedup on (org_id, lower(vendor), lower(model))
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY org_id, lower(coalesce(vendor,'')), lower(coalesce(model,''))
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM device_library_items
  WHERE model IS NOT NULL AND model <> ''
)
DELETE FROM device_library_items
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Dedup on (org_id, lower(vendor), lower(partnumber))
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY org_id, lower(coalesce(vendor,'')), lower(coalesce(partnumber,''))
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM device_library_items
  WHERE partnumber IS NOT NULL AND partnumber <> ''
)
DELETE FROM device_library_items
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3) Unique indexes (partial — ignore empty values)
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_library_org_vendor_model
  ON device_library_items (org_id, lower(vendor), lower(model))
  WHERE model IS NOT NULL AND model <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_device_library_org_vendor_partnumber
  ON device_library_items (org_id, lower(vendor), lower(partnumber))
  WHERE partnumber IS NOT NULL AND partnumber <> '';
