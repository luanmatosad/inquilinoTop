-- Taxa administrativa da organização (padrão 0: sem taxa até o usuário configurar).
ALTER TABLE organization_settings
  ADD COLUMN admin_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (admin_fee_percent BETWEEN 0 AND 100);

-- Repasse ao proprietário: um registro por imóvel e competência (YYYY-MM).
-- net_amount = gross_amount - admin_fee_amount - discounts (calculado no service e recalculado ao mudar discounts).
CREATE TABLE transfers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id       UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    period            CHAR(7) NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    gross_amount      NUMERIC(12,2) NOT NULL CHECK (gross_amount >= 0),
    admin_fee_percent NUMERIC(5,2) NOT NULL CHECK (admin_fee_percent BETWEEN 0 AND 100),
    admin_fee_amount  NUMERIC(12,2) NOT NULL CHECK (admin_fee_amount >= 0),
    discounts         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discounts >= 0),
    net_amount        NUMERIC(12,2) NOT NULL,
    status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'TRANSFERRED')),
    transferred_at    TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT transfers_one_per_property_period UNIQUE (organization_id, property_id, period),
    CONSTRAINT transfers_transferred_at_consistent CHECK (
        (status = 'TRANSFERRED') = (transferred_at IS NOT NULL)
    )
);

CREATE INDEX idx_transfers_org_period ON transfers (organization_id, period);
CREATE INDEX idx_transfers_org_status ON transfers (organization_id, status);

-- Extrato bancário importado por CSV. payment_id liga o lançamento ao pagamento conciliado;
-- o status do pagamento não muda (payments.status não tem RECONCILED).
CREATE TABLE bank_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    record_date     DATE NOT NULL,
    description     TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 255),
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    type            TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
    payment_id      UUID REFERENCES payments(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Reimportar o mesmo arquivo não duplica lançamentos.
    CONSTRAINT bank_records_unique_line UNIQUE (organization_id, record_date, description, amount, type)
);

CREATE INDEX idx_bank_records_org_date ON bank_records (organization_id, record_date);
-- Um pagamento conciliado com no máximo um lançamento.
CREATE UNIQUE INDEX idx_bank_records_payment_unique ON bank_records (payment_id) WHERE payment_id IS NOT NULL;
