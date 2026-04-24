-- Migration: 000020_create_user_roles
-- Create user_roles table for RBAC system
-- Uses partial unique indexes to handle NULL property_id correctly

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'viewer')),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_property_id ON user_roles(property_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

CREATE UNIQUE INDEX idx_user_roles_global ON user_roles(user_id, role) WHERE property_id IS NULL;
CREATE UNIQUE INDEX idx_user_roles_property ON user_roles(user_id, role, property_id) WHERE property_id IS NOT NULL;