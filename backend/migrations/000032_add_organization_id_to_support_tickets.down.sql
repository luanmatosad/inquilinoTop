-- Remove organization_id from support_tickets table
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_organization_id_fkey;
DROP INDEX IF EXISTS idx_support_tickets_organization_id;
ALTER TABLE support_tickets DROP COLUMN IF EXISTS organization_id;