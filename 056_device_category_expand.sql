-- 056_device_category_expand.sql
-- Add the 7 canonical device categories the device library UI expects.
-- ALTER TYPE ... ADD VALUE must run outside a transaction block, so each
-- ADD VALUE is idempotent via pg_enum lookup.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'servers_nvr' AND enumtypid = 'device_category'::regtype) THEN
    ALTER TYPE device_category ADD VALUE 'servers_nvr';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'network' AND enumtypid = 'device_category'::regtype) THEN
    ALTER TYPE device_category ADD VALUE 'network';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'av' AND enumtypid = 'device_category'::regtype) THEN
    ALTER TYPE device_category ADD VALUE 'av';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'vape_environmental' AND enumtypid = 'device_category'::regtype) THEN
    ALTER TYPE device_category ADD VALUE 'vape_environmental';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'access_control' AND enumtypid = 'device_category'::regtype) THEN
    ALTER TYPE device_category ADD VALUE 'access_control';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cctv' AND enumtypid = 'device_category'::regtype) THEN
    ALTER TYPE device_category ADD VALUE 'cctv';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'other' AND enumtypid = 'device_category'::regtype) THEN
    ALTER TYPE device_category ADD VALUE 'other';
  END IF;
END
$$;
