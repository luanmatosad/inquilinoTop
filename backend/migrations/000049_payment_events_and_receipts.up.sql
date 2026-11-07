-- Linha do tempo da cobrança (imutável), dados do pagamento manual e numeração dos recibos.
CREATE TABLE payment_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    kind            VARCHAR(20) NOT NULL CHECK (kind IN ('SENT', 'REMINDER', 'AGREEMENT', 'PAID')),
    channel         VARCHAR(20) CHECK (channel IN ('WHATSAPP', 'EMAIL', 'COPY')),
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_events_payment ON payment_events (payment_id, occurred_at);

ALTER TABLE payments
    ADD COLUMN payment_method   VARCHAR(20) CHECK (payment_method IN ('PIX', 'CASH', 'TRANSFER', 'BOLETO', 'OTHER')),
    ADD COLUMN discount_amount  FLOAT8 NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    ADD COLUMN payment_note     TEXT,
    ADD COLUMN original_due_date DATE,
    ADD COLUMN receipt_number   INTEGER CHECK (receipt_number > 0),
    ADD COLUMN receipt_year     SMALLINT;

CREATE UNIQUE INDEX uq_payments_receipt
    ON payments (organization_id, receipt_year, receipt_number)
    WHERE receipt_number IS NOT NULL;

CREATE TABLE receipt_counters (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    year            SMALLINT NOT NULL,
    last_number     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (organization_id, year)
);
