-- 000015_create_financial_config.up.sql

CREATE TABLE financial_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    provider VARCHAR(20) NOT NULL,
    config JSONB NOT NULL,
    pix_key VARCHAR(77),
    bank_info JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_financial_config_owner ON financial_config(owner_id);
CREATE INDEX idx_financial_config_active ON financial_config(owner_id, is_active);