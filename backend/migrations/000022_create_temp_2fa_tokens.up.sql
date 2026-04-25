-- Migration: 000022_create_temp_2fa_tokens
-- Create temp_2fa_tokens table for 2FA login flow

CREATE TABLE IF NOT EXISTS temp_2fa_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_temp_2fa_tokens_token ON temp_2fa_tokens(token);
CREATE INDEX idx_temp_2fa_tokens_expires ON temp_2fa_tokens(expires_at);