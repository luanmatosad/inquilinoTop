ALTER TABLE payments RENAME COLUMN amount TO gross_amount;
ALTER TABLE payments
  ADD COLUMN late_fee_amount FLOAT8 NOT NULL DEFAULT 0,
  ADD COLUMN interest_amount FLOAT8 NOT NULL DEFAULT 0,
  ADD COLUMN irrf_amount     FLOAT8 NOT NULL DEFAULT 0,
  ADD COLUMN net_amount      FLOAT8,
  ADD COLUMN competency      CHAR(7),
  ADD COLUMN description     TEXT;

CREATE UNIQUE INDEX ux_payments_lease_competency_type
  ON payments(lease_id, competency, type) WHERE competency IS NOT NULL;
