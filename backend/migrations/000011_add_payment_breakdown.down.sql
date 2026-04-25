DROP INDEX IF EXISTS ux_payments_lease_competency_type;
ALTER TABLE payments
  DROP COLUMN late_fee_amount,
  DROP COLUMN interest_amount,
  DROP COLUMN irrf_amount,
  DROP COLUMN net_amount,
  DROP COLUMN competency,
  DROP COLUMN description;
ALTER TABLE payments RENAME COLUMN gross_amount TO amount;
