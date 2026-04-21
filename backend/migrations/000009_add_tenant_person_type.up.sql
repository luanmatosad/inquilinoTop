ALTER TABLE tenants
  ADD COLUMN person_type TEXT NOT NULL DEFAULT 'PF'
    CHECK (person_type IN ('PF','PJ'));
