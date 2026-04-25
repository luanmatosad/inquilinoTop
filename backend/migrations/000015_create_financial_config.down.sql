-- 000015_create_financial_config.down.sql

DROP INDEX IF EXISTS idx_financial_config_active;
DROP INDEX IF EXISTS idx_financial_config_owner;
DROP TABLE IF EXISTS financial_config;