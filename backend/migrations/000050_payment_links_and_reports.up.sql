-- Link público da cobrança (só o hash do token é guardado) e aviso "já paguei" do inquilino.
CREATE TABLE payment_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    token_hash      CHAR(64) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No máximo um link ativo por cobrança.
CREATE UNIQUE INDEX uq_payment_links_active ON payment_links (payment_id) WHERE revoked_at IS NULL;

ALTER TABLE payments
    ADD COLUMN reported_at     TIMESTAMPTZ,
    ADD COLUMN reported_amount FLOAT8 CHECK (reported_amount > 0),
    ADD COLUMN reported_date   DATE,
    ADD COLUMN proof_path      TEXT;

ALTER TABLE payment_events DROP CONSTRAINT payment_events_kind_check;
ALTER TABLE payment_events ADD CONSTRAINT payment_events_kind_check
    CHECK (kind IN ('SENT', 'REMINDER', 'AGREEMENT', 'PAID', 'REPORTED', 'REJECTED'));
