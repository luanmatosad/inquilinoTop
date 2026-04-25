CREATE TABLE expenses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unit_id     UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount      FLOAT8 NOT NULL,
    due_date    DATE NOT NULL,
    category    TEXT NOT NULL CHECK (category IN ('ELECTRICITY', 'WATER', 'CONDO', 'TAX', 'MAINTENANCE', 'OTHER')),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_unit_id  ON expenses(unit_id);
CREATE INDEX idx_expenses_owner_id ON expenses(owner_id);
