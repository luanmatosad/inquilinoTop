DROP INDEX IF EXISTS idx_readjustments_org;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lease_readjustments WHERE owner_id IS NULL) THEN
    ALTER TABLE lease_readjustments ALTER COLUMN owner_id SET NOT NULL;
  END IF;
END $$;
ALTER TABLE lease_readjustments DROP COLUMN IF EXISTS organization_id;
