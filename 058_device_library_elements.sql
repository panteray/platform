-- ============================================================================
-- 058_device_library_elements.sql
-- Device Library refactor — introduce Element / Profile / Accessory model
-- from System Surveyor Element Profile taxonomy.
-- ============================================================================
--
-- MODEL
--   device_elements            — element types ("Fixed Camera", "ACS Controller", etc.)
--                                with JSONB attribute_schema (sections + attrs + options)
--   device_library_items       — existing table, now gains element_id FK + attributes JSONB
--   device_item_accessories    — join: profile ↔ accessory (another library_item)
--
-- New device_category enum values: 'intrusion', 'fire'.
--
-- Existing device_library_items rows are preserved with element_id = NULL until
-- manually re-categorized.
-- ============================================================================

BEGIN;

-- ---- 1. Extend device_category enum ------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
     WHERE t.typname = 'device_category' AND e.enumlabel = 'intrusion'
  ) THEN
    ALTER TYPE device_category ADD VALUE 'intrusion';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
     WHERE t.typname = 'device_category' AND e.enumlabel = 'fire'
  ) THEN
    ALTER TYPE device_category ADD VALUE 'fire';
  END IF;
END $$;

-- ---- 2. device_elements table ------------------------------------------------

CREATE TABLE IF NOT EXISTS device_elements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,            -- e.g. "Fixed Camera", "ACS Controller"
  category         device_category NOT NULL,        -- top-level bucket
  color_hex        TEXT,                            -- optional swatch
  attribute_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{ section, attr, type: 'text' | 'multi', options: [...] }, ...]
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_elements_category ON device_elements(category);

-- ---- 3. device_library_items additions --------------------------------------

ALTER TABLE device_library_items
  ADD COLUMN IF NOT EXISTS element_id  UUID REFERENCES device_elements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attributes  JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_device_library_items_element ON device_library_items(element_id);

-- ---- 4. device_item_accessories (join) --------------------------------------

CREATE TABLE IF NOT EXISTS device_item_accessories (
  item_id            UUID NOT NULL REFERENCES device_library_items(id) ON DELETE CASCADE,
  accessory_item_id  UUID NOT NULL REFERENCES device_library_items(id) ON DELETE CASCADE,
  quantity           INTEGER NOT NULL DEFAULT 1,
  is_required        BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, accessory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_device_item_accessories_item ON device_item_accessories(item_id);
CREATE INDEX IF NOT EXISTS idx_device_item_accessories_acc  ON device_item_accessories(accessory_item_id);

-- ---- 5. RLS ------------------------------------------------------------------

ALTER TABLE device_elements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_item_accessories ENABLE ROW LEVEL SECURITY;

-- Elements are global: everyone reads, only admins write (enforced at API layer).
DROP POLICY IF EXISTS device_elements_read ON device_elements;
CREATE POLICY device_elements_read ON device_elements FOR SELECT USING (true);

-- Accessory links follow the parent item's visibility (org or global).
DROP POLICY IF EXISTS device_item_accessories_read ON device_item_accessories;
CREATE POLICY device_item_accessories_read ON device_item_accessories FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM device_library_items li
     WHERE li.id = device_item_accessories.item_id
       AND (li.org_id IS NULL OR li.org_id = (SELECT org_id FROM users WHERE users.id = auth.uid()))
  )
);

-- ---- 6. updated_at trigger ---------------------------------------------------

CREATE OR REPLACE FUNCTION trg_device_elements_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS device_elements_updated_at ON device_elements;
CREATE TRIGGER device_elements_updated_at
  BEFORE UPDATE ON device_elements
  FOR EACH ROW EXECUTE FUNCTION trg_device_elements_updated_at();

COMMIT;

-- ============================================================================
-- After running this file, run the seed files in order:
--   scripts/device-library-import/out/01_device_elements.sql
--   scripts/device-library-import/out/02_device_library_items.sql
--   scripts/device-library-import/out/03_device_item_accessories.sql
-- ============================================================================
