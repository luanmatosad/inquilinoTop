-- Seed back: removes organization_id columns and drops new tables
-- Data in original tables (users, properties, etc.) is preserved

-- Remove organization_id from expenses
ALTER TABLE expenses DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from payments
ALTER TABLE payments DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from leases
ALTER TABLE leases DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from tenants
ALTER TABLE tenants DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from properties
ALTER TABLE properties DROP COLUMN IF EXISTS organization_id;

-- Remove organization_id from users
ALTER TABLE users DROP COLUMN IF EXISTS organization_id;

-- Drop tables (order matters for FK)
DROP TABLE IF EXISTS organization_invites;
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS branches;
DROP TABLE IF EXISTS organizations;