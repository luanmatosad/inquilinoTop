DROP INDEX IF EXISTS uq_tenants_org_document_active;

ALTER TABLE tenants
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS address_line,
  DROP COLUMN IF EXISTS postal_code;
