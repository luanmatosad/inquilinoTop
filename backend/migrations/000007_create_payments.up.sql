CREATE TABLE payments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lease_id   UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    due_date   DATE NOT NULL,
    paid_date  DATE,
    amount     FLOAT8 NOT NULL,
    status     TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'LATE')),
    type       TEXT NOT NULL DEFAULT 'RENT' CHECK (type IN ('RENT', 'DEPOSIT', 'EXPENSE', 'OTHER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_lease_id ON payments(lease_id);
CREATE INDEX idx_payments_owner_id ON payments(owner_id);
