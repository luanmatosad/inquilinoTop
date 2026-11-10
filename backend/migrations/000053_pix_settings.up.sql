-- Pix da organização (chave, tipo, nome e cidade do recebedor) e conta Pix própria por unidade.
ALTER TABLE organization_settings
    ADD COLUMN pix_key           TEXT,
    ADD COLUMN pix_key_type      TEXT CHECK (pix_key_type IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM')),
    ADD COLUMN pix_receiver_name TEXT,
    ADD COLUMN pix_city          TEXT,
    ADD COLUMN pix_updated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN pix_updated_at    TIMESTAMPTZ,
    ADD CONSTRAINT organization_settings_pix_pair CHECK ((pix_key IS NULL) = (pix_key_type IS NULL));

-- Conta Pix de uma unidade (imóvel de outra pessoa ou empresa). Trocar ou remover desativa a linha (sem DELETE):
-- o histórico guarda quem confirmou e quando.
CREATE TABLE unit_pix_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    pix_key         TEXT NOT NULL,
    pix_key_type    TEXT NOT NULL CHECK (pix_key_type IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM')),
    receiver_name   TEXT,
    confirmed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    deactivated_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_unit_pix_accounts_active ON unit_pix_accounts (unit_id) WHERE is_active;
CREATE INDEX idx_unit_pix_accounts_org ON unit_pix_accounts (organization_id) WHERE is_active;
