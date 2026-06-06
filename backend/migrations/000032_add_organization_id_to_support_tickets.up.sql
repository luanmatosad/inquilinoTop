-- Add organization_id to support_tickets table for multi-tenancy
ALTER TABLE support_tickets ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_support_tickets_organization_id ON support_tickets(organization_id);

-- Backfill organization_id from user's organization_id
UPDATE support_tickets SET organization_id = users.organization_id
FROM users WHERE support_tickets.user_id = users.id;

-- Make organization_id NOT NULL after backfill
ALTER TABLE support_tickets ALTER COLUMN organization_id SET NOT NULL;