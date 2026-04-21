ALTER TABLE leases
  ADD COLUMN late_fee_percent       FLOAT8  NOT NULL DEFAULT 0,
  ADD COLUMN daily_interest_percent FLOAT8  NOT NULL DEFAULT 0,
  ADD COLUMN iptu_reimbursable      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN annual_iptu_amount     FLOAT8,
  ADD COLUMN iptu_year              INT;
