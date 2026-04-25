-- Migration: 000021_add_2fa_fields
-- Revert 2FA fields adding

ALTER TABLE users
DROP COLUMN IF EXISTS totp_secret,
DROP COLUMN IF EXISTS backup_codes,
DROP COLUMN IF EXISTS two_factor_enabled;