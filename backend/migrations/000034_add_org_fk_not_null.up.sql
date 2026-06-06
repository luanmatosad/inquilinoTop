-- Add NOT NULL constraints to organization_id since all existing rows were populated in 000031
ALTER TABLE properties ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE tenants ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE leases ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN organization_id SET NOT NULL;
