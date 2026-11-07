ALTER TABLE leases
    DROP COLUMN IF EXISTS end_reason,
    DROP COLUMN IF EXISTS adjustment_month,
    DROP COLUMN IF EXISTS adjustment_index;
