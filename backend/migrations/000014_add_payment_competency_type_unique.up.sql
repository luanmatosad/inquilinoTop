CREATE UNIQUE INDEX idx_payments_lease_competency_type ON payments (lease_id, competency, type) WHERE competency IS NOT NULL;
