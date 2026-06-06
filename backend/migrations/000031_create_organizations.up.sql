-- Organizations: root tenant entity for data isolation
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) NOT NULL DEFAULT 'FREE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_plan ON organizations(plan);

-- Branches: subdivisions of an organization
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_branches_organization_id ON branches(organization_id);
CREATE INDEX idx_branches_org_active ON branches(organization_id, is_active) WHERE is_active = TRUE;

-- Organization members: users belonging to an organization with roles
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'employee', 'viewer')),
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_org_branch ON organization_members(organization_id, branch_id);
CREATE INDEX idx_org_members_role ON organization_members(role);

-- Organization invites: pending invitations to join
CREATE TABLE organization_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'employee', 'viewer')),
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_invites_token ON organization_invites(token);
CREATE INDEX idx_org_invites_org_id ON organization_invites(organization_id);
CREATE INDEX idx_org_invites_email_org ON organization_invites(email, organization_id);
CREATE INDEX idx_org_invites_pending ON organization_invites(accepted_at) WHERE accepted_at IS NULL;

-- Add organization_id to users table
ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_users_organization_id ON users(organization_id);

-- Add organization_id to properties table
ALTER TABLE properties ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_properties_organization_id ON properties(organization_id);

-- Add organization_id to tenants table
ALTER TABLE tenants ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_tenants_organization_id ON tenants(organization_id);

-- Add organization_id to leases table
ALTER TABLE leases ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_leases_organization_id ON leases(organization_id);

-- Add organization_id to payments table
ALTER TABLE payments ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_payments_organization_id ON payments(organization_id);

-- Add organization_id to expenses table
ALTER TABLE expenses ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX idx_expenses_organization_id ON expenses(organization_id);

-- Seed: create organization for each existing user and link all resources
DO $$
DECLARE
    u RECORD;
    new_org_id UUID;
BEGIN
    FOR u IN SELECT id, email, full_name FROM users LEFT JOIN user_profiles ON users.id = user_profiles.user_id LOOP
        -- Create organization with user's name or email prefix as default name
        INSERT INTO organizations (name) VALUES (
            COALESCE(
                NULLIF(TRIM(u.full_name), ''),
                SPLIT_PART(u.email, '@', 1)
            ) || ' Imobiliária'
        )
        RETURNING id INTO new_org_id;

        -- Link user to organization as owner
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (new_org_id, u.id, 'owner');

        -- Link user's resources to organization
        UPDATE users SET organization_id = new_org_id WHERE id = u.id;
        UPDATE properties SET organization_id = new_org_id WHERE owner_id = u.id;
        UPDATE tenants SET organization_id = new_org_id WHERE owner_id = u.id;
        UPDATE leases SET organization_id = new_org_id WHERE owner_id = u.id;
        UPDATE payments SET organization_id = new_org_id WHERE owner_id = u.id;
        UPDATE expenses SET organization_id = new_org_id WHERE owner_id = u.id;
    END LOOP;
END $$;