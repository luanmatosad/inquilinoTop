CREATE TABLE lease_readjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id      UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applied_at    DATE NOT NULL,
  old_amount    FLOAT8 NOT NULL,
  new_amount    FLOAT8 NOT NULL,
  percentage    FLOAT8 NOT NULL,
  index_name    TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_readjustments_lease ON lease_readjustments(lease_id);
CREATE INDEX idx_readjustments_owner ON lease_readjustments(owner_id);
