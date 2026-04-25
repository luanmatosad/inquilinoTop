CREATE TABLE leases (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unit_id        UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    start_date     DATE NOT NULL,
    end_date       DATE,
    rent_amount    FLOAT8 NOT NULL,
    deposit_amount FLOAT8,
    status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED', 'CANCELED')),
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leases_owner_id  ON leases(owner_id);
CREATE INDEX idx_leases_unit_id   ON leases(unit_id);
CREATE INDEX idx_leases_tenant_id ON leases(tenant_id);
