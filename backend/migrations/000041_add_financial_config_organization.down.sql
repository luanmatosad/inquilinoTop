DROP INDEX IF EXISTS idx_financial_config_org_active_unique;
DROP INDEX IF EXISTS idx_financial_config_org;
-- owner_id volta a ser obrigatório só se nenhuma linha estiver sem ele.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM financial_config WHERE owner_id IS NULL) THEN
    ALTER TABLE financial_config ALTER COLUMN owner_id SET NOT NULL;
  END IF;
END $$;
ALTER TABLE financial_config DROP COLUMN IF EXISTS organization_id;
