-- Fechamento mensal de recebimentos: retrato (snapshot) do mês e histórico imutável.
CREATE TABLE month_closings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    month           CHAR(7) NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    closed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    closed_by_name  TEXT NOT NULL,
    snapshot        JSONB NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    closed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reopened_at     TIMESTAMPTZ
);

-- Um fechamento ativo por organização e mês; reabrir desativa (sem DELETE).
CREATE UNIQUE INDEX uq_month_closings_active ON month_closings (organization_id, month) WHERE is_active;

CREATE TABLE month_closing_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    month           CHAR(7) NOT NULL,
    closing_id      UUID NOT NULL REFERENCES month_closings(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN ('CLOSED', 'REOPENED')),
    actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name      TEXT NOT NULL,
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_month_closing_events_org_month ON month_closing_events (organization_id, month, created_at);
