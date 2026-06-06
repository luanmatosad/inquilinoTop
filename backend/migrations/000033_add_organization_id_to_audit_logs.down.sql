-- Remove organization_id from audit_logs table
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_organization_id;
DROP INDEX IF EXISTS idx_audit_logs_organization_id;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS organization_id;