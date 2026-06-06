-- Add organization_id to audit_logs table for multi-tenancy
ALTER TABLE audit_logs ADD COLUMN organization_id UUID;
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_organization_id
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill organization_id from user's organization_id via owner_id
UPDATE audit_logs SET organization_id = users.organization_id
FROM users WHERE audit_logs.owner_id = users.id;

-- Make organization_id NOT NULL after backfill
ALTER TABLE audit_logs ALTER COLUMN organization_id SET NOT NULL;