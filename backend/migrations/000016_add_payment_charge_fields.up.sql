-- 000016_add_payment_charge_fields.up.sql

ALTER TABLE payments ADD COLUMN IF NOT EXISTS charge_id VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS charge_method VARCHAR(10);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS charge_qrcode TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS charge_link TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS charge_barcode TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payout_id VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS financial_config_id UUID REFERENCES financial_config(id);

CREATE INDEX IF NOT EXISTS idx_payments_charge ON payments(charge_id);