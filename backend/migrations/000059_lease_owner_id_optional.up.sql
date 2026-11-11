-- owner_id vira legado opcional: o código novo não o preenche (organization_id é o escopo).
ALTER TABLE leases ALTER COLUMN owner_id DROP NOT NULL;
