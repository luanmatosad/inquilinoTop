-- Revert NOT NULL constraints from organization_id
ALTER TABLE properties ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE tenants ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE leases ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE expenses ALTER COLUMN organization_id DROP NOT NULL;
