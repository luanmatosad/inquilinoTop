CREATE UNIQUE INDEX idx_financial_config_owner_active_unique ON financial_config(owner_id) WHERE is_active = true;
