-- Soft-delete (ADR cross-cutting 0001): deleções via is_active=false, nunca DELETE.
-- Índices únicos passam a valer só para registros ativos, para um registro desativado não bloquear o mesmo valor.

ALTER TABLE transfers
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE transfers DROP CONSTRAINT transfers_one_per_property_period;
CREATE UNIQUE INDEX uq_transfers_property_period_active
  ON transfers (organization_id, property_id, period) WHERE is_active;

ALTER TABLE bank_records
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE bank_records DROP CONSTRAINT bank_records_unique_line;
CREATE UNIQUE INDEX uq_bank_records_line_active
  ON bank_records (organization_id, record_date, description, amount, type) WHERE is_active;

DROP INDEX idx_bank_records_payment_unique;
CREATE UNIQUE INDEX idx_bank_records_payment_unique
  ON bank_records (payment_id) WHERE payment_id IS NOT NULL AND is_active;
