DROP TABLE IF EXISTS receipt_counters;
DROP INDEX IF EXISTS uq_payments_receipt;
ALTER TABLE payments
    DROP COLUMN IF EXISTS receipt_year,
    DROP COLUMN IF EXISTS receipt_number,
    DROP COLUMN IF EXISTS original_due_date,
    DROP COLUMN IF EXISTS payment_note,
    DROP COLUMN IF EXISTS discount_amount,
    DROP COLUMN IF EXISTS payment_method;
DROP TABLE IF EXISTS payment_events;
