-- Falha se houver linhas desativadas duplicadas: remover ou restaurar essas linhas antes de reverter.
DROP INDEX IF EXISTS idx_bank_records_payment_unique;
CREATE UNIQUE INDEX idx_bank_records_payment_unique
  ON bank_records (payment_id) WHERE payment_id IS NOT NULL;

DROP INDEX IF EXISTS uq_bank_records_line_active;
ALTER TABLE bank_records
  ADD CONSTRAINT bank_records_unique_line UNIQUE (organization_id, record_date, description, amount, type);
ALTER TABLE bank_records
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS is_active;

DROP INDEX IF EXISTS uq_transfers_property_period_active;
ALTER TABLE transfers
  ADD CONSTRAINT transfers_one_per_property_period UNIQUE (organization_id, property_id, period);
ALTER TABLE transfers
  DROP COLUMN IF EXISTS is_active;
