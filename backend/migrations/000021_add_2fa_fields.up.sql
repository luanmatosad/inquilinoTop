-- Migration: 000021_add_2fa_fields
-- Add TOTP and backup codes for two-factor authentication

ALTER TABLE users
ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;