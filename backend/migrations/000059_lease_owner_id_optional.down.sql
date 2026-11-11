DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM leases WHERE owner_id IS NULL) THEN
    RAISE EXCEPTION 'leases.owner_id com NULL: preencher antes de reverter';
  END IF;
END $$;
ALTER TABLE leases ALTER COLUMN owner_id SET NOT NULL;
