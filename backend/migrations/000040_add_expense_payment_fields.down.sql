DROP INDEX IF EXISTS idx_expenses_org_status_due;

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_paid_fields_consistent,
  DROP COLUMN IF EXISTS paid_amount,
  DROP COLUMN IF EXISTS paid_date,
  DROP COLUMN IF EXISTS status;
