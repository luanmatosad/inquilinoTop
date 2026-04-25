ALTER TABLE leases
  DROP COLUMN late_fee_percent,
  DROP COLUMN daily_interest_percent,
  DROP COLUMN iptu_reimbursable,
  DROP COLUMN annual_iptu_amount,
  DROP COLUMN iptu_year;
