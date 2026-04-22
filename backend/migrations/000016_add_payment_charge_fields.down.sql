-- 000016_add_payment_charge_fields.down.sql

DROP INDEX IF EXISTS idx_payments_charge;
ALTER TABLE payments DROP COLUMN IF EXISTS financial_config_id;
ALTER TABLE payments DROP COLUMN IF EXISTS payout_status;
ALTER TABLE payments DROP COLUMN IF EXISTS payout_id;
ALTER TABLE payments DROP COLUMN IF EXISTS charge_barcode;
ALTER TABLE payments DROP COLUMN IF EXISTS charge_link;
ALTER TABLE payments DROP COLUMN IF EXISTS charge_qrcode;
ALTER TABLE payments DROP COLUMN IF EXISTS charge_method;
ALTER TABLE payments DROP COLUMN IF EXISTS charge_id;