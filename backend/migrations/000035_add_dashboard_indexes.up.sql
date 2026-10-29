CREATE INDEX IF NOT EXISTS idx_payments_org_due_date ON payments(organization_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_leases_org_active_end ON leases(organization_id, end_date) WHERE is_active AND status = 'ACTIVE';
